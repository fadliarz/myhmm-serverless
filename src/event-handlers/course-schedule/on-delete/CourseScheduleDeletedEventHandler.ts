import { DeleteCommand, DynamoDBDocumentClient, QueryCommand } from '@aws-sdk/lib-dynamodb';
import generateDynamoDBDocumentClient from '../../../common/generateDynamoDBDocumentClient';
import TimerService from '../../../common/TimerService';
import MaxRetriesException from '../../../common/MaxRetriesException';
import CourseScheduleEventHandler from '../CourseScheduleEventHandler';
import CourseScheduleEntity from '../../../common/entity/CourseScheduleEntity';
import UserScheduleEntity from '../../../common/entity/UserScheduleEntity';
import CourseScheduleDeletedEvent from '../event/CourseScheduleDeletedEvent';

export default class CourseScheduleDeletedEventHandler extends CourseScheduleEventHandler {
  private readonly dynamoDBDocumentClient: DynamoDBDocumentClient = generateDynamoDBDocumentClient();

  public async handle(courseScheduleDeletedEvent: CourseScheduleDeletedEvent) {
    const courseScheduleEntity: CourseScheduleEntity = courseScheduleDeletedEvent.data.OldImage;
    await this.deleteUserSchedules({ courseScheduleEntity });
  }

  private async deleteUserSchedules(param: { courseScheduleEntity: CourseScheduleEntity }): Promise<void> {
    const { courseScheduleEntity } = param;
    const env = await this.getEnv();
    let lastEvaluatedKey: Record<string, any> | undefined = undefined;
    do {
      const {
        Items: userScheduleEntities,
        LastEvaluatedKey,
      } = await this.dynamoDBDocumentClient.send(new QueryCommand({
        TableName: env.USER_SCHEDULE_TABLE,
        IndexName: env.USER_SCHEDULE_TABLE_GSI,
        KeyConditionExpression: '#scheduleId = :value0',
        ExpressionAttributeNames: {
          '#scheduleId': 'scheduleId',
        },
        ExpressionAttributeValues: {
          ':value0': courseScheduleEntity.scheduleId,
        },
        ExclusiveStartKey: lastEvaluatedKey,
      }));
      console.info(`[CourseScheduleDeletedEventHandler:deleteUserSchedules] Retrieved ${userScheduleEntities?.length ?? 0} schedules`);
      if (userScheduleEntities) {
        for (const userScheduleEntity of userScheduleEntities as UserScheduleEntity[]) {
          await this.deleteUserSchedule({
            key: {
              userId: userScheduleEntity.userId,
              scheduleId: userScheduleEntity.scheduleId,
            },
          });
        }
      }
      lastEvaluatedKey = LastEvaluatedKey as any;
    } while (lastEvaluatedKey);
  }

  private async deleteUserSchedule(param: {
    key: {
      userId: number,
      scheduleId: number
    }
  }): Promise<void> {
    const env = await this.getEnv();
    let RETRIES: number = 0;
    const MAX_RETRIES: number = 3;
    while (RETRIES <= MAX_RETRIES) {
      try {
        await this.dynamoDBDocumentClient.send(new DeleteCommand({
          TableName: env.USER_SCHEDULE_TABLE,
          Key: param.key,
        }));
        return;
      } catch (exception) {
        console.info('[CourseScheduleDeletedEventHandler:deleteUserSchedule] Exception thrown:', exception);
        console.info(`[CourseScheduleDeletedEventHandler:deleteUserSchedule] Attempting to retry (${RETRIES})...`);
        RETRIES++;
        if (RETRIES > MAX_RETRIES) {
          throw new MaxRetriesException(exception as Error);
        }
        await TimerService.sleepWith100MsBaseDelayExponentialBackoff(RETRIES);
      }
    }
  }
}