import { cleanEnv, str } from 'envalid';
import 'dotenv/config';


export default abstract class CategoryEventHandler {
  public async getEnv(): Promise<{ CATEGORY_TABLE: string, COURSE_TABLE: string }> {
    return cleanEnv(process.env, {
      COURSE_TABLE: str(),
      CATEGORY_TABLE: str(),
    });
  }
};