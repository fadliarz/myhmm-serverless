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
      let RETRIES: number = 0;
      const MAX_RETRIES: number = 3;
      while (RETRIES <= MAX_RETRIES) {
        try {
          console.info('@ClassAssignmentCreatedEventHandler.handle * NewImage:', NewImage);
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
          break;
        } catch (exception) {
          console.error('@ClassAssignmentCreatedEventHandler.handle * failed to process item * exception:', exception);
          if (exception instanceof MaxRetriesException) {
            console.error('@ClassAssignmentCreatedEventHandler * failed to process item * exception:', exception);
            console.error('@ClassAssignmentCreatedEventHandler * failed to process item * success count:', countSuccess);
            throw exception;
          }
          RETRIES++;
          if (RETRIES > MAX_RETRIES) {
            throw new MaxRetriesException();
          }
          await TimerService.sleepWith1000MsBaseDelayExponentialBackoff(RETRIES);
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
        console.error('@ClassAssignmentCreatedEventHandler.processItem * failed to process item * exception:', exception);
        if (exception instanceof ConditionalCheckFailedException) return;
        RETRIES++;
        if (RETRIES > MAX_RETRIES) {
          throw new MaxRetriesException();
        }
        await TimerService.sleepWith1000MsBaseDelayExponentialBackoff(RETRIES);
      }
    }
  }
}