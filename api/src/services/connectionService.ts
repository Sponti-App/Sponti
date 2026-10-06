import { type ClientSession } from "mongoose";
import { Connection } from "#models/index";
import type {
  GetConnectionsQuery,
  RespondToConnectionRequestBody,
  SendConnectionRequestBody,
} from "#schemas/connectionSchemas";
import { addNewFriendsToAllFriendsFlares } from "#services/allFriendsFlareService";
import { hasAnyBlockBetweenUsers } from "#services/blockService";
import {
  createConnectionAcceptedNotification,
  createConnectionRequestNotification,
} from "#services/notificationService";
import { getUsersByIds } from "#services/userDirectoryService";
import { AppError } from "#utils/AppError";
import { toObjectId } from "#utils/objectId";
import { getPagination, toPagination } from "#utils/pagination";
import { withTransactionFallback } from "#utils/transactions";

export const sendConnectionRequest = async (
  requesterId: string,
  input: SendConnectionRequestBody
) => {
  if (requesterId === input.receiverId) {
    throw new AppError(
      "You cannot send a connection request to yourself",
      400,
      "CANNOT_CONNECT_SELF"
    );
  }

  if (await hasAnyBlockBetweenUsers(requesterId, input.receiverId)) {
    // Stealth behavior: the sender should not learn whether either user has blocked the other.
    return {
      processed: true,
      delivered: false,
    };
  }

  const requesterObjectId = toObjectId(requesterId);
  const receiverObjectId = toObjectId(input.receiverId);

  const result = await withTransactionFallback(async (session?: ClientSession) => {
    const existing = await Connection.findOne({
      requesterId: requesterObjectId,
      receiverId: receiverObjectId,
    }).session(session ?? null);

    if (existing) {
      if (existing.status === "rejected") {
        // TODO: Decide whether rejected connection requests can be retried after a cooldown.
        throw new AppError("Connection request was already rejected", 409, "CONNECTION_REJECTED");
      }

      return {
        connection: existing,
        autoAccepted: false,
        created: false,
      };
    }

    const reversePending = await Connection.findOne({
      requesterId: receiverObjectId,
      receiverId: requesterObjectId,
      status: "pending",
    }).session(session ?? null);

    if (reversePending) {
      reversePending.status = "accepted";
      await reversePending.save({ session });

      const [connection] = await Connection.create(
        [
          {
            requesterId: requesterObjectId,
            receiverId: receiverObjectId,
            status: "accepted",
            type: input.type,
          },
        ],
        { session }
      );

      if (!connection) {
        throw new AppError("Connection could not be created", 500, "CONNECTION_CREATE_FAILED");
      }

      await createConnectionAcceptedNotification({
        requesterId: input.receiverId,
        accepterId: requesterId,
        connectionId: String(reversePending._id),
        session,
      });

      await addNewFriendsToAllFriendsFlares(requesterId, input.receiverId, session);

      return {
        connection,
        reverseConnection: reversePending,
        autoAccepted: true,
        created: true,
      };
    }

    const [connection] = await Connection.create(
      [
        {
          requesterId: requesterObjectId,
          receiverId: receiverObjectId,
          status: "pending",
          type: input.type,
        },
      ],
      { session }
    );

    if (!connection) {
      throw new AppError("Connection could not be created", 500, "CONNECTION_CREATE_FAILED");
    }

    await createConnectionRequestNotification({
      requesterId,
      receiverId: input.receiverId,
      connectionId: String(connection._id),
      session,
    });

    return {
      connection,
      autoAccepted: false,
      created: true,
    };
  });

  return {
    processed: true,
    delivered: true,
    ...result,
  };
};

/**
 * Scanning someone's QR code in person connects both people at once (#124):
 * showing your code is the consent, so there is no request for the owner to
 * accept. Any pending (or earlier rejected) request in either direction is
 * resolved into the connection. Blocks either way are a silent no-op, like
 * `sendConnectionRequest`. The owner gets a `connection_accepted`
 * notification so they know who scanned them.
 *
 * Only call this from a path that has already proven in-person presence —
 * today that is a live, short-lived (15 min) QR contact token.
 */
export const connectInPerson = async (scannerId: string, ownerId: string) => {
  if (scannerId === ownerId) {
    throw new AppError("You cannot connect with yourself", 400, "CANNOT_CONNECT_SELF");
  }

  if (await hasAnyBlockBetweenUsers(scannerId, ownerId)) {
    return { processed: true, delivered: false, connected: false, created: false };
  }

  const scannerObjectId = toObjectId(scannerId);
  const ownerObjectId = toObjectId(ownerId);

  const result = await withTransactionFallback(async (session?: ClientSession) => {
    const rows = await Connection.find({
      $or: [
        { requesterId: scannerObjectId, receiverId: ownerObjectId },
        { requesterId: ownerObjectId, receiverId: scannerObjectId },
      ],
    }).session(session ?? null);

    if (rows.length === 2 && rows.every((row) => row.status === "accepted")) {
      return { connected: true, created: false };
    }

    // Accepted connections are stored as a mirrored pair of rows (see
    // respondToConnectionRequest); upsert both so either direction reads as
    // connected. An existing row keeps its original `type`.
    for (const [requesterId, receiverId] of [
      [scannerObjectId, ownerObjectId],
      [ownerObjectId, scannerObjectId],
    ] as const) {
      await Connection.updateOne(
        { requesterId, receiverId },
        {
          $set: { status: "accepted" },
          $setOnInsert: { requesterId, receiverId, type: "qr" },
        },
        { upsert: true, session }
      );
    }

    const scannerRow = await Connection.findOne({
      requesterId: scannerObjectId,
      receiverId: ownerObjectId,
    }).session(session ?? null);

    if (!scannerRow) {
      throw new AppError("Connection could not be created", 500, "CONNECTION_CREATE_FAILED");
    }

    await createConnectionAcceptedNotification({
      requesterId: ownerId,
      accepterId: scannerId,
      connectionId: String(scannerRow._id),
      session,
      via: "qr",
    });

    await addNewFriendsToAllFriendsFlares(scannerId, ownerId, session);

    return { connected: true, created: true };
  });

  return { processed: true, delivered: true, ...result };
};

export const getConnections = async (userId: string, query: GetConnectionsQuery) => {
  const userObjectId = toObjectId(userId);
  const { page, limit, skip } = getPagination(query);
  const filter: Record<string, unknown> = {};

  if (query.direction === "incoming") {
    filter.receiverId = userObjectId;
  } else if (query.direction === "outgoing") {
    filter.requesterId = userObjectId;
  } else {
    filter.$or = [{ requesterId: userObjectId }, { receiverId: userObjectId }];
  }

  if (query.status) {
    filter.status = query.status;
  } else {
    filter.status = { $ne: "rejected" };
  }

  if (query.type) {
    filter.type = query.type;
  }

  const [connections, total] = await Promise.all([
    Connection.find(filter).sort({ updatedAt: -1 }).skip(skip).limit(limit).lean(),
    Connection.countDocuments(filter),
  ]);
  const profileIds = connections.map((connection) => {
    const requesterId = connection.requesterId.toString();
    const receiverId = connection.receiverId.toString();

    return requesterId === userId ? receiverId : requesterId;
  });
  const users = await getUsersByIds(profileIds);

  return {
    data: connections.map((connection) => {
      const requesterId = connection.requesterId.toString();
      const receiverId = connection.receiverId.toString();
      const otherUserId = requesterId === userId ? receiverId : requesterId;

      return {
        ...connection,
        otherUser: users.get(otherUserId) ?? null,
      };
    }),
    pagination: toPagination(page, limit, total),
  };
};

export const respondToConnectionRequest = async (
  userId: string,
  connectionId: string,
  input: RespondToConnectionRequestBody
) => {
  const receiverObjectId = toObjectId(userId);
  const connectionObjectId = toObjectId(connectionId);

  return withTransactionFallback(async (session?: ClientSession) => {
    const connection = await Connection.findOne({
      _id: connectionObjectId,
      receiverId: receiverObjectId,
      status: "pending",
    }).session(session ?? null);

    if (!connection) {
      throw new AppError("Connection request not found", 404, "CONNECTION_REQUEST_NOT_FOUND");
    }

    // Blocking deletes pending requests (#260), so a pending row between a
    // blocked pair is a leftover (a request that raced the block, or old
    // data). Accepting it would connect people who blocked each other (#444).
    // Answer exactly like a missing request so the accepter learns nothing
    // about who blocked whom. Declining stays allowed: it only closes the row.
    if (
      input.status === "accepted" &&
      (await hasAnyBlockBetweenUsers(userId, String(connection.requesterId)))
    ) {
      throw new AppError("Connection request not found", 404, "CONNECTION_REQUEST_NOT_FOUND");
    }

    connection.status = input.status;
    await connection.save({ session });

    if (input.status === "accepted") {
      await Connection.updateOne(
        {
          requesterId: receiverObjectId,
          receiverId: connection.requesterId,
        },
        {
          $set: {
            status: "accepted",
            type: connection.type,
          },
          $setOnInsert: {
            requesterId: receiverObjectId,
            receiverId: connection.requesterId,
          },
        },
        { upsert: true, session }
      );

      await createConnectionAcceptedNotification({
        requesterId: String(connection.requesterId),
        accepterId: userId,
        connectionId: String(connection._id),
        session,
      });

      await addNewFriendsToAllFriendsFlares(userId, String(connection.requesterId), session);
    }

    return connection;
  });
};

/**
 * Deletes one of the caller's own rows. The spa only uses this to cancel a
 * request it sent, but it also accepts an accepted row; then the mirrored row
 * goes too, so the pair never ends up one-sided (#260). "Connected" needs
 * both rows, so dropping either already ends the connection for both people.
 */
export const deleteConnection = async (userId: string, connectionId: string) => {
  await withTransactionFallback(async (session?: ClientSession) => {
    const connection = await Connection.findOneAndDelete(
      { _id: toObjectId(connectionId), requesterId: toObjectId(userId) },
      { session }
    );

    if (!connection) {
      throw new AppError("Connection not found", 404, "CONNECTION_NOT_FOUND");
    }

    if (connection.status === "accepted") {
      await Connection.deleteOne(
        {
          requesterId: connection.receiverId,
          receiverId: connection.requesterId,
          status: "accepted",
        },
        { session }
      );
    }
  });
};
