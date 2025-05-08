export default class TimerService {
  public static async sleepWith100MsBaseDelayExponentialBackoff(
    attempt: number,
  ): Promise<void> {
    return new Promise((resolve) => {
      setTimeout(
        () => {
          resolve();
        },
        100 * Math.pow(2, attempt) + Math.floor(Math.random() * 100),
      );
    });
  }
}
