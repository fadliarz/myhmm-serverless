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

export default class EnrollmentCreatedEventHandler extends EnrollmentEventHandler {
  private readonly dynamoDBDocumentClient: DynamoDBDocumentClient = generateDynamoDBDocumentClient();

  public async handle(enrollmentCreatedEvent: EnrollmentCreatedEvent) {
    const enrollmentEntity: EnrollmentEntity = enrollmentCreatedEvent.data.NewImage;
    await this.createUserAssignments({ userId: enrollmentEntity.userId, classId: enrollmentEntity.classId });
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
}