import { cleanEnv, str } from 'envalid';
import 'dotenv/config';


export default abstract class LessonEventHandler {
  public async getEnv(): Promise<{ API_URL: string }> {
    return cleanEnv(process.env, {
      API_URL: str(),
    });
  }
};