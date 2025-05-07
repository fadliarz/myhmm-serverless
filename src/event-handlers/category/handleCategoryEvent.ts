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
      await categoryDeletedEventHandler.handle(new CategoryDeletedEvent({ OldImage: unmarshall(OldImage) as any }));
    } else {
      throw new Error('@handleCategoryEvent * eventName is not supported');
    }
  }
};