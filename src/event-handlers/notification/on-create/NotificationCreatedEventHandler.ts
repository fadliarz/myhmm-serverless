import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import generateDynamoDBDocumentClient from '../../../common/generateDynamoDBDocumentClient';
import NotificationCreatedEvent from '../event/NotificationCreatedEvent';
import NotificationEntity from '../../../common/entity/NotificationEntity';
import MaxRetriesException from '../../../common/MaxRetriesException';
import TimerService from '../../../common/TimerService';
import axios from 'axios';
import DomainException from '../../../common/exception/HttpException';
import PushObjectResponse from '../../../common/response/PushObjectResponse';
import NotificationEventHandler from '../NotificationEventHandler';

export default class NotificationCreatedEventHandler extends NotificationEventHandler {
  private readonly dynamoDBDocumentClient: DynamoDBDocumentClient = generateDynamoDBDocumentClient();

  public async handle(notificationCreatedEvent: NotificationCreatedEvent) {
    const notificationEntity: NotificationEntity = notificationCreatedEvent.data.NewImage;
    await this.sendNotification(notificationEntity);
  }

  private async sendNotification(notificationEntity: NotificationEntity) {
    const env = await this.getEnv();
    let RETRIES: number = 0;
    const MAX_RETRIES: number = 3;
    while (RETRIES <= MAX_RETRIES) {
      try {
        const response = await axios.get(`${env.API_URL}/api/v1/push-objects/${notificationEntity.userId}`);
        if (response.status != 200) {
          console.error('[NotificationCreatedEventHandler:sendNotification] response:', response);
          throw new DomainException('Failed fetching push objects!');
        }
        const pushObjectResponses: PushObjectResponse[] = response.data?.data;
        console.info('[NotificationCreatedEventHandler:sendNotification] push objects:', pushObjectResponses);
        for (const pushObjectResponse of pushObjectResponses) {
          const sendNotificationResponse = await axios.post(`${env.API_URL}/api/notification/send`, {
            title: notificationEntity.title,
            body: notificationEntity.description ?? '',
            image: 'https://myhmm-bucket.s3.ap-southeast-3.amazonaws.com/public/logo.png',
            icon: 'https://myhmm-bucket.s3.ap-southeast-3.amazonaws.com/public/logo.png',
            url: notificationEntity.redirect,
            pushObjectString: pushObjectResponse.pushObjectString,
          });
          if (sendNotificationResponse.status != 200) {
            console.error('[NotificationCreatedEventHandler:sendNotification] sendNotificationResponse:', sendNotificationResponse);
            throw new DomainException('Failed sending notification!');
          }
        }
        return;
      } catch (exception) {
        console.info('[NotificationCreatedEventHandler:sendNotification] Exception thrown:', exception);
        console.info(`[NotificationCreatedEventHandler:sendNotification] Attempting to retry (${RETRIES})...`);
        RETRIES++;
        if (RETRIES > MAX_RETRIES) {
          throw new MaxRetriesException(exception as Error);
        }
        await TimerService.sleepWith100MsBaseDelayExponentialBackoff(RETRIES);
      }
    }
  }
}