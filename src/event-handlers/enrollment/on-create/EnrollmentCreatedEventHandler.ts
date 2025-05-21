import { DynamoDBDocumentClient, PutCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';
import generateDynamoDBDocumentClient from '../../../common/generateDynamoDBDocumentClient';
import { ConditionalCheckFailedException } from '@aws-sdk/client-dynamodb';
import TimerService from '../../../common/TimerService';
import MaxRetriesException from '../../../common/MaxRetriesException';
import EnrollmentEventHandler from '../EnrollmentEventHandler';
import EnrollmentCreatedEvent from '../event/EnrollmentCreatedEvent';
import EnrollmentEntity from '../../../common/entity/EnrollmentEntity';
import ClassAssignmentEntity from '../../../common/entity/ClassAssignmentEntity';
import UserAssignmentEntity from '../../../common/entity/UserAssignmentEntity';
import { CompletionStatus } from '../../../common/CompletionStatus';
import { AssignmentType } from '../../../common/AssignmentType';
import CourseScheduleEntity from '../../../common/entity/CourseScheduleEntity';
import UserScheduleEntity from '../../../common/entity/UserScheduleEntity';
import { ScheduleType } from '../../../common/ScheduleType';

export default class EnrollmentCreatedEventHandler extends EnrollmentEventHandler {
  private readonly dynamoDBDocumentClient: DynamoDBDocumentClient = generateDynamoDBDocumentClient();

  public async handle(enrollmentCreatedEvent: EnrollmentCreatedEvent) {
    const enrollmentEntity: EnrollmentEntity = enrollmentCreatedEvent.data.NewImage;
    await this.createUserAssignments({ userId: enrollmentEntity.userId, classId: enrollmentEntity.classId });
    await this.createUserSchedules({ userId: enrollmentEntity.userId, courseId: enrollmentEntity.courseId });
  }

  private async createUserAssignments(param: {
    userId: number,
    classId: number
  }): Promise<void> {
    const { userId, classId } = param;
    const env = await this.getEnv();
    let lastEvaluatedKey: Record<string, any> | undefined = undefined;
    do {
      const {
        Items: classAssignmentEntities,
        LastEvaluatedKey,
      } = await this.dynamoDBDocumentClient.send(new QueryCommand({
        TableName: env.CLASS_ASSIGNMENT_TABLE,
        KeyConditionExpression: '#classId = :value0',
        ExpressionAttributeNames: {
          '#classId': 'classId',
        },
        ExpressionAttributeValues: {
          ':value0': classId,
        },
        ExclusiveStartKey: lastEvaluatedKey,
      }));
      console.info(`[EnrollmentCreatedEventHandler] Retrieved ${classAssignmentEntities?.length ?? 0} class assignments`);
      if (classAssignmentEntities) {
        for (const classAssignmentEntity of classAssignmentEntities as ClassAssignmentEntity[]) {
          const userAssignmentEntity: UserAssignmentEntity = new UserAssignmentEntity();
          userAssignmentEntity.userId = userId;
          userAssignmentEntity.assignmentId = classAssignmentEntity.assignmentId;
          userAssignmentEntity.assignmentType = AssignmentType.CLASS_ASSIGNMENT;
          userAssignmentEntity.completionStatus = CompletionStatus.NOT_STARTED;
          userAssignmentEntity.createdAt = classAssignmentEntity.createdAt;
          userAssignmentEntity.classId = classAssignmentEntity.classId;
          await this.createUserAssignment({
            userAssignmentEntity,
          });
        }
      }
      lastEvaluatedKey = LastEvaluatedKey as any;
    } while (lastEvaluatedKey);

  }


  private async createUserAssignment(param: {
    userAssignmentEntity: UserAssignmentEntity
  }): Promise<void> {
    const env = await this.getEnv();
    let RETRIES: number = 0;
    const MAX_RETRIES: number = 3;
    while (RETRIES <= MAX_RETRIES) {
      try {
        await this.dynamoDBDocumentClient.send(new PutCommand({
          TableName: env.USER_ASSIGNMENT_TABLE,
          Item: param.userAssignmentEntity,
          ConditionExpression: 'attribute_not_exists(userId) AND attribute_not_exists(assignmentId)',
        }));
        return;
      } catch (exception) {
        if (exception instanceof ConditionalCheckFailedException) return;
        console.info('[EnrollmentCreatedEventHandler:createUserAssignment] Exception thrown:', exception);
        console.info(`[EnrollmentCreatedEventHandler:createUserAssignment] Attempting to retry (${RETRIES})...`);
        RETRIES++;
        if (RETRIES > MAX_RETRIES) {
          throw new MaxRetriesException(exception as Error);
        }
        await TimerService.sleepWith100MsBaseDelayExponentialBackoff(RETRIES);
      }
    }
  }

  private async createUserSchedules(param: {
    userId: number,
    courseId: number
  }): Promise<void> {
    const { userId, courseId } = param;
    const env = await this.getEnv();
    let lastEvaluatedKey: Record<string, any> | undefined = undefined;
    do {
      const {
        Items: courseScheduleEntities,
        LastEvaluatedKey,
      } = await this.dynamoDBDocumentClient.send(new QueryCommand({
        TableName: env.COURSE_SCHEDULE_TABLE,
        KeyConditionExpression: '#courseId = :value0',
        ExpressionAttributeNames: {
          '#courseId': 'courseId',
        },
        ExpressionAttributeValues: {
          ':value0': courseId,
        },
        ExclusiveStartKey: lastEvaluatedKey,
      }));
      console.info(`[EnrollmentCreatedEventHandler] Retrieved ${courseScheduleEntities?.length ?? 0} course schedules`);
      if (courseScheduleEntities) {
        for (const courseScheduleEntity of courseScheduleEntities as CourseScheduleEntity[]) {
          const userScheduleEntity: UserScheduleEntity = new UserScheduleEntity();
          userScheduleEntity.userId = userId;
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
        console.info('[EnrollmentCreatedEventHandler:createUserSchedule] Exception thrown:', exception);
        console.info(`[EnrollmentCreatedEventHandler:createUserSchedule] Attempting to retry (${RETRIES})...`);
        RETRIES++;
        if (RETRIES > MAX_RETRIES) {
          throw new MaxRetriesException(exception as Error);
        }
        await TimerService.sleepWith100MsBaseDelayExponentialBackoff(RETRIES);
      }
    }
  }
}