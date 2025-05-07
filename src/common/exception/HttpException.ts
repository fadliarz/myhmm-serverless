export default class DomainException extends Error {
  public throwable: unknown;

  constructor(message: string, throwable: unknown = null) {
    super(message);
    this.throwable = throwable;
  }
}
