import { cleanEnv, str } from 'envalid';
import 'dotenv/config';

export default abstract class ClassEventHandler {
  public async getEnv(): Promise<{
    CLASS_ASSIGNMENT_TABLE: string,
    ENROLLMENT_TABLE: string,
    ENROLLMENT_TABLE_GSI: string,
    INSTRUCTOR_TABLE: string
    INSTRUCTOR_TABLE_GSI: string
    COURSE_TABLE: string,
    USER_TABLE: string,
  }> {
    return cleanEnv(process.env, {
      CLASS_ASSIGNMENT_TABLE: str(),
      ENROLLMENT_TABLE: str(),
      ENROLLMENT_TABLE_GSI: str(),
      INSTRUCTOR_TABLE: str(),
      INSTRUCTOR_TABLE_GSI: str(),
      COURSE_TABLE: str(),
      USER_TABLE: str(),
    });
  }
};