import { DeleteCommand, DynamoDBDocumentClient, QueryCommand } from '@aws-sdk/lib-dynamodb';
import generateDynamoDBDocumentClient from '../../../common/generateDynamoDBDocumentClient';
import TimerService from '../../../common/TimerService';
import MaxRetriesException from '../../../common/MaxRetriesException';
import CourseEventHandler from '../CourseEventHandler';
import CourseDeletedEvent from '../event/CourseDeletedEvent';
import LessonEntity from '../../../common/entity/LessonEntity';
import CourseEntity from '../../../common/entity/CourseEntity';
import ClassEntity from '../../../common/entity/ClassEntity';

export default class CourseDeletedEventHandler extends CourseEventHandler {
  private readonly dynamoDBDocumentClient: DynamoDBDocumentClient = generateDynamoDBDocumentClient();

  public async handle(courseDeletedEvent: CourseDeletedEvent) {
    const deletedCourseEntity: CourseEntity = courseDeletedEvent.data.OldImage;
    await this.deleteLessons({ courseId: deletedCourseEntity.courseId });
    await this.deleteClasses({ courseId: deletedCourseEntity.courseId });
  }

  private async deleteLessons(param: { courseId: number }): Promise<void> {
    const { courseId } = param;
    const env = await this.getEnv();
    let deletedLessonCount: number = 0;
    let lastEvaluatedKey: Record<string, any> | undefined = undefined;
    do {
      const {
        Items: lessonEntities,
        LastEvaluatedKey,
      } = await this.dynamoDBDocumentClient.send(new QueryCommand({
        TableName: env.LESSON_TABLE,
        KeyConditionExpression: '#courseId = :value0',
        ExpressionAttributeNames: {
          '#courseId': 'courseId',
        },
        ExpressionAttributeValues: {
          ':value0': courseId,
        },
        ExclusiveStartKey: lastEvaluatedKey,
      }));
      if (lessonEntities) {
        for (const lessonEntity of lessonEntities as LessonEntity[]) {
          await this.deleteLesson({
            key: {
              courseId: courseId,
              lessonId: lessonEntity.lessonId,
            },
          });
          deletedLessonCount++;
        }
      }
      lastEvaluatedKey = LastEvaluatedKey as any;
    } while (lastEvaluatedKey);
    console.info('@CourseDeletedEventHandler * successfully deleted ' + deletedLessonCount + ' lessons!');
  }

  private async deleteLesson(param: {
    key: {
      courseId: number,
      lessonId: number
    }
  }): Promise<void> {
    const env = await this.getEnv();
    let RETRIES: number = 0;
    const MAX_RETRIES: number = 3;
    while (RETRIES <= MAX_RETRIES) {
      try {
        await this.dynamoDBDocumentClient.send(new DeleteCommand({
          TableName: env.LESSON_TABLE,
          Key: param.key,
        }));
        return;
      } catch (exception) {
        RETRIES++;
        if (RETRIES > MAX_RETRIES) {
          throw new MaxRetriesException(exception as Error);
        }
        await TimerService.sleepWith100MsBaseDelayExponentialBackoff(RETRIES);
      }
    }
  }

  private async deleteClasses(param: { courseId: number }): Promise<void> {
    const { courseId } = param;
    const env = await this.getEnv();
    let deletedClassCount: number = 0;
    let lastEvaluatedKey: Record<string, any> | undefined = undefined;
    do {
      const {
        Items: classEntities,
        LastEvaluatedKey,
      } = await this.dynamoDBDocumentClient.send(new QueryCommand({
        TableName: env.CLASS_TABLE,
        KeyConditionExpression: '#courseId = :value0',
        ExpressionAttributeNames: {
          '#courseId': 'courseId',
        },
        ExpressionAttributeValues: {
          ':value0': courseId,
        },
        ExclusiveStartKey: lastEvaluatedKey,
      }));
      if (classEntities) {
        for (const classEntity of classEntities as ClassEntity[]) {
          await this.deleteClass({
            key: {
              courseId: courseId,
              classId: classEntity.classId,
            },
          });
          deletedClassCount++;
        }
      }
      lastEvaluatedKey = LastEvaluatedKey as any;
    } while (lastEvaluatedKey);
    console.info('@CourseDeletedEventHandler * successfully deleted ' + deletedClassCount + ' classes!');
  }

  private async deleteClass(param: {
    key: {
      courseId: number,
      classId: number
    }
  }): Promise<void> {
    const env = await this.getEnv();
    let RETRIES: number = 0;
    const MAX_RETRIES: number = 3;
    while (RETRIES <= MAX_RETRIES) {
      try {
        await this.dynamoDBDocumentClient.send(new DeleteCommand({
          TableName: env.CLASS_TABLE,
          Key: param.key,
        }));
        return;
      } catch (exception) {
        RETRIES++;
        if (RETRIES > MAX_RETRIES) {
          throw new MaxRetriesException(exception as Error);
        }
        await TimerService.sleepWith100MsBaseDelayExponentialBackoff(RETRIES);
      }
    }
  }
}