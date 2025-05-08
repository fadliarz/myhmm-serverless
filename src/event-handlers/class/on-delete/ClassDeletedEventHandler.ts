import { DeleteCommand, DynamoDBDocumentClient, QueryCommand } from '@aws-sdk/lib-dynamodb';
import generateDynamoDBDocumentClient from '../../../common/generateDynamoDBDocumentClient';
import TimerService from '../../../common/TimerService';
import MaxRetriesException from '../../../common/MaxRetriesException';
import ClassEventHandler from '../ClassEventHandler';
import ClassDeletedEvent from '../event/ClassDeletedEvent';
import ClassEntity from '../../../common/entity/ClassEntity';
import ClassAssignmentEntity from '../../../common/entity/ClassAssignmentEntity';
import EnrollmentEntity from '../../../common/entity/EnrollmentEntity';
import InstructorEntity from '../../../common/entity/InstructorEntity';

export default class ClassDeletedEventHandler extends ClassEventHandler {
  private readonly dynamoDBDocumentClient: DynamoDBDocumentClient = generateDynamoDBDocumentClient();

  public async handle(classDeletedEvent: ClassDeletedEvent) {
    const deletedClassEntity: ClassEntity = classDeletedEvent.data.OldImage;
    await this.deleteClassAssignments({ classId: deletedClassEntity.classId, courseId: deletedClassEntity.courseId });
    await this.deleteEnrollments({ classId: deletedClassEntity.classId, courseId: deletedClassEntity.courseId });
  }

  private async deleteClassAssignments(param: { classId: number, courseId: number }): Promise<void> {
    const { classId, courseId } = param;
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
      console.info(`[ClassDeletedEventHandler] Retrieved ${classAssignmentEntities?.length ?? 0} class assignments`);
      if (classAssignmentEntities) {
        for (const classAssignmentEntity of classAssignmentEntities as ClassAssignmentEntity[]) {
          if (classAssignmentEntity.courseId === courseId) {
            await this.deleteClassAssignment({
              key: {
                classId,
                assignmentId: classAssignmentEntity.assignmentId,
              },
            });
          }
        }
      }
      lastEvaluatedKey = LastEvaluatedKey as any;
    } while (lastEvaluatedKey);
  }

  private async deleteClassAssignment(param: {
    key: {
      classId: number,
      assignmentId: number
    }
  }): Promise<void> {
    const env = await this.getEnv();
    let RETRIES: number = 0;
    const MAX_RETRIES: number = 3;
    while (RETRIES <= MAX_RETRIES) {
      try {
        await this.dynamoDBDocumentClient.send(new DeleteCommand({
          TableName: env.CLASS_ASSIGNMENT_TABLE,
          Key: param.key,
        }));
        return;
      } catch (exception) {
        console.info('[ClassDeletedEventHandler:removeCourseCategory] Exception thrown:', exception);
        console.info(`[ClassDeletedEventHandler:removeCourseCategory] Attempting to retry (${RETRIES})...`);
        RETRIES++;
        if (RETRIES > MAX_RETRIES) {
          throw new MaxRetriesException(exception as Error);
        }
        await TimerService.sleepWith100MsBaseDelayExponentialBackoff(RETRIES);
      }
    }
  }

  private async deleteEnrollments(param: { classId: number, courseId: number }): Promise<void> {
    const { classId, courseId } = param;
    const env = await this.getEnv();
    let lastEvaluatedKey: Record<string, any> | undefined = undefined;
    do {
      const {
        Items: enrollmentEntities,
        LastEvaluatedKey,
      } = await this.dynamoDBDocumentClient.send(new QueryCommand({
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
      console.info(`[ClassDeletedEventHandler] Retrieved ${enrollmentEntities?.length ?? 0} enrollments`);
      if (enrollmentEntities) {
        for (const enrollmentEntity of enrollmentEntities as EnrollmentEntity[]) {
          if (enrollmentEntity.courseId === courseId) {
            await this.deleteEnrollment({
              key: {
                userId: enrollmentEntity.userId,
                classId,
              },
            });
          }
        }
      }
      lastEvaluatedKey = LastEvaluatedKey as any;
    } while (lastEvaluatedKey);
  }

  private async deleteEnrollment(param: {
    key: {
      userId: number,
      classId: number
    }
  }): Promise<void> {
    const env = await this.getEnv();
    let RETRIES: number = 0;
    const MAX_RETRIES: number = 3;
    while (RETRIES <= MAX_RETRIES) {
      try {
        await this.dynamoDBDocumentClient.send(new DeleteCommand({
          TableName: env.ENROLLMENT_TABLE,
          Key: param.key,
        }));
        return;
      } catch (exception) {
        console.info('[ClassDeletedEventHandler:removeCourseCategory] Exception thrown:', exception);
        console.info(`[ClassDeletedEventHandler:removeCourseCategory] Attempting to retry (${RETRIES})...`);
        RETRIES++;
        if (RETRIES > MAX_RETRIES) {
          throw new MaxRetriesException(exception as Error);
        }
        await TimerService.sleepWith100MsBaseDelayExponentialBackoff(RETRIES);
      }
    }
  }

  private async deleteInstructors(param: { classId: number, courseId: number }): Promise<void> {
    const { classId, courseId } = param;
    const env = await this.getEnv();
    let lastEvaluatedKey: Record<string, any> | undefined = undefined;
    do {
      const {
        Items: instructorEntities,
        LastEvaluatedKey,
      } = await this.dynamoDBDocumentClient.send(new QueryCommand({
        TableName: env.INSTRUCTOR_TABLE,
        IndexName: env.INSTRUCTOR_TABLE_GSI,
        KeyConditionExpression: '#classId = :value0',
        ExpressionAttributeNames: {
          '#classId': 'classId',
        },
        ExpressionAttributeValues: {
          ':value0': classId,
        },
        ExclusiveStartKey: lastEvaluatedKey,
      }));
      console.info(`[ClassDeletedEventHandler] Retrieved ${instructorEntities?.length ?? 0} instructors`);
      if (instructorEntities) {
        for (const instructorEntity of instructorEntities as InstructorEntity[]) {
          if (instructorEntity.courseId === courseId) {
            await this.deleteInstructor({
              key: {
                userId: instructorEntity.userId,
                classId,
              },
            });
          }
        }
      }
      lastEvaluatedKey = LastEvaluatedKey as any;
    } while (lastEvaluatedKey);
  }

  private async deleteInstructor(param: {
    key: {
      userId: number,
      classId: number
    }
  }): Promise<void> {
    const env = await this.getEnv();
    let RETRIES: number = 0;
    const MAX_RETRIES: number = 3;
    while (RETRIES <= MAX_RETRIES) {
      try {
        await this.dynamoDBDocumentClient.send(new DeleteCommand({
          TableName: env.INSTRUCTOR_TABLE,
          Key: param.key,
        }));
        return;
      } catch (exception) {
        console.info('[ClassDeletedEventHandler:deleteInstructor] Exception thrown:', exception);
        console.info(`[ClassDeletedEventHandler:deleteInstructor] Attempting to retry (${RETRIES})...`);
        RETRIES++;
        if (RETRIES > MAX_RETRIES) {
          throw new MaxRetriesException(exception as Error);
        }
        await TimerService.sleepWith100MsBaseDelayExponentialBackoff(RETRIES);
      }
    }
  }
}