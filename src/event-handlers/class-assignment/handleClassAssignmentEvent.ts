import 'dotenv/config';
import { Context, SQSEvent, SQSHandler } from 'aws-lambda';
import { cleanEnv, str } from 'envalid';
import { EventName } from '../../common/EventName';
import ClassAssignmentCreatedEventHandler from './on-create/ClassAssignmentCreatedEventHandler';
import ClassAssignmentDeletedEventHandler from './on-delete/ClassAssignmentDeletedEventHandler';
import { unmarshall } from '@aws-sdk/util-dynamodb';

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
    if (eventName === EventName.INSERT) {
      const classAssignmentCreatedEventHandler: ClassAssignmentCreatedEventHandler = new ClassAssignmentCreatedEventHandler();
      await classAssignmentCreatedEventHandler.handle({ NewImage: unmarshall(NewImage) as any, env });
    } else if (eventName === EventName.REMOVE) {
      const classAssignmentDeletedEventHandler: ClassAssignmentDeletedEventHandler = new ClassAssignmentDeletedEventHandler();
      await classAssignmentDeletedEventHandler.handle();
    } else {
      throw new Error('@handleClassAssignmentEvent * eventName is not supported');
    }
  }
};