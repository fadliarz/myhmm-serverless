export default class MaxRetriesException extends Error {
  constructor(throwable?: Error) {
    console.error('MaxRetriesException * throwable:', throwable);
    super('Max retries exceeded');
  }
}