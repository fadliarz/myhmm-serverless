import { cleanEnv, str } from 'envalid';
import 'dotenv/config';


export default abstract class ScholarshipEventHandler {
  public async getEnv(): Promise<{ TAG_TABLE: string, NOTIFICATION_TABLE: string, USER_TABLE: string }> {
    return cleanEnv(process.env, {
      TAG_TABLE: str(),
      NOTIFICATION_TABLE: str(),
      USER_TABLE: str(),
    });
  }
};