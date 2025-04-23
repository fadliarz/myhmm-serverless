import { cleanEnv, str } from 'envalid';
import 'dotenv/config';


export default abstract class EnrollmentEventHandler {
  public async getEnv(): Promise<{ CLASS_ASSIGNMENT_TABLE: string, USER_ASSIGNMENT_TABLE: string }> {
    return cleanEnv(process.env, {
      CLASS_ASSIGNMENT_TABLE: str(),
      USER_ASSIGNMENT_TABLE: str(),
    });
  }
};