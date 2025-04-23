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

export default class EnrollmentCreatedEventHandler extends EnrollmentEventHandler {
  private readonly dynamoDBDocumentClient: DynamoDBDocumentClient = generateDynamoDBDocumentClient();

  public async handle(enrollmentCreatedEvent: EnrollmentCreatedEvent) {
    const env = await this.getEnv();
    const enrollmentEntity: EnrollmentEntity = enrollmentCreatedEvent.data.NewImage;
    let createdAssignmentCount: number = 0;
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
          ':value0': enrollmentEntity.classId,
        },
        ExclusiveStartKey: lastEvaluatedKey,
      }));
      if (classAssignmentEntities) {
        for (const classAssignmentEntity of classAssignmentEntities as ClassAssignmentEntity[]) {
          const userAssignmentEntity: UserAssignmentEntity = new UserAssignmentEntity();
          userAssignmentEntity.userId = enrollmentEntity.userId;
          userAssignmentEntity.assignmentId = classAssignmentEntity.assignmentId;
          userAssignmentEntity.completionStatus = CompletionStatus.NOT_STARTED;
          userAssignmentEntity.createdAt = classAssignmentEntity.createdAt;
          userAssignmentEntity.classId = classAssignmentEntity.classId;
          await this.createUserAssignment({
            userAssignmentEntity,
          });
          createdAssignmentCount++;
        }
      }
      lastEvaluatedKey = LastEvaluatedKey as any;
    } while (lastEvaluatedKey);
    console.info('@EnrollmentCreatedEventHandler * successfully created ' + createdAssignmentCount + ' user assignments!');
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
        RETRIES++;
        if (RETRIES > MAX_RETRIES) {
          throw new MaxRetriesException(exception as Error);
        }
        await TimerService.sleepWith1000MsBaseDelayExponentialBackoff(RETRIES);
      }
    }
  }
}