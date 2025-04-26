import 'dotenv/config';
import { Context, SQSEvent, SQSHandler } from 'aws-lambda';
import { EventName } from '../../common/EventName';
import { unmarshall } from '@aws-sdk/util-dynamodb';
import LessonDeletedEventHandler from './on-delete/LessonDeletedEventHandler';
import LessonDeletedEvent from './event/LessonDeletedEvent';

export const handleLessonEvent: SQSHandler = async (
  event: SQSEvent,
  context: Context,
): Promise<void> => {
  for (const record of event.Records) {
    const body = JSON.parse(record.body);
    const { eventName, dynamodb } = body;
    const { OldImage } = dynamodb;
    if (eventName === EventName.REMOVE) {
      const lessonDeletedEventHandler: LessonDeletedEventHandler = new LessonDeletedEventHandler();
      await lessonDeletedEventHandler.handle(new LessonDeletedEvent({ OldImage: unmarshall(OldImage) as any }));
    } else {
      throw new Error('@handleLessonEvent * eventName is not supported');
    }
  }
};