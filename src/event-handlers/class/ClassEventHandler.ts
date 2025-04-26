import { cleanEnv, str } from 'envalid';
import 'dotenv/config';


export default abstract class ClassEventHandler {
  public async getEnv(): Promise<{ CLASS_ASSIGNMENT: string }> {
    return cleanEnv(process.env, {
      CLASS_ASSIGNMENT: str(),
    });
  }
};