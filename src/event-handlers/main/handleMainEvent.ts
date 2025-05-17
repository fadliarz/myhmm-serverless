import 'dotenv/config';
import { SQSEvent, SQSHandler } from 'aws-lambda';
import { EventName } from '../../common/EventName';
import { unmarshall } from '@aws-sdk/util-dynamodb';
import NotificationCreatedEventHandler from '../notification/on-create/NotificationCreatedEventHandler';
import NotificationCreatedEvent from '../notification/event/NotificationCreatedEvent';

export const handleMainEvent: SQSHandler = async (
  event: SQSEvent,
): Promise<void> => {
  for (const record of event.Records) {
    const body = JSON.parse(record.body);
    const { eventName, dynamodb } = body;
    const { Keys, NewImage, OldImage } = dynamodb;

    if ((Keys as object).hasOwnProperty('userId') && (Keys as object).hasOwnProperty('notificationId')) {
      if (eventName === EventName.INSERT) {
        const notificationCreatedEventHandler: NotificationCreatedEventHandler = new NotificationCreatedEventHandler();
        const notificationCreatedEvent: NotificationCreatedEvent = new NotificationCreatedEvent({ NewImage: unmarshall(NewImage) as any });
        console.info('[Handler] Handling NotificationCreatedEvent:', JSON.stringify(notificationCreatedEvent));
        await notificationCreatedEventHandler.handle(notificationCreatedEvent);
        console.info('[Handler] Handled NotificationCreatedEvent:', JSON.stringify(notificationCreatedEvent));
      } else {
        throw new Error(`[Handler] Event name "${eventName}" is not supported`);
      }
      return;
    }
  }
};

