import 'dotenv/config';
import { Context, SQSEvent, SQSHandler } from 'aws-lambda';
import { EventName } from '../../common/EventName';
import { unmarshall } from '@aws-sdk/util-dynamodb';
import ClassDeletedEventHandler from './on-delete/ClassDeletedEventHandler';
import ClassDeletedEvent from './event/ClassDeletedEvent';

export const handleClassEvent: SQSHandler = async (
  event: SQSEvent,
  context: Context,
): Promise<void> => {
  for (const record of event.Records) {
    const body = JSON.parse(record.body);
    const { eventName, dynamodb } = body;
    const { OldImage } = dynamodb;
    if (eventName === EventName.REMOVE) {
      const classDeletedEventHandler: ClassDeletedEventHandler = new ClassDeletedEventHandler();
      await classDeletedEventHandler.handle(new ClassDeletedEvent({ OldImage: unmarshall(OldImage) as any }));
    } else {
      throw new Error('@handleClassEvent * eventName is not supported');
    }
  }
};