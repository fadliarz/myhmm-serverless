export default abstract class DomainEvent<T extends object> {
  private readonly _data: T;

  public constructor(data: T) {
    this._data = data;
  }

  get data(): T {
    return this._data;
  }
}