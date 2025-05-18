export default class Utils {

  public static dateToWIBString(date: Date | string): string {
    const formatter = new Intl.DateTimeFormat('id-ID', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'Asia/Jakarta',
      hour12: false,
    });

    const formattedDate = formatter.format(new Date(date));
    return `${formattedDate} (WIB)`;
  }
}