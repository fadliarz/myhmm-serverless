import 'dotenv/config';
import { Context, SQSEvent, SQSHandler } from 'aws-lambda';
import { EventName } from '../../common/EventName';
import { unmarshall } from '@aws-sdk/util-dynamodb';
import EnrollmentCreatedEventHandler from './on-create/EnrollmentCreatedEventHandler';
import EnrollmentCreatedEvent from './event/EnrollmentCreatedEvent';

export const handleEnrollmentEvent: SQSHandler = async (
  event: SQSEvent,
  context: Context,
): Promise<void> => {
  for (const record of event.Records) {
    const body = JSON.parse(record.body);
    const { eventName, dynamodb } = body;
    const { NewImage, OldImage } = dynamodb;
    if (eventName === EventName.INSERT) {
      const enrollmentCreatedEventHandler: EnrollmentCreatedEventHandler = new EnrollmentCreatedEventHandler();
      await enrollmentCreatedEventHandler.handle(new EnrollmentCreatedEvent({ NewImage: unmarshall(NewImage) as any }));
    } else if (eventName === EventName.REMOVE) {
      
    } else {
      throw new Error('@handleClassAssignmentEvent * eventName is not supported');
    }
  }
};