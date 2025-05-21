import { cleanEnv, str } from 'envalid';
import 'dotenv/config';


export default abstract class EnrollmentEventHandler {
  public async getEnv(): Promise<{
    CLASS_ASSIGNMENT_TABLE: string,
    USER_ASSIGNMENT_TABLE: string,
    COURSE_SCHEDULE_TABLE: string,
    USER_SCHEDULE_TABLE: string,
    CLASS_TABLE: string,
    ENROLLMENT_TABLE: string
  }> {
    return cleanEnv(process.env, {
      CLASS_ASSIGNMENT_TABLE: str(),
      USER_ASSIGNMENT_TABLE: str(),
      COURSE_SCHEDULE_TABLE: str(),
      USER_SCHEDULE_TABLE: str(),
      CLASS_TABLE: str(),
      ENROLLMENT_TABLE: str(),
    });
  }
};