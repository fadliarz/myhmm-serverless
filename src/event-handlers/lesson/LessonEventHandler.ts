import { cleanEnv, str } from 'envalid';
import 'dotenv/config';


export default abstract class LessonEventHandler {
  public async getEnv(): Promise<{ VIDEO_TABLE: string, ATTACHMENT_TABLE: string, COURSE_TABLE: string }> {
    return cleanEnv(process.env, {
      VIDEO_TABLE: str(),
      ATTACHMENT_TABLE: str(),
      COURSE_TABLE: str(),
    });
  }
};