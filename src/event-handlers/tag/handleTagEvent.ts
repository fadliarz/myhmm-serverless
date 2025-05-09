import 'dotenv/config';
import { SQSEvent, SQSHandler } from 'aws-lambda';
import { EventName } from '../../common/EventName';
import { unmarshall } from '@aws-sdk/util-dynamodb';
import TagDeletedEventHandler from './on-delete/TagDeletedEventHandler';
import TagDeletedEvent from './event/TagDeletedEvent';

export const handleTagEvent: SQSHandler = async (
  event: SQSEvent,
): Promise<void> => {
  for (const record of event.Records) {
    const body = JSON.parse(record.body);
    const { eventName, dynamodb } = body;
    const { OldImage } = dynamodb;
    if (eventName === EventName.REMOVE) {
      const tagDeletedEventHandler: TagDeletedEventHandler = new TagDeletedEventHandler();
      const tagDeletedEvent: TagDeletedEvent = new TagDeletedEvent({ OldImage: unmarshall(OldImage) as any });
      console.info('[Handler] Handling TagDeletedEvent:', JSON.stringify(tagDeletedEvent));
      await tagDeletedEventHandler.handle(tagDeletedEvent);
      console.info('[Handler] Handled TagDeletedEvent:', JSON.stringify(tagDeletedEvent));
    } else {
      throw new Error(`[Handler] Event name "${eventName}" is not supported`);
    }
  }
};