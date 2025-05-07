import 'dotenv/config';
import { SQSEvent, SQSHandler } from 'aws-lambda';
import { EventName } from '../../common/EventName';
import { unmarshall } from '@aws-sdk/util-dynamodb';
import CourseDeletedEventHandler from './on-delete/CourseDeletedEventHandler';
import CourseDeletedEvent from './event/CourseDeletedEvent';

export const handleCourseEvent: SQSHandler = async (
  event: SQSEvent,
): Promise<void> => {
  for (const record of event.Records) {
    const body = JSON.parse(record.body);
    const { eventName, dynamodb } = body;
    const { OldImage } = dynamodb;
    if (eventName === EventName.REMOVE) {
      const courseDeletedEventHandler: CourseDeletedEventHandler = new CourseDeletedEventHandler();
      await courseDeletedEventHandler.handle(new CourseDeletedEvent({ OldImage: unmarshall(OldImage) as any }));
    } else {
      throw new Error('@handleCourseEvent * eventName is not supported');
    }
  }
};