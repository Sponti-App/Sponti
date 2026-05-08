import { AppError } from "#utils/AppError";

export const createQrContactToken = async () => {
  // TODO: Product/frontend contract pending: expiry, one-time vs reusable, raw token format, and hashing strategy.
  throw new AppError("QR contact tokens are not implemented yet", 501, "QR_TOKENS_NOT_IMPLEMENTED");
};

export const resolveQrContactToken = async () => {
  // TODO: Product/frontend contract pending: expiry, one-time vs reusable, self-resolve behavior, and block handling.
  throw new AppError("QR contact tokens are not implemented yet", 501, "QR_TOKENS_NOT_IMPLEMENTED");
};
