import 'dotenv/config';
import { SQSEvent, SQSHandler } from 'aws-lambda';
import { EventName } from '../../common/EventName';
import { unmarshall } from '@aws-sdk/util-dynamodb';
import ScholarshipDeletedEventHandler from './on-delete/ScholarshipDeletedEventHandler';
import ScholarshipDeletedEvent from './event/ScholarshipDeletedEvent';
import ScholarshipCreatedEventHandler from './on-create/ScholarshipCreatedEventHandler';
import ScholarshipCreatedEvent from './event/ScholarshipCreatedEvent';

export const handleScholarshipEvent: SQSHandler = async (
  event: SQSEvent,
): Promise<void> => {
  for (const record of event.Records) {
    const body = JSON.parse(record.body);
    const { eventName, dynamodb } = body;
    const { OldImage, NewImage } = dynamodb;
    if (eventName === EventName.REMOVE) {
      const scholarshipDeletedEventHandler: ScholarshipDeletedEventHandler = new ScholarshipDeletedEventHandler();
      const scholarshipDeletedEvent: ScholarshipDeletedEvent = new ScholarshipDeletedEvent({ OldImage: unmarshall(OldImage) as any });
      console.info('[Handler] Handling ScholarshipDeletedEvent:', JSON.stringify(scholarshipDeletedEvent));
      await scholarshipDeletedEventHandler.handle(scholarshipDeletedEvent);
      console.info('[Handler] Handled ScholarshipDeletedEvent:', JSON.stringify(scholarshipDeletedEvent));
    } else if (eventName === EventName.INSERT) {
      const scholarshipCreatedEventhandler: ScholarshipCreatedEventHandler = new ScholarshipCreatedEventHandler();
      const scholarshipCreatedEvent: ScholarshipCreatedEvent = new ScholarshipCreatedEvent({ NewImage: unmarshall(NewImage) as any });
      console.info('[Handler] Handling ScholarshipCreatedEvent:', JSON.stringify(scholarshipCreatedEvent));
      await scholarshipCreatedEventhandler.handle(scholarshipCreatedEvent);
      console.info('[Handler] Handled ScholarshipCreatedEvent:', JSON.stringify(scholarshipCreatedEvent));

    } else {
      throw new Error(`[Handler] Event name "${eventName}" is not supported`);
    }
  }
};