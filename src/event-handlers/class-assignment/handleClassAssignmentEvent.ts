import 'dotenv/config';
import { Context, SQSEvent, SQSHandler } from 'aws-lambda';
import { unmarshall } from '@aws-sdk/util-dynamodb';
import { cleanEnv, str } from 'envalid';

export const handleClassAssignmentEvent: SQSHandler = async (
  event: SQSEvent,
  context: Context,
): Promise<void> => {
  let env: { ENROLLMENT_TABLE: string, USER_ASSIGNMENT_TABLE: string };
  try {
    env = cleanEnv(process.env, {
      ENROLLMENT_TABLE: str(),
      USER_ASSIGNMENT_TABLE: str(),
    });
  } catch (exception) {
    console.error('@handleClassAssignmentEvent * failed validating env variables:', exception);
    console.error('@handleClassAssignmentEvent * process.env:', process.env);
    throw exception;
  }

  for (const record of event.Records) {
    const body = JSON.parse(record.body);
    const { eventName, dynamodb } = body;
    const { Keys, NewImage, OldImage } = dynamodb;
    console.log('@handleClassAssignmentEvent * record:', record);
    console.log('@handleClassAssignmentEvent * eventName:', eventName);
    console.log('@handleClassAssignmentEvent * body:', body);
    console.log('@handleClassAssignmentEvent * unmarshalled Keys:', unmarshall(Keys) ?? {});
    console.log('@handleClassAssignmentEvent * unmarshalled NewImage:', unmarshall(NewImage ?? {}));
    console.log('@handleClassAssignmentEvent * unmarshalled OldImage:', unmarshall(OldImage ?? {}));
  }
};