import 'dotenv/config';
import { SQSEvent, SQSHandler } from 'aws-lambda';
import { EventName } from '../../common/EventName';
import EnrollmentCreatedEventHandler from '../enrollment/on-create/EnrollmentCreatedEventHandler';
import EnrollmentCreatedEvent from '../enrollment/event/EnrollmentCreatedEvent';
import { unmarshall } from '@aws-sdk/util-dynamodb';
import EnrollmentDeletedEventHandler from '../enrollment/on-delete/EnrollmentDeletedEventHandler';
import EnrollmentDeletedEvent from '../enrollment/event/EnrollmentDeletedEvent';
import ClassAssignmentCreatedEventHandler from '../class-assignment/on-create/ClassAssignmentCreatedEventHandler';
import ClassAssignmentCreatedEvent from '../class-assignment/event/ClassAssignmentCreatedEvent';
import ClassAssignmentDeletedEventHandler from '../class-assignment/on-delete/ClassAssignmentDeletedEventHandler';
import ClassAssignmentDeletedEvent from '../class-assignment/event/ClassAssignmentDeletedEvent';

export const handleEnrollmentAndClassAssignmentEvent: SQSHandler = async (
  event: SQSEvent,
): Promise<void> => {
  for (const record of event.Records) {
    const body = JSON.parse(record.body);
    const { eventName, dynamodb } = body;
    const { Keys, NewImage, OldImage } = dynamodb;
    if ((Keys as object).hasOwnProperty('userId')) {
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
      return;
    }

    if (eventName === EventName.INSERT) {
      const classAssignmentCreatedEventHandler: ClassAssignmentCreatedEventHandler = new ClassAssignmentCreatedEventHandler();
      const classAssignmentCreatedEvent: ClassAssignmentCreatedEvent = new ClassAssignmentCreatedEvent({ NewImage: unmarshall(NewImage) as any });
      console.info('[Handler] Handling ClassAssignmentCreatedEvent:', JSON.stringify(classAssignmentCreatedEvent));
      await classAssignmentCreatedEventHandler.handle(classAssignmentCreatedEvent);
      console.info('[Handler] Handled ClassAssignmentCreatedEvent:', JSON.stringify(classAssignmentCreatedEvent));
    } else if (eventName === EventName.REMOVE) {
      const classAssignmentDeletedEventHandler: ClassAssignmentDeletedEventHandler = new ClassAssignmentDeletedEventHandler();
      const classAssignmentDeletedEvent: ClassAssignmentDeletedEvent = new ClassAssignmentDeletedEvent({ OldImage: unmarshall(OldImage) as any });
      console.info('[Handler] Handling ClassAssignmentDeletedEvent:', JSON.stringify(classAssignmentDeletedEvent));
      await classAssignmentDeletedEventHandler.handle(classAssignmentDeletedEvent);
      console.info('[Handler] Handled ClassAssignmentDeletedEvent:', JSON.stringify(classAssignmentDeletedEvent));
    } else {
      throw new Error(`[Handler] Event name "${eventName}" is not supported`);
    }
  }
};

