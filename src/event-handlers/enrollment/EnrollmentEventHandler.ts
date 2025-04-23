export default abstract class EnrollmentEventHandler {
  public async getEnv(): Promise<{ CLASS_ASSIGNMENT_TABLE: string, USER_ASSIGNMENT_TABLE: string }> {
    return {
      CLASS_ASSIGNMENT_TABLE: process.env.CLASS_ASSIGNMENT_TABLE ?? '',
      USER_ASSIGNMENT_TABLE: process.env.USER_ASSIGNMENT_TABLE ?? '',
    };
  }
};