import { cleanEnv, str } from 'envalid';
import 'dotenv/config';


export default abstract class ClassAssignmentEventHandler {
  public async getEnv(): Promise<{ ENROLLMENT_TABLE: string, USER_ASSIGNMENT_TABLE: string }> {
    return cleanEnv(process.env, {
      ENROLLMENT_TABLE: str(),
      USER_ASSIGNMENT_TABLE: str(),
    });
  }
};