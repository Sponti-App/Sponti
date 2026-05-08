export type ErrorDetails = Record<string, unknown> | Array<Record<string, unknown>>;

export class AppError extends Error {
  statusCode: number;
  code?: string;
  details?: ErrorDetails;
  isOperational = true;

  constructor(message: string, statusCode = 500, code?: string, details?: ErrorDetails) {
    super(message);
    this.name = "AppError";
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
  }
}
