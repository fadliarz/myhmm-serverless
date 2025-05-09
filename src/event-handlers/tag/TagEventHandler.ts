import { cleanEnv, str } from 'envalid';
import 'dotenv/config';


export default abstract class TagEventHandler {
  public async getEnv(): Promise<{ SCHOLARSHIP_TABLE: string, TAG_TABLE: string }> {
    return cleanEnv(process.env, {
      SCHOLARSHIP_TABLE: str(),
      TAG_TABLE: str(),
    });
  }
};