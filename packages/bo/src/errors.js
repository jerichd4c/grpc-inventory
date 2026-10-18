// Error for broken business rules. Its code tells the caller what happened:
// INVALID_INPUT, NOT_FOUND, DUPLICATE or INSUFFICIENT_STOCK.
export class BusinessError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'BusinessError';
    this.code = code;
  }
}
