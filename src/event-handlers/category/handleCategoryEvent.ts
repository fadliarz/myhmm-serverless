import 'dotenv/config';
import { SQSEvent, SQSHandler } from 'aws-lambda';
import { EventName } from '../../common/EventName';
import { unmarshall } from '@aws-sdk/util-dynamodb';
import CategoryDeletedEventHandler from './on-delete/CategoryDeletedEventHandler';
import CategoryDeletedEvent from './event/CategoryDeletedEvent';

export const handleCategoryEvent: SQSHandler = async (
  event: SQSEvent,
): Promise<void> => {
  for (const record of event.Records) {
    const body = JSON.parse(record.body);
    const { eventName, dynamodb } = body;
    const { OldImage } = dynamodb;
    if (eventName === EventName.REMOVE) {
      const categoryDeletedEventHandler: CategoryDeletedEventHandler = new CategoryDeletedEventHandler();
      const categoryDeletedEvent: CategoryDeletedEvent = new CategoryDeletedEvent({ OldImage: unmarshall(OldImage) as any });
      console.info('[Handler] Handling CategoryDeletedEvent:', JSON.stringify(categoryDeletedEvent));
      await categoryDeletedEventHandler.handle(categoryDeletedEvent);
      console.info('[Handler] Handled CategoryDeletedEvent:', JSON.stringify(categoryDeletedEvent));
    } else {
      throw new Error(`[Handler] Event name "${eventName}" is not supported`);
    }
  }
};