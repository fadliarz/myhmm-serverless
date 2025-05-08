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
          ':value0': deletedEnrollmentEntity.classId,
        },
        ExclusiveStartKey: lastEvaluatedKey,
      }));
      console.info(`[EnrollmentDeletedEventHandler] Retrieved ${classAssignmentEntities?.length ?? 0} class assignments`);
      if (classAssignmentEntities) {
        for (const classAssignmentEntity of classAssignmentEntities as ClassAssignmentEntity[]) {
          await this.deleteUserAssignment({
            key: {
              userId: deletedEnrollmentEntity.userId,
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
}