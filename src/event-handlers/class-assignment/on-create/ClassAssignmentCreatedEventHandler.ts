import { DynamoDBDocumentClient, PutCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';
import generateDynamoDBDocumentClient from '../../../common/generateDynamoDBDocumentClient';
import { AssignmentTaskType } from '../entity/AssignmentTaskType';
import { AssignmentType } from '../../../common/AssignmentType';
import { CompletionStatus } from '../../../common/CompletionStatus';
import { ConditionalCheckFailedException } from '@aws-sdk/client-dynamodb';
import TimerService from '../../../common/TimerService';
import MaxRetriesException from '../../../common/MaxRetriesException';

export default class ClassAssignmentCreatedEventHandler {

  private readonly dynamoDBDocumentClient: DynamoDBDocumentClient = generateDynamoDBDocumentClient();

  public async handle(param: {
    NewImage: {
      courseId: number,
      classId: number,
      assignmentId: number,
      taskType: AssignmentTaskType,
      createdAt: string
    },
    env: { ENROLLMENT_TABLE: string, USER_ASSIGNMENT_TABLE: string }
  }) {
    const { NewImage, env } = param;
    let countSuccess: number = 0;
    let lastEvaluatedKey: Record<string, any> | undefined = undefined;
    do {
      const { Items } = await this.dynamoDBDocumentClient.send(new QueryCommand({
        TableName: env.ENROLLMENT_TABLE,
        IndexName: 'classId_userId',
        KeyConditionExpression: '#classId = :value0',
        ExpressionAttributeNames: {
          '#classId': 'classId',
        },
        ExpressionAttributeValues: {
          ':value0': NewImage.classId,
        },
        ExclusiveStartKey: lastEvaluatedKey,
      }));
      if (Items) {
        for (const Item of Items) {
          await this.processItem({ ...param, Item });
          countSuccess++;
        }
      }
    } while (lastEvaluatedKey);
    console.info('@ClassAssignmentCreatedEventHandler * successfully processed all items * success count:', countSuccess);
  }

  private async processItem(param: {
    NewImage: {
      courseId: number,
      classId: number,
      assignmentId: number,
      taskType: AssignmentTaskType,
      createdAt: string
    },
    env: { ENROLLMENT_TABLE: string, USER_ASSIGNMENT_TABLE: string }, Item: Record<string, any>
  }): Promise<void> {
    const { NewImage, env, Item } = param;
    let RETRIES: number = 0;
    const MAX_RETRIES: number = 3;
    while (RETRIES <= MAX_RETRIES) {
      try {
        await this.dynamoDBDocumentClient.send(new PutCommand({
          TableName: env.USER_ASSIGNMENT_TABLE,
          Item: {
            userId: Item.userId,
            assignmentId: NewImage.assignmentId,
            taskType: NewImage.taskType,
            assignmentType: AssignmentType.CLASS_ASSIGNMENT,
            completionStatus: CompletionStatus.NOT_STARTED,
            createdAt: NewImage.createdAt,
            classId: NewImage.classId,
          },
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