import 'dotenv/config';
import { SQSEvent, SQSHandler } from 'aws-lambda';
import { EventName } from '../../common/EventName';
import { unmarshall } from '@aws-sdk/util-dynamodb';
import ScholarshipDeletedEventHandler from './on-delete/ScholarshipDeletedEventHandler';
import ScholarshipDeletedEvent from './event/ScholarshipDeletedEvent';

export const handleScholarshipEvent: SQSHandler = async (
  event: SQSEvent,
): Promise<void> => {
  for (const record of event.Records) {
    const body = JSON.parse(record.body);
    const { eventName, dynamodb } = body;
    const { OldImage } = dynamodb;
    if (eventName === EventName.REMOVE) {
      const scholarshipDeletedEventHandler: ScholarshipDeletedEventHandler = new ScholarshipDeletedEventHandler();
      const scholarshipDeletedEvent: ScholarshipDeletedEvent = new ScholarshipDeletedEvent({ OldImage: unmarshall(OldImage) as any });
      console.info('[Handler] Handling ScholarshipDeletedEvent:', JSON.stringify(scholarshipDeletedEvent));
      await scholarshipDeletedEventHandler.handle(scholarshipDeletedEvent);
      console.info('[Handler] Handled ScholarshipDeletedEvent:', JSON.stringify(scholarshipDeletedEvent));
    } else {
      throw new Error(`[Handler] Event name "${eventName}" is not supported`);
    }
  }
};