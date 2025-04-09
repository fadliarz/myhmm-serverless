export default class TimerService {
  public static async sleepWith1000MsBaseDelayExponentialBackoff(
    attempt: number,
  ): Promise<void> {
    return new Promise((resolve) => {
      setTimeout(
        () => {
          resolve();
        },
        1000 + Math.pow(2, attempt) + Math.floor(Math.random() * 1000),
      );
    });
  }
}
