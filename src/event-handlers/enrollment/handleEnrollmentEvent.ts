import 'dotenv/config';
import { SQSEvent, SQSHandler } from 'aws-lambda';
import { EventName } from '../../common/EventName';
import { unmarshall } from '@aws-sdk/util-dynamodb';
import EnrollmentCreatedEventHandler from './on-create/EnrollmentCreatedEventHandler';
import EnrollmentCreatedEvent from './event/EnrollmentCreatedEvent';
import EnrollmentDeletedEventHandler from './on-delete/EnrollmentDeletedEventHandler';
import EnrollmentDeletedEvent from './event/EnrollmentDeletedEvent';

export const handleEnrollmentEvent: SQSHandler = async (
  event: SQSEvent,
): Promise<void> => {
  for (const record of event.Records) {
    const body = JSON.parse(record.body);
    const { eventName, dynamodb } = body;
    const { NewImage, OldImage } = dynamodb;
    if (eventName === EventName.INSERT) {
      const enrollmentCreatedEventHandler: EnrollmentCreatedEventHandler = new EnrollmentCreatedEventHandler();
      const enrollmentCreatedEvent: EnrollmentCreatedEvent = new EnrollmentCreatedEvent({ NewImage: unmarshall(NewImage) as any });
      console.info('[Handler] Handling EnrollmentCreatedEvent:', JSON.stringify(enrollmentCreatedEvent));
      await enrollmentCreatedEventHandler.handle(enrollmentCreatedEvent);
      console.info('[Handler] Handled EnrollmentCreatedEvent:', JSON.stringify(enrollmentCreatedEvent));
    } else if (eventName === EventName.REMOVE) {
      const enrollmentDeletedEventHandler: EnrollmentDeletedEventHandler = new EnrollmentDeletedEventHandler();
      const enrollmentDeletedEvent: EnrollmentDeletedEvent = new EnrollmentDeletedEvent({ OldImage: unmarshall(OldImage) as any });
      console.info('[Handler] Handling EnrollmentDeletedEvent:', JSON.stringify(enrollmentDeletedEvent));
      await enrollmentDeletedEventHandler.handle(enrollmentDeletedEvent);
      console.info('[Handler] Handled EnrollmentDeletedEvent:', JSON.stringify(enrollmentDeletedEvent));
    } else {
      throw new Error(`[Handler] Event name "${eventName}" is not supported`);
    }
  }
};