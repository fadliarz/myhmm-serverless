import { DeleteCommand, DynamoDBDocumentClient, QueryCommand } from '@aws-sdk/lib-dynamodb';
import generateDynamoDBDocumentClient from '../../../common/generateDynamoDBDocumentClient';
import TimerService from '../../../common/TimerService';
import MaxRetriesException from '../../../common/MaxRetriesException';
import EnrollmentEventHandler from '../EnrollmentEventHandler';
import EnrollmentEntity from '../../../common/entity/EnrollmentEntity';
import EnrollmentDeletedEvent from '../event/EnrollmentDeletedEvent';
import ClassAssignmentEntity from '../../../common/entity/ClassAssignmentEntity';

export default class EnrollmentDeletedEventHandler extends EnrollmentEventHandler {
  private readonly dynamoDBDocumentClient: DynamoDBDocumentClient = generateDynamoDBDocumentClient();

  public async handle(enrollmentDeletedEvent: EnrollmentDeletedEvent) {
    const env = await this.getEnv();
    const deletedEnrollmentEntity: EnrollmentEntity = enrollmentDeletedEvent.data.OldImage;
    let countSuccess: number = 0;
    let lastEvaluatedKey: Record<string, any> | undefined = undefined;
    do {
      const { Items } = await this.dynamoDBDocumentClient.send(new QueryCommand({
        TableName: env.CLASS_ASSIGNMENT_TABLE,
        KeyConditionExpression: '#classId = :value0',
        ExpressionAttributeNames: {
          '#classId': 'classId',
        },
        ExpressionAttributeValues: {
          ':value0': deletedEnrollmentEntity.classId,
        },
        ExclusiveStartKey: lastEvaluatedKey,
      }));
      if (Items) {
        for (const classAssignmentEntity of Items as ClassAssignmentEntity[]) {
          await this.deleteUserAssignment({
            userId: deletedEnrollmentEntity.userId,
            assignmentId: classAssignmentEntity.assignmentId,
          });
          countSuccess++;
        }
      }
    } while (lastEvaluatedKey);
    console.info('@EnrollmentDeletedEventHandler * successfully processed all items * success count:', countSuccess);
  }

  private async deleteUserAssignment(param: {
    userId: number,
    assignmentId: number
  }): Promise<void> {
    const env = await this.getEnv();
    let RETRIES: number = 0;
    const MAX_RETRIES: number = 3;
    while (RETRIES <= MAX_RETRIES) {
      try {
        await this.dynamoDBDocumentClient.send(new DeleteCommand({
          TableName: env.USER_ASSIGNMENT_TABLE,
          Key: param,
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