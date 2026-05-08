import type { ErrorRequestHandler } from "express";
import mongoose from "mongoose";
import { ZodError } from "zod";
import { env } from "#config/env";
import { AppError } from "#utils/AppError";

const isDuplicateKeyError = (error: unknown): error is { code: number; keyValue?: unknown } =>
  typeof error === "object" && error !== null && "code" in error && error.code === 11000;

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (env.NODE_ENV !== "production") {
    console.error(err);
  }

  if (err instanceof AppError) {
    if (err.code === "ACCESS_TOKEN_EXPIRED") {
      res.setHeader(
        "WWW-Authenticate",
        'Bearer error="token_expired", error_description="The access token expired"'
      );
    }

    return res.status(err.statusCode).json({
      error: {
        message: err.message,
        code: err.code,
        details: err.details,
      },
    });
  }

  if (err instanceof ZodError) {
    return res.status(400).json({
      error: {
        message: "Validation failed",
        code: "VALIDATION_ERROR",
        details: err.issues,
      },
    });
  }

  if (isDuplicateKeyError(err)) {
    return res.status(409).json({
      error: {
        message: "Duplicate resource",
        code: "DUPLICATE_RESOURCE",
        details: { keyValue: err.keyValue },
      },
    });
  }

  if (err instanceof mongoose.Error.CastError) {
    return res.status(400).json({
      error: {
        message: "Invalid resource id",
        code: "INVALID_OBJECT_ID",
      },
    });
  }

  if (err instanceof mongoose.Error.ValidationError) {
    return res.status(400).json({
      error: {
        message: "Database validation failed",
        code: "DATABASE_VALIDATION_ERROR",
        details: err.errors,
      },
    });
  }

  if (err instanceof SyntaxError && "body" in err) {
    return res.status(400).json({
      error: {
        message: "Invalid JSON body",
        code: "INVALID_JSON",
      },
    });
  }

  return res.status(500).json({
    error: {
      message: "Internal server error",
      code: "INTERNAL_SERVER_ERROR",
    },
  });
};
