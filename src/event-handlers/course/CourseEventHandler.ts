import { cleanEnv, str } from 'envalid';
import 'dotenv/config';


export default abstract class CourseEventHandler {
  public async getEnv(): Promise<{ LESSON_TABLE: string, CLASS_TABLE: string, CATEGORY_TABLE: string }> {
    return cleanEnv(process.env, {
      LESSON_TABLE: str(),
      CLASS_TABLE: str(),
      CATEGORY_TABLE: str(),
    });
  }
};