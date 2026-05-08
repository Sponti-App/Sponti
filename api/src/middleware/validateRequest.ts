import type { RequestHandler } from "express";
import type { ZodType } from "zod";
import { AppError } from "#utils/AppError";

type RequestSchemas = {
  body?: ZodType;
  params?: ZodType;
  query?: ZodType;
};

export const validateRequest =
  ({ body, params, query }: RequestSchemas): RequestHandler =>
  (req, _res, next) => {
    const details: Record<string, unknown> = {};

    if (body) {
      const result = body.safeParse(req.body);
      if (!result.success) {
        details.body = result.error.issues;
      } else {
        req.body = result.data;
      }
    }

    if (params) {
      const result = params.safeParse(req.params);
      if (!result.success) {
        details.params = result.error.issues;
      } else {
        req.params = result.data as Record<string, string>;
      }
    }

    if (query) {
      const result = query.safeParse(req.query);
      if (!result.success) {
        details.query = result.error.issues;
      } else {
        req.query = result.data as typeof req.query;
      }
    }

    if (Object.keys(details).length > 0) {
      return next(new AppError("Validation failed", 400, "VALIDATION_ERROR", details));
    }

    return next();
  };
