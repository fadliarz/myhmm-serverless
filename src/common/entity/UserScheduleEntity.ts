import { ScheduleType } from '../ScheduleType';

export default class UserScheduleEntity {
  public userId!: number;
  public scheduleId!: number;
  public scheduleType!: ScheduleType;
  public courseId!: number;
  public courseScheduleId!: number;
}
