export default class MaxRetriesException extends Error {
  constructor() {
    super('Max retries exceeded');
  }
}