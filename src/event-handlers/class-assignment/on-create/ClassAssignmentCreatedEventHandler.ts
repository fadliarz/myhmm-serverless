import { DynamoDBDocumentClient, PutCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';
import generateDynamoDBDocumentClient from '../../../common/generateDynamoDBDocumentClient';
import { AssignmentType } from '../../../common/AssignmentType';
import { CompletionStatus } from '../../../common/CompletionStatus';
import { ConditionalCheckFailedException } from '@aws-sdk/client-dynamodb';
import TimerService from '../../../common/TimerService';
import MaxRetriesException from '../../../common/MaxRetriesException';
import ClassAssignmentEventHandler from '../ClassAssignmentEventHandler';
import ClassAssignmentCreatedEvent from '../event/ClassAssignmentCreatedEvent';
import ClassAssignmentEntity from '../../../common/entity/ClassAssignmentEntity';
import EnrollmentEntity from '../../../common/entity/EnrollmentEntity';
import UserAssignmentEntity from '../../../common/entity/UserAssignmentEntity';

export default class ClassAssignmentCreatedEventHandler extends ClassAssignmentEventHandler {
  private readonly dynamoDBDocumentClient: DynamoDBDocumentClient = generateDynamoDBDocumentClient();

  public async handle(classAssignmentCreatedEvent: ClassAssignmentCreatedEvent) {
    const env = await this.getEnv();
    const classAssignmentEntity: ClassAssignmentEntity = classAssignmentCreatedEvent.data.NewImage;
    let lastEvaluatedKey: Record<string, any> | undefined = undefined;
    do {
      const { Items: enrollmentEntities, LastEvaluatedKey } = await this.dynamoDBDocumentClient.send(new QueryCommand({
        TableName: env.ENROLLMENT_TABLE,
        IndexName: 'classId_userId',
        KeyConditionExpression: '#classId = :value0',
        ExpressionAttributeNames: {
          '#classId': 'classId',
        },
        ExpressionAttributeValues: {
          ':value0': classAssignmentEntity.classId,
        },
        ExclusiveStartKey: lastEvaluatedKey,
      }));
      console.info(`[CategoryDeletedEventHandler] Retrieved ${enrollmentEntities?.length ?? 0} enrollments`);
      if (enrollmentEntities) {
        for (const enrollmentEntity of enrollmentEntities as EnrollmentEntity[]) {
          const userAssignmentEntity: UserAssignmentEntity = new UserAssignmentEntity();
          userAssignmentEntity.userId = enrollmentEntity.userId;
          userAssignmentEntity.assignmentId = classAssignmentEntity.assignmentId;
          userAssignmentEntity.taskType = classAssignmentEntity.taskType;
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
    userAssignmentEntity: UserAssignmentEntity,
  }): Promise<void> {
    const env = await this.getEnv();
    let RETRIES: number = 0;
    const MAX_RETRIES: number = 3;
    while (RETRIES <= MAX_RETRIES) {
      try {
        await this.dynamoDBDocumentClient.send(new PutCommand({
          TableName: env.USER_ASSIGNMENT_TABLE,
          Item: param.userAssignmentEntity,
        }));
        return;
      } catch (exception) {
        if (exception instanceof ConditionalCheckFailedException) return;
        console.info('[ClassAssignmentCreatedEventHandler:createUserAssignment] Exception thrown:', exception);
        console.info(`[ClassAssignmentCreatedEventHandler:createUserAssignment] Attempting to retry (${RETRIES})...`);
        RETRIES++;
        if (RETRIES > MAX_RETRIES) {
          throw new MaxRetriesException(exception as Error);
        }
        await TimerService.sleepWith100MsBaseDelayExponentialBackoff(RETRIES);
      }
    }
  }
}