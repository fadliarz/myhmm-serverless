import { cleanEnv, str } from 'envalid';
import 'dotenv/config';


export default abstract class CourseScheduleEventHandler {
  public async getEnv(): Promise<{
    CLASS_TABLE: string,
    ENROLLMENT_TABLE: string,
    ENROLLMENT_TABLE_GSI: string,
    USER_SCHEDULE_TABLE: string,
    USER_SCHEDULE_TABLE_GSI: string
  }> {
    return cleanEnv(process.env, {
      CLASS_TABLE: str(),
      ENROLLMENT_TABLE: str(),
      ENROLLMENT_TABLE_GSI: str(),
      USER_SCHEDULE_TABLE: str(),
      USER_SCHEDULE_TABLE_GSI: str(),
    });
  }
};