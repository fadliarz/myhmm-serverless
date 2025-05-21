import { DeleteCommand, DynamoDBDocumentClient, GetCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';
import generateDynamoDBDocumentClient from '../../../common/generateDynamoDBDocumentClient';
import TimerService from '../../../common/TimerService';
import MaxRetriesException from '../../../common/MaxRetriesException';
import EnrollmentEventHandler from '../EnrollmentEventHandler';
import EnrollmentEntity from '../../../common/entity/EnrollmentEntity';
import EnrollmentDeletedEvent from '../event/EnrollmentDeletedEvent';
import ClassAssignmentEntity from '../../../common/entity/ClassAssignmentEntity';
import CourseScheduleEntity from '../../../common/entity/CourseScheduleEntity';
import ClassEntity from '../../../common/entity/ClassEntity';
import EnrollmentKey from '../../../common/entity/EnrollmentKey';

export default class EnrollmentDeletedEventHandler extends EnrollmentEventHandler {
  private readonly dynamoDBDocumentClient: DynamoDBDocumentClient = generateDynamoDBDocumentClient();

  public async handle(enrollmentDeletedEvent: EnrollmentDeletedEvent) {
    const deletedEnrollmentEntity: EnrollmentEntity = enrollmentDeletedEvent.data.OldImage;
    await this.deleteUserAssignments({
      userId: deletedEnrollmentEntity.userId,
      classId: deletedEnrollmentEntity.classId,
    });
    if (await this.shouldDeleteUserSchedules({
      userId: deletedEnrollmentEntity.userId,
      courseId: deletedEnrollmentEntity.courseId,
    })) {
      await this.deleteUserSchedules({
        userId: deletedEnrollmentEntity.userId,
        courseId: deletedEnrollmentEntity.courseId,
      });
    }
  }

  private async deleteUserAssignments(param: { userId: number, classId: number }): Promise<void> {
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
      console.info(`[EnrollmentDeletedEventHandler] Retrieved ${classAssignmentEntities?.length ?? 0} class assignments`);
      if (classAssignmentEntities) {
        for (const classAssignmentEntity of classAssignmentEntities as ClassAssignmentEntity[]) {
          await this.deleteUserAssignment({
            key: {
              userId,
              assignmentId: classAssignmentEntity.assignmentId,
            },
          });
        }
      }
      lastEvaluatedKey = LastEvaluatedKey as any;
    } while (lastEvaluatedKey);
  }

  private async deleteUserAssignment(param: {
    key: {
      userId: number,
      assignmentId: number
    }
  }): Promise<void> {
    const env = await this.getEnv();
    let RETRIES: number = 0;
    const MAX_RETRIES: number = 3;
    while (RETRIES <= MAX_RETRIES) {
      try {
        await this.dynamoDBDocumentClient.send(new DeleteCommand({
          TableName: env.USER_ASSIGNMENT_TABLE,
          Key: param.key,
        }));
        return;
      } catch (exception) {
        console.info('[EnrollmentDeletedEventHandler:deleteUserAssignment] Exception thrown:', exception);
        console.info(`[EnrollmentDeletedEventHandler:deleteUserAssignment] Attempting to retry (${RETRIES})...`);
        RETRIES++;
        if (RETRIES > MAX_RETRIES) {
          throw new MaxRetriesException(exception as Error);
        }
        await TimerService.sleepWith100MsBaseDelayExponentialBackoff(RETRIES);
      }
    }
  }

  private async shouldDeleteUserSchedules(param: { userId: number, courseId: number }): Promise<boolean> {
    const { userId, courseId } = param;
    const env = await this.getEnv();
    let lastEvaluatedKey: Record<string, any> | undefined = undefined;
    do {
      const {
        Items: classEntities,
        LastEvaluatedKey,
      } = await this.dynamoDBDocumentClient.send(new QueryCommand({
        TableName: env.CLASS_TABLE,
        KeyConditionExpression: '#courseId = :value0',
        ExpressionAttributeNames: {
          '#courseId': 'courseId',
        },
        ExpressionAttributeValues: {
          ':value0': courseId,
        },
        ExclusiveStartKey: lastEvaluatedKey,
      }));
      console.info(`[EnrollmentDeletedEventHandler] Retrieved ${classEntities?.length ?? 0} classes`);
      if (classEntities) {
        for (const classEntity of classEntities as ClassEntity[]) {
          const response = await this.dynamoDBDocumentClient.send(
            new GetCommand({
              TableName: env.ENROLLMENT_TABLE,
              Key: new EnrollmentKey({ userId, classId: classEntity.classId }),
            }),
          );
          if (response.Item) return false;
        }
      }
      lastEvaluatedKey = LastEvaluatedKey as any;
    } while (lastEvaluatedKey);
    return true;
  }

  private async deleteUserSchedules(param: { userId: number, courseId: number }): Promise<void> {
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
      console.info(`[EnrollmentDeletedEventHandler] Retrieved ${courseScheduleEntities?.length ?? 0} course schedules`);
      if (courseScheduleEntities) {
        for (const courseScheduleEntity of courseScheduleEntities as CourseScheduleEntity[]) {
          await this.deleteUserSchedule({
            key: {
              userId,
              scheduleId: courseScheduleEntity.scheduleId,
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
        console.info('[EnrollmentDeletedEventHandler:deleteUserSchedule] Exception thrown:', exception);
        console.info(`[EnrollmentDeletedEventHandler:deleteUserSchedule] Attempting to retry (${RETRIES})...`);
        RETRIES++;
        if (RETRIES > MAX_RETRIES) {
          throw new MaxRetriesException(exception as Error);
        }
        await TimerService.sleepWith100MsBaseDelayExponentialBackoff(RETRIES);
      }
    }
  }
}