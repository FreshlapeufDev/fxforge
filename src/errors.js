export class FxError extends Error {
  constructor(message, hint) {
    super(message);
    this.name = 'FxError';
    this.hint = hint;
  }
}
