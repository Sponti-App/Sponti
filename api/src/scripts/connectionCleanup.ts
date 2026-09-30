import { Block, Connection, type ConnectionStatus } from "#models/index";
import { toObjectId } from "#utils/objectId";

// One-off cleanup for #260. Before #260, blocking someone deleted only the
// blocker's own accepted row, so a block (and a later unblock) could leave
// the blocked person's accepted row behind: a one-sided connection. Every
// accepted connection is meant to be a mirrored pair, and "connected" now
// requires both rows (see relationshipService), so these rows grant nothing
// any more. This removes them so the data matches the rule again.
//
// Two kinds of row are removed:
// - blocked_pair: any row a block would remove today (blockService.blockUser):
//   for a block X -> Y, X's row to Y whatever its status, and Y's row to X
//   if it is pending or accepted. Y's rejected row (X's own refusal) stays.
// - one_sided_accepted: an accepted row whose mirror is missing or not
//   accepted.
//
// Only ids are reported (connection, requester and receiver ObjectIds), never
// names, usernames or emails. Loads the connections and blocks collections
// into memory, which is fine at Sponti's size.

export type CleanupReason = "blocked_pair" | "one_sided_accepted";

export type CleanupRow = {
  connectionId: string;
  requesterId: string;
  receiverId: string;
  status: ConnectionStatus;
  reason: CleanupReason;
};

export type CleanupPlan = {
  scannedConnections: number;
  scannedBlocks: number;
  rows: CleanupRow[];
  counts: Record<CleanupReason, number>;
};

const pairKey = (fromId: string, toId: string) => `${fromId}:${toId}`;

export const planConnectionCleanup = async (): Promise<CleanupPlan> => {
  const [connections, blocks] = await Promise.all([
    Connection.find({}).select("requesterId receiverId status").lean(),
    Block.find({}).select("blockerId blockedId").lean(),
  ]);

  const blockPairs = new Set(
    blocks.map((block) => pairKey(block.blockerId.toString(), block.blockedId.toString()))
  );
  const acceptedPairs = new Set(
    connections
      .filter((row) => row.status === "accepted")
      .map((row) => pairKey(row.requesterId.toString(), row.receiverId.toString()))
  );

  const rows: CleanupRow[] = [];

  for (const row of connections) {
    const requesterId = row.requesterId.toString();
    const receiverId = row.receiverId.toString();

    // Requester blocked receiver: all of the blocker's own rows go. Receiver
    // blocked requester: the blocked person's pending/accepted rows go.
    const blockedPair =
      blockPairs.has(pairKey(requesterId, receiverId)) ||
      (blockPairs.has(pairKey(receiverId, requesterId)) &&
        (row.status === "pending" || row.status === "accepted"));

    const oneSided =
      row.status === "accepted" && !acceptedPairs.has(pairKey(receiverId, requesterId));

    if (blockedPair || oneSided) {
      rows.push({
        connectionId: row._id.toString(),
        requesterId,
        receiverId,
        status: row.status,
        reason: blockedPair ? "blocked_pair" : "one_sided_accepted",
      });
    }
  }

  return {
    scannedConnections: connections.length,
    scannedBlocks: blocks.length,
    rows,
    counts: {
      blocked_pair: rows.filter((row) => row.reason === "blocked_pair").length,
      one_sided_accepted: rows.filter((row) => row.reason === "one_sided_accepted").length,
    },
  };
};

/**
 * Deletes the planned rows. Each delete also matches the status seen when
 * planning, so a row that changed in between is left alone.
 */
export const applyConnectionCleanup = async (plan: CleanupPlan) => {
  if (plan.rows.length === 0) return 0;

  const result = await Connection.bulkWrite(
    plan.rows.map((row) => ({
      deleteOne: { filter: { _id: toObjectId(row.connectionId), status: row.status } },
    }))
  );

  return result.deletedCount;
};

export const formatCleanupReport = (plan: CleanupPlan, mode: "dry-run" | "apply") =>
  [
    `mode: ${mode}`,
    `scanned: ${plan.scannedConnections} connections, ${plan.scannedBlocks} blocks`,
    `to delete: ${plan.rows.length} (blocked_pair: ${plan.counts.blocked_pair}, one_sided_accepted: ${plan.counts.one_sided_accepted})`,
    ...plan.rows.map(
      (row) =>
        `  ${row.reason} connection=${row.connectionId} requester=${row.requesterId} receiver=${row.receiverId} status=${row.status}`
    ),
  ].join("\n");

/**
 * Plans the cleanup, prints the report and deletes only when `apply` is set.
 * Expects mongoose to be connected already.
 */
export const runConnectionCleanup = async ({
  apply,
  log = console.log,
}: {
  apply: boolean;
  log?: (line: string) => void;
}) => {
  const plan = await planConnectionCleanup();
  log(formatCleanupReport(plan, apply ? "apply" : "dry-run"));

  if (!apply) {
    log("dry run: nothing deleted. Re-run with --apply to delete these rows.");
    return { plan, deleted: 0 };
  }

  const deleted = await applyConnectionCleanup(plan);
  log(`deleted: ${deleted}`);
  return { plan, deleted };
};
