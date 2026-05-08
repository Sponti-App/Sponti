import type {
  GetConnectionsQuery,
  RespondToConnectionRequestBody,
  SendConnectionRequestBody,
} from "#schemas/connectionSchemas";
import * as connectionService from "#services/connectionService";
import { asyncHandler } from "#utils/asyncHandler";
import { getAuthenticatedUserId, getRouteParam } from "#utils/requestUser";

export const sendConnectionRequest = asyncHandler(async (req, res) => {
  await connectionService.sendConnectionRequest(
    getAuthenticatedUserId(req),
    req.body as SendConnectionRequestBody
  );

  // Stealth response: blocked recipients must not be disclosed to the requester.
  res.status(202).json({ data: { processed: true } });
});

export const getConnections = asyncHandler(async (req, res) => {
  const result = await connectionService.getConnections(
    getAuthenticatedUserId(req),
    req.query as unknown as GetConnectionsQuery
  );

  res.json(result);
});

export const respondToConnectionRequest = asyncHandler(async (req, res) => {
  const data = await connectionService.respondToConnectionRequest(
    getAuthenticatedUserId(req),
    getRouteParam(req, "id"),
    req.body as RespondToConnectionRequestBody
  );

  res.json({ data });
});

export const deleteConnection = asyncHandler(async (req, res) => {
  await connectionService.deleteConnection(getAuthenticatedUserId(req), getRouteParam(req, "id"));

  res.status(204).send();
});
