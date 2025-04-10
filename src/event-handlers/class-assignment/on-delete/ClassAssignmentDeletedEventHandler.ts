import { DeleteCommand, DynamoDBDocumentClient, QueryCommand } from '@aws-sdk/lib-dynamodb';
import generateDynamoDBDocumentClient from '../../../common/generateDynamoDBDocumentClient';
import MaxRetriesException from '../../../common/MaxRetriesException';
import TimerService from '../../../common/TimerService';

export default class ClassAssignmentDeletedEventHandler {

  private readonly dynamoDBDocumentClient: DynamoDBDocumentClient = generateDynamoDBDocumentClient();

  public async handle(param: {
    OldImage: { courseId: number, classId: number, assignmentId: number },
    env: { ENROLLMENT_TABLE: string, USER_ASSIGNMENT_TABLE: string }
  }): Promise<void> {
    const { OldImage, env } = param;
    let lastEvaluatedKey: Record<string, any> | undefined = undefined;
    do {
      const { Items } = await this.dynamoDBDocumentClient.send(
        new QueryCommand({
          IndexName: 'classId_userId',
          TableName: env.ENROLLMENT_TABLE,
          KeyConditionExpression: '#classId = :value0',
          ExpressionAttributeNames: {
            '#classId': 'classId',
          },
          ExpressionAttributeValues: {
            ':value0': OldImage.classId,
          },
          ExclusiveStartKey: lastEvaluatedKey,
        }),
      );
      if (Items) {
        for (const Item of Items) {
          await this.processItem({ ...param, Item });
        }
      }
    } while (lastEvaluatedKey);
  }

  private async processItem(param: {
    OldImage: { courseId: number, classId: number, assignmentId: number },
    env: { ENROLLMENT_TABLE: string, USER_ASSIGNMENT_TABLE: string }, Item: Record<string, any>
  }): Promise<void> {
    const { OldImage, env, Item } = param;
    let RETRIES: number = 0;
    const MAX_RETRIES: number = 3;
    while (RETRIES <= MAX_RETRIES) {
      try {
        await this.dynamoDBDocumentClient.send(new DeleteCommand({
          TableName: env.USER_ASSIGNMENT_TABLE,
          Key: {
            userId: Item.userId,
            assignmentId: OldImage.assignmentId,
          },
        }));
        return;
      } catch (exception) {
        RETRIES++;
        if (RETRIES > MAX_RETRIES) {
          throw new MaxRetriesException(exception as Error);
        }
        await TimerService.sleepWith1000MsBaseDelayExponentialBackoff(RETRIES);
      }
    }
  }
}

