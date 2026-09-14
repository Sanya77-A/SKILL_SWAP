export class AIServiceError extends Error {
  constructor(code, message, { provider = "unknown", status = 500, retryable = false, cause } = {}) {
    super(message, { cause });
    this.name = "AIServiceError";
    this.code = code;
    this.provider = provider;
    this.status = status;
    this.retryable = retryable;
  }
}
