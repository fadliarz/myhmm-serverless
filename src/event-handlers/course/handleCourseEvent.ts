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
      const courseDeletedEvent: CourseDeletedEvent = new CourseDeletedEvent({ OldImage: unmarshall(OldImage) as any });
      console.info('[Handler] Handling CourseDeletedEvent:', JSON.stringify(courseDeletedEvent));
      await courseDeletedEventHandler.handle(courseDeletedEvent);
      console.info('[Handler] Handled CourseDeletedEvent:', JSON.stringify(courseDeletedEvent));
    } else {
      throw new Error(`[Handler] Event name "${eventName}" is not supported`);
    }
  }
};