import type { Request } from "express";
import { AppError } from "#utils/AppError";

export const getAuthenticatedUserId = (req: Request) => {
  if (!req.user?.id) {
    throw new AppError("Authenticated user missing from request", 500, "AUTH_CONTEXT_MISSING");
  }

  return req.user.id;
};

export const getRouteParam = (req: Request, key: string) => {
  const value = req.params[key];

  if (typeof value !== "string") {
    throw new AppError(`Missing route param: ${key}`, 500, "ROUTE_PARAM_MISSING");
  }

  return value;
};
