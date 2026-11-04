/**
 * Carries a status code, a machine readable code and optional details so the
 * service can refuse a request without knowing HTTP, and `handleErrors` can
 * answer with one predictable JSON shape.
 */
export class AppError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details?: Record<string, unknown>;

  constructor(
    status: number,
    code: string,
    message: string,
    details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "AppError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}
