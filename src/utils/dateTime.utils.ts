export class DateTimeUtils {
  static setUTCDayBoundaries(date: Date): { startOfDay: Date; endOfDay: Date } {
    const startOfDay = new Date(date);
    startOfDay.setUTCHours(0, 0, 0, 0);
    const endOfDay = new Date(date);
    endOfDay.setUTCHours(23, 59, 59, 999);
    return { startOfDay, endOfDay };
  }

  static combineDateTime(dateStr: string, timeStr: string): Date {
    const [hours, minutes] = timeStr.split(":").map(Number);
    const date = new Date(dateStr);
    date.setUTCHours(hours, minutes, 0, 0);
    return date;
  }

  static toUTCDateTime(dateTimeStr: string): Date {
    return new Date(dateTimeStr);
  }
}
