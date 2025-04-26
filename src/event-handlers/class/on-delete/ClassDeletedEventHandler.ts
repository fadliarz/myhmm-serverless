import { DeleteCommand, DynamoDBDocumentClient, QueryCommand } from '@aws-sdk/lib-dynamodb';
import generateDynamoDBDocumentClient from '../../../common/generateDynamoDBDocumentClient';
import TimerService from '../../../common/TimerService';
import MaxRetriesException from '../../../common/MaxRetriesException';
import ClassEventHandler from '../ClassEventHandler';
import ClassDeletedEvent from '../event/ClassDeletedEvent';
import ClassEntity from '../../../common/entity/ClassEntity';
import ClassAssignmentEntity from '../../../common/entity/ClassAssignmentEntity';

export default class ClassDeletedEventHandler extends ClassEventHandler {
  private readonly dynamoDBDocumentClient: DynamoDBDocumentClient = generateDynamoDBDocumentClient();

  public async handle(classDeletedEvent: ClassDeletedEvent) {
    const deletedClassEntity: ClassEntity = classDeletedEvent.data.OldImage;
    await this.deleteClassAssignments({ classId: deletedClassEntity.classId, courseId: deletedClassEntity.courseId });
  }

  private async deleteClassAssignments(param: { classId: number, courseId: number }): Promise<void> {
    const { classId, courseId } = param;
    const env = await this.getEnv();
    let deletedClassAssignmentCount: number = 0;
    let lastEvaluatedKey: Record<string, any> | undefined = undefined;
    do {
      const {
        Items: classAssignmentEntities,
        LastEvaluatedKey,
      } = await this.dynamoDBDocumentClient.send(new QueryCommand({
        TableName: env.CLASS_ASSIGNMENT,
        KeyConditionExpression: '#classId = :value0 AND #courseId = :value1',
        ExpressionAttributeNames: {
          '#classId': 'classId',
          '#courseId': 'courseId',
        },
        ExpressionAttributeValues: {
          ':value0': classId,
          ':value1': courseId,
        },
        ExclusiveStartKey: lastEvaluatedKey,
      }));
      if (classAssignmentEntities) {
        for (const classAssignmentEntity of classAssignmentEntities as ClassAssignmentEntity[]) {
          await this.deleteClassAssignment({
            key: {
              classId,
              assignmentId: classAssignmentEntity.assignmentId,
            },
          });
          deletedClassAssignmentCount++;
        }
      }
      lastEvaluatedKey = LastEvaluatedKey as any;
    } while (lastEvaluatedKey);
    console.info('@ClassDeletedEventHandler * successfully deleted ' + deletedClassAssignmentCount + ' class assignments!');
  }

  private async deleteClassAssignment(param: {
    key: {
      classId: number,
      assignmentId: number
    }
  }): Promise<void> {
    const env = await this.getEnv();
    let RETRIES: number = 0;
    const MAX_RETRIES: number = 3;
    while (RETRIES <= MAX_RETRIES) {
      try {
        await this.dynamoDBDocumentClient.send(new DeleteCommand({
          TableName: env.CLASS_ASSIGNMENT,
          Key: param.key,
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