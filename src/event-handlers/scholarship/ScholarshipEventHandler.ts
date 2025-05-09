import { cleanEnv, str } from 'envalid';
import 'dotenv/config';


export default abstract class ScholarshipEventHandler {
  public async getEnv(): Promise<{ TAG_TABLE: string }> {
    return cleanEnv(process.env, {
      TAG_TABLE: str(),
    });
  }
};