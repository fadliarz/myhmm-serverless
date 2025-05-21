import { DynamoDBDocumentClient, PutCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';
import generateDynamoDBDocumentClient from '../../../common/generateDynamoDBDocumentClient';
import { ConditionalCheckFailedException } from '@aws-sdk/client-dynamodb';
import TimerService from '../../../common/TimerService';
import MaxRetriesException from '../../../common/MaxRetriesException';
import CourseScheduleEventHandler from '../CourseScheduleEventHandler';
import CourseScheduleCreatedEvent from '../event/CourseScheduleCreatedEvent';
import CourseScheduleEntity from '../../../common/entity/CourseScheduleEntity';
import ClassEntity from '../../../common/entity/ClassEntity';
import EnrollmentEntity from '../../../common/entity/EnrollmentEntity';
import UserScheduleEntity from '../../../common/entity/UserScheduleEntity';
import { ScheduleType } from '../../../common/ScheduleType';

export default class CourseScheduleCreatedEventHandler extends CourseScheduleEventHandler {
  private readonly dynamoDBDocumentClient: DynamoDBDocumentClient = generateDynamoDBDocumentClient();

  public async handle(courseScheduleCreatedEvent: CourseScheduleCreatedEvent) {
    const courseScheduleEntity: CourseScheduleEntity = courseScheduleCreatedEvent.data.NewImage;
    await this.processUserSchedules({ courseScheduleEntity });
  }

  private async processUserSchedules(param: { courseScheduleEntity: CourseScheduleEntity }): Promise<void> {
    const { courseScheduleEntity } = param;
    const env = await this.getEnv();
    let lastEvaluatedKey: Record<string, any> | undefined = undefined;
    do {
      const { Items: classEntities, LastEvaluatedKey } = await this.dynamoDBDocumentClient.send(new QueryCommand({
        TableName: env.CLASS_TABLE,
        KeyConditionExpression: '#courseId = :value0',
        ExpressionAttributeNames: {
          '#courseId': 'courseId',
        },
        ExpressionAttributeValues: {
          ':value0': courseScheduleEntity.courseId,
        },
        ExclusiveStartKey: lastEvaluatedKey,
      }));
      console.info(`[CourseScheduleCreatedEventHandler:processUserSchedules] Retrieved ${classEntities?.length ?? 0} classes`);
      if (classEntities) {
        for (const classEntity of classEntities as ClassEntity[]) {
          await this.createUserSchedules({ courseScheduleEntity, classId: classEntity.classId });
        }
      }
      lastEvaluatedKey = LastEvaluatedKey as any;
    } while (lastEvaluatedKey);
  }

  private async createUserSchedules(param: {
    courseScheduleEntity: CourseScheduleEntity,
    classId: number
  }): Promise<void> {
    const { courseScheduleEntity, classId } = param;
    const env = await this.getEnv();
    let lastEvaluatedKey: Record<string, any> | undefined = undefined;
    do {
      const { Items: enrollmentEntities, LastEvaluatedKey } = await this.dynamoDBDocumentClient.send(new QueryCommand({
        TableName: env.ENROLLMENT_TABLE,
        IndexName: env.ENROLLMENT_TABLE_GSI,
        KeyConditionExpression: '#classId = :value0',
        ExpressionAttributeNames: {
          '#classId': 'classId',
        },
        ExpressionAttributeValues: {
          ':value0': classId,
        },
        ExclusiveStartKey: lastEvaluatedKey,
      }));
      console.info(`[CourseScheduleCreatedEventHandler:createUserSchedules] Retrieved ${enrollmentEntities?.length ?? 0} enrollments`);
      if (enrollmentEntities) {
        for (const enrollmentEntity of enrollmentEntities as EnrollmentEntity[]) {
          const userScheduleEntity: UserScheduleEntity = new UserScheduleEntity();
          userScheduleEntity.userId = enrollmentEntity.userId;
          userScheduleEntity.scheduleId = courseScheduleEntity.scheduleId;
          userScheduleEntity.scheduleType = ScheduleType.COURSE_SCHEDULE;
          userScheduleEntity.courseId = courseScheduleEntity.courseId;
          userScheduleEntity.courseScheduleId = courseScheduleEntity.scheduleId;
          await this.createUserSchedule({ userScheduleEntity });
        }
      }
      lastEvaluatedKey = LastEvaluatedKey as any;
    } while (lastEvaluatedKey);
  }


  private async createUserSchedule(param: {
    userScheduleEntity: UserScheduleEntity,
  }): Promise<void> {
    const env = await this.getEnv();
    let RETRIES: number = 0;
    const MAX_RETRIES: number = 3;
    while (RETRIES <= MAX_RETRIES) {
      try {
        await this.dynamoDBDocumentClient.send(new PutCommand({
          TableName: env.USER_SCHEDULE_TABLE,
          Item: param.userScheduleEntity,
          ConditionExpression: 'attribute_not_exists(userId) AND attribute_not_exists(scheduleId)',
        }));
        return;
      } catch (exception) {
        if (exception instanceof ConditionalCheckFailedException) return;
        console.info('[CourseScheduleCreatedEventHandler:createUserSchedule] Exception thrown:', exception);
        console.info(`[CourseScheduleCreatedEventHandler:createUserSchedule] Attempting to retry (${RETRIES})...`);
        RETRIES++;
        if (RETRIES > MAX_RETRIES) {
          throw new MaxRetriesException(exception as Error);
        }
        await TimerService.sleepWith100MsBaseDelayExponentialBackoff(RETRIES);
      }
    }
  }
}