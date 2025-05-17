import { DynamoDBDocumentClient, PutCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';
import generateDynamoDBDocumentClient from '../../../common/generateDynamoDBDocumentClient';
import ScholarshipEventHandler from '../ScholarshipEventHandler';
import ScholarshipEntity from '../../../common/entity/ScholarshipEntity';
import ScholarshipCreatedEvent from '../event/ScholarshipCreatedEvent';
import { ConditionalCheckFailedException } from '@aws-sdk/client-dynamodb';
import MaxRetriesException from '../../../common/MaxRetriesException';
import TimerService from '../../../common/TimerService';
import UserEntity from '../../../common/entity/UserEntity';
import NotificationEntity from '../../../common/entity/NotificationEntity';

export default class ScholarshipCreatedEventHandler extends ScholarshipEventHandler {
  private readonly dynamoDBDocumentClient: DynamoDBDocumentClient = generateDynamoDBDocumentClient();

  public async handle(scholarshipCreatedEvent: ScholarshipCreatedEvent) {
    const scholarshipEntity: ScholarshipEntity = scholarshipCreatedEvent.data.NewImage;
    await this.createNotifications({ scholarshipEntity });
  }

  public async createNotifications(param: { scholarshipEntity: ScholarshipEntity }) {
    const { scholarshipEntity } = param;
    const env = await this.getEnv();
    let lastEvaluatedKey: Record<string, any> | undefined = undefined;
    do {
      const { Items: userEntities, LastEvaluatedKey } = await this.dynamoDBDocumentClient.send(new QueryCommand({
        TableName: env.USER_TABLE,
        KeyConditionExpression: '#id = :value0',
        ExpressionAttributeNames: {
          '#id': 'id',
        },
        ExpressionAttributeValues: {
          ':value0': 'USER',
        },
        ExclusiveStartKey: lastEvaluatedKey,
        ProjectionExpression: 'id, userId',
      }));
      console.info(`[ScholarshipCreatedEventHandler:createNotifications] Retrieved ${userEntities?.length ?? 0} users`);
      if (userEntities) {
        for (const userEntity of userEntities as UserEntity[]) {
          const notificationEntity: NotificationEntity = new NotificationEntity();
          notificationEntity.userId = userEntity.userId;
          notificationEntity.notificationId = scholarshipEntity.scholarshipId;
          notificationEntity.redirect = `/scholarships/${scholarshipEntity.scholarshipId}`;
          notificationEntity.isSeen = false;
          notificationEntity.title = scholarshipEntity.title;
          notificationEntity.description = scholarshipEntity.description;
          await this.createNotification({
            notificationEntity,
          });
        }
      }
      lastEvaluatedKey = LastEvaluatedKey as any;
    } while (lastEvaluatedKey);
  }

  private async createNotification(param: {
    notificationEntity: NotificationEntity,
  }): Promise<void> {
    const env = await this.getEnv();
    let RETRIES: number = 0;
    const MAX_RETRIES: number = 3;
    while (RETRIES <= MAX_RETRIES) {
      try {
        await this.dynamoDBDocumentClient.send(new PutCommand({
          TableName: env.NOTIFICATION_TABLE,
          Item: param.notificationEntity,
          ConditionExpression: 'attribute_not_exists(userId) AND attribute_not_exists(notificationId)',
        }));
        return;
      } catch (exception) {
        if (exception instanceof ConditionalCheckFailedException) return;
        console.info('[ScholarshipCreatedEventHandler:createNotification] Exception thrown:', exception);
        console.info(`[ScholarshipCreatedEventHandler:createNotification] Attempting to retry (${RETRIES})...`);
        RETRIES++;
        if (RETRIES > MAX_RETRIES) {
          throw new MaxRetriesException(exception as Error);
        }
        await TimerService.sleepWith100MsBaseDelayExponentialBackoff(RETRIES);
      }
    }
  }


}