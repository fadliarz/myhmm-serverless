import {
  DeleteCommand,
  DynamoDBDocumentClient,
  GetCommand,
  QueryCommand,
  TransactWriteCommand,
} from '@aws-sdk/lib-dynamodb';
import generateDynamoDBDocumentClient from '../../../common/generateDynamoDBDocumentClient';
import TimerService from '../../../common/TimerService';
import MaxRetriesException from '../../../common/MaxRetriesException';
import ClassEventHandler from '../ClassEventHandler';
import ClassDeletedEvent from '../event/ClassDeletedEvent';
import ClassEntity from '../../../common/entity/ClassEntity';
import ClassAssignmentEntity from '../../../common/entity/ClassAssignmentEntity';
import EnrollmentEntity from '../../../common/entity/EnrollmentEntity';
import InstructorEntity from '../../../common/entity/InstructorEntity';
import CourseKey from '../../../common/entity/CourseKey';
import ClassAssignmentKey from '../../../common/entity/ClassAssignmentKey';
import { TransactionCanceledException } from '@aws-sdk/client-dynamodb';
import InternalServerException from '../../../common/exception/InternalServerException';
import { DynamoDBExceptionCode } from '../../../common/DynamoDBExceptionCode';
import EnrollmentKey from '../../../common/entity/EnrollmentKey';
import InstructorKey from '../../../common/entity/InstructorKey';
import UserKey from '../../../common/entity/UserKey';

export default class ClassDeletedEventHandler extends ClassEventHandler {
  private readonly dynamoDBDocumentClient: DynamoDBDocumentClient = generateDynamoDBDocumentClient();

  public async handle(classDeletedEvent: ClassDeletedEvent) {
    const deletedClassEntity: ClassEntity = classDeletedEvent.data.OldImage;
    await this.deleteClassAssignments({ classId: deletedClassEntity.classId, courseId: deletedClassEntity.courseId });
    await this.deleteEnrollments({ classId: deletedClassEntity.classId, courseId: deletedClassEntity.courseId });
    await this.deleteInstructors({ classId: deletedClassEntity.classId, courseId: deletedClassEntity.courseId });
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
                courseId,
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
      courseId: number,
      classId: number,
      assignmentId: number
    }
  }): Promise<void> {
    const { courseId, classId, assignmentId } = param.key;
    const env = await this.getEnv();
    let RETRIES: number = 0;
    const MAX_RETRIES: number = 3;
    while (RETRIES <= MAX_RETRIES) {
      try {
        const { Item: courseEntity } = await this.dynamoDBDocumentClient.send(
          new GetCommand({
            TableName: env.COURSE_TABLE,
            Key: new CourseKey({ courseId }),
          }),
        );
        if (!courseEntity) {
          await this.dynamoDBDocumentClient.send(new DeleteCommand({
            TableName: env.CLASS_ASSIGNMENT_TABLE,
            Key: new ClassAssignmentKey({ classId, assignmentId }),
          }));
          return;
        }
        await this.dynamoDBDocumentClient.send(
          new TransactWriteCommand({
            TransactItems: [
              {
                Delete: {
                  TableName: env.CLASS_ASSIGNMENT_TABLE,
                  Key: new ClassAssignmentKey({ classId, assignmentId }),
                  ConditionExpression:
                    'attribute_exists(classId) AND attribute_exists(assignmentId)',
                },
              },
              {
                Update: {
                  TableName: env.COURSE_TABLE,
                  Key: new CourseKey({ courseId }),
                  ConditionExpression:
                    'attribute_exists(id) AND attribute_exists(courseId)',
                  UpdateExpression: 'ADD #numberOfAssignments :value0',
                  ExpressionAttributeNames: {
                    '#numberOfAssignments': 'numberOfAssignments',
                  },
                  ExpressionAttributeValues: {
                    ':value0': -1,
                  },
                },
              },
            ],
          }),
        );
        return;
      } catch (exception) {
        if (exception instanceof TransactionCanceledException) {
          const { CancellationReasons } = exception;
          if (!CancellationReasons) throw new InternalServerException();
          if (
            CancellationReasons[0].Code === DynamoDBExceptionCode.CONDITIONAL_CHECK_FAILED
          ) {
            return;
          }
          console.info('[ClassDeletedEventHandler:deleteClassAssignment] Exception thrown:', exception);
          console.info(`[ClassDeletedEventHandler:deleteClassAssignment] Attempting to retry (${RETRIES})...`);
          RETRIES++;
          if (RETRIES > MAX_RETRIES) {
            throw new MaxRetriesException(exception as Error);
          }
          await TimerService.sleepWith100MsBaseDelayExponentialBackoff(RETRIES);
        }
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
                courseId,
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
      courseId: number,
      classId: number
    }
  }): Promise<void> {
    const { userId, courseId, classId } = param.key;
    const env = await this.getEnv();
    let RETRIES: number = 0;
    const MAX_RETRIES: number = 3;
    while (RETRIES <= MAX_RETRIES) {
      try {
        const { Item: courseEntity } = await this.dynamoDBDocumentClient.send(
          new GetCommand({
            TableName: env.COURSE_TABLE,
            Key: new CourseKey({ courseId }),
          }),
        );
        if (!courseEntity) {
          await this.dynamoDBDocumentClient.send(new DeleteCommand({
            TableName: env.ENROLLMENT_TABLE,
            Key: new EnrollmentKey({ userId, classId }),
          }));
          return;
        }
        await this.dynamoDBDocumentClient.send(
          new TransactWriteCommand({
            TransactItems: [
              {
                Delete: {
                  TableName: env.ENROLLMENT_TABLE,
                  Key: new EnrollmentKey({ userId, classId }),
                  ConditionExpression:
                    'attribute_exists(userId) AND attribute_exists(classId)',
                },
              },
              {
                Update: {
                  TableName: env.COURSE_TABLE,
                  Key: new CourseKey({ courseId }),
                  ConditionExpression:
                    'attribute_exists(id) AND attribute_exists(courseId)',
                  UpdateExpression: 'ADD #numberOfStudents :value0',
                  ExpressionAttributeNames: {
                    '#numberOfStudents': 'numberOfStudents',
                  },
                  ExpressionAttributeValues: {
                    ':value0': -1,
                  },
                },
              },
            ],
          }),
        );
        return;
      } catch (exception) {
        if (exception instanceof TransactionCanceledException) {
          const { CancellationReasons } = exception;
          if (!CancellationReasons) throw new InternalServerException();
          if (
            CancellationReasons[0].Code === DynamoDBExceptionCode.CONDITIONAL_CHECK_FAILED
          ) return;
        }
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
                courseId,
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
      courseId: number,
      classId: number
    }
  }): Promise<void> {
    const { userId, courseId, classId } = param.key;
    const env = await this.getEnv();
    let RETRIES: number = 0;
    const MAX_RETRIES: number = 3;
    while (RETRIES <= MAX_RETRIES) {
      try {
        const { Item: courseEntity } = await this.dynamoDBDocumentClient.send(
          new GetCommand({
            TableName: env.COURSE_TABLE,
            Key: new CourseKey({ courseId }),
          }),
        );
        const { Item: userEntity } = await this.dynamoDBDocumentClient.send(
          new GetCommand({
            TableName: env.USER_TABLE,
            Key: new UserKey({ userId }),
          }),
        );
        if (!courseEntity && !userEntity) {
          await this.dynamoDBDocumentClient.send(new DeleteCommand({
            TableName: env.INSTRUCTOR_TABLE,
            Key: new InstructorKey({ userId, classId }),
          }));
          return;
        }
        await this.dynamoDBDocumentClient.send(
          new TransactWriteCommand({
            TransactItems: [
              {
                Delete: {
                  TableName: env.INSTRUCTOR_TABLE,
                  Key: new InstructorKey({ userId, classId }),
                  ConditionExpression:
                    'attribute_exists(userId) AND attribute_exists(classId)',
                },
              },
              ...courseEntity ? [{
                Update: {
                  TableName: env.COURSE_TABLE,
                  Key: new CourseKey({ courseId }),
                  ConditionExpression:
                    'attribute_exists(id) AND attribute_exists(courseId)',
                  UpdateExpression: 'ADD #numberOfInstructors :value0',
                  ExpressionAttributeNames: {
                    '#numberOfInstructors': 'numberOfInstructors',
                  },
                  ExpressionAttributeValues: {
                    ':value0': -1,
                  },
                },
              }] : [],
              ...userEntity ? [{
                Update: {
                  TableName: env.USER_TABLE,
                  Key: new UserKey({ userId }),
                  ConditionExpression:
                    'attribute_exists(id) AND attribute_exists(userId)',
                  UpdateExpression: 'ADD #numberOfManagedClasses :value0',
                  ExpressionAttributeNames: {
                    '#numberOfManagedClasses': 'numberOfManagedClasses',
                  },
                  ExpressionAttributeValues: {
                    ':value0': -1,
                  },
                },
              }] : [],
            ],
          }),
        );
        return;
      } catch (exception) {
        if (exception instanceof TransactionCanceledException) {
          const { CancellationReasons } = exception;
          if (!CancellationReasons) throw new InternalServerException();
          if (
            CancellationReasons[0].Code === DynamoDBExceptionCode.CONDITIONAL_CHECK_FAILED
          ) return;
        }

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