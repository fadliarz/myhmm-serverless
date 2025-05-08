import { DeleteCommand, DynamoDBDocumentClient, QueryCommand } from '@aws-sdk/lib-dynamodb';
import generateDynamoDBDocumentClient from '../../../common/generateDynamoDBDocumentClient';
import MaxRetriesException from '../../../common/MaxRetriesException';
import TimerService from '../../../common/TimerService';
import ClassAssignmentEventHandler from '../ClassAssignmentEventHandler';
import ClassAssignmentDeletedEvent from '../event/ClassAssignmentDeletedEvent';
import ClassAssignmentEntity from '../../../common/entity/ClassAssignmentEntity';
import EnrollmentEntity from '../../../common/entity/EnrollmentEntity';

export default class ClassAssignmentDeletedEventHandler extends ClassAssignmentEventHandler {
  private readonly dynamoDBDocumentClient: DynamoDBDocumentClient = generateDynamoDBDocumentClient();

  public async handle(classAssignmentDeletedEvent: ClassAssignmentDeletedEvent): Promise<void> {
    const env = await this.getEnv();
    const deletedClassAssignmentEntity: ClassAssignmentEntity = classAssignmentDeletedEvent.data.OldImage;
    let lastEvaluatedKey: Record<string, any> | undefined = undefined;
    do {
      const { Items: enrollmentEntities, LastEvaluatedKey } = await this.dynamoDBDocumentClient.send(
        new QueryCommand({
          TableName: env.ENROLLMENT_TABLE,
          IndexName: 'classId_userId',
          KeyConditionExpression: '#classId = :value0',
          ExpressionAttributeNames: {
            '#classId': 'classId',
          },
          ExpressionAttributeValues: {
            ':value0': deletedClassAssignmentEntity.classId,
          },
          ExclusiveStartKey: lastEvaluatedKey,
        }),
      );
      console.info(`[ClassAssignmentDeletedEventHandler] Retrieved ${enrollmentEntities?.length ?? 0} enrollments`);
      if (enrollmentEntities) {
        for (const enrollmentEntity of enrollmentEntities as EnrollmentEntity[]) {
          await this.deleteUserAssignment({
            key: {
              userId: enrollmentEntity.userId,
              assignmentId: deletedClassAssignmentEntity.assignmentId,
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
        console.info('[ClassAssignmentDeletedEventHandler:deleteUserAssignment] Exception thrown:', exception);
        console.info(`[ClassAssignmentDeletedEventHandler:deleteUserAssignment] Attempting to retry (${RETRIES})...`);
        RETRIES++;
        if (RETRIES > MAX_RETRIES) {
          throw new MaxRetriesException(exception as Error);
        }
        await TimerService.sleepWith100MsBaseDelayExponentialBackoff(RETRIES);
      }
    }
  }
}

