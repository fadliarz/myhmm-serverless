import 'dotenv/config';
import { SQSEvent, SQSHandler } from 'aws-lambda';
import { EventName } from '../../common/EventName';
import ClassAssignmentCreatedEventHandler from './on-create/ClassAssignmentCreatedEventHandler';
import ClassAssignmentDeletedEventHandler from './on-delete/ClassAssignmentDeletedEventHandler';
import { unmarshall } from '@aws-sdk/util-dynamodb';
import ClassAssignmentCreatedEvent from './event/ClassAssignmentCreatedEvent';
import ClassAssignmentDeletedEvent from './event/ClassAssignmentDeletedEvent';

export const handleClassAssignmentEvent: SQSHandler = async (
  event: SQSEvent,
): Promise<void> => {
  for (const record of event.Records) {
    const body = JSON.parse(record.body);
    const { eventName, dynamodb } = body;
    const { NewImage, OldImage } = dynamodb;
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