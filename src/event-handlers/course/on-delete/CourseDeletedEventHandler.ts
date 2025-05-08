import { DeleteCommand, DynamoDBDocumentClient, QueryCommand } from '@aws-sdk/lib-dynamodb';
import generateDynamoDBDocumentClient from '../../../common/generateDynamoDBDocumentClient';
import TimerService from '../../../common/TimerService';
import MaxRetriesException from '../../../common/MaxRetriesException';
import CourseEventHandler from '../CourseEventHandler';
import CourseDeletedEvent from '../event/CourseDeletedEvent';
import LessonEntity from '../../../common/entity/LessonEntity';
import CourseEntity from '../../../common/entity/CourseEntity';
import ClassEntity from '../../../common/entity/ClassEntity';
import CategoryLinkKey from '../../../common/entity/CategoryLinkKey';

export default class CourseDeletedEventHandler extends CourseEventHandler {
  private readonly dynamoDBDocumentClient: DynamoDBDocumentClient = generateDynamoDBDocumentClient();

  public async handle(courseDeletedEvent: CourseDeletedEvent) {
    const deletedCourseEntity: CourseEntity = courseDeletedEvent.data.OldImage;
    await this.deleteLessons({ courseId: deletedCourseEntity.courseId });
    await this.deleteClasses({ courseId: deletedCourseEntity.courseId });
    await this.deleteCategoryLinks({
      courseId: deletedCourseEntity.courseId,
      categories: deletedCourseEntity.categories,
    });
  }

  private async deleteLessons(param: { courseId: number }): Promise<void> {
    const { courseId } = param;
    const env = await this.getEnv();
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
      console.info(`[CourseDeletedEventHandler] Retrieved ${lessonEntities?.length ?? 0} lessons`);
      if (lessonEntities) {
        for (const lessonEntity of lessonEntities as LessonEntity[]) {
          await this.deleteLesson({
            key: {
              courseId: courseId,
              lessonId: lessonEntity.lessonId,
            },
          });
        }
      }
      lastEvaluatedKey = LastEvaluatedKey as any;
    } while (lastEvaluatedKey);
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
        console.info('[CourseDeletedEvent:deleteLesson] Exception thrown:', exception);
        console.info(`[CourseDeletedEvent:deleteLesson] Attempting to retry (${RETRIES})...`);
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
      console.info(`[CourseDeletedEventHandler] Retrieved ${classEntities?.length ?? 0} classes`);
      if (classEntities) {
        for (const classEntity of classEntities as ClassEntity[]) {
          await this.deleteClass({
            key: {
              courseId: courseId,
              classId: classEntity.classId,
            },
          });
        }
      }
      lastEvaluatedKey = LastEvaluatedKey as any;
    } while (lastEvaluatedKey);
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
        console.info('[CourseDeletedEvent:deleteClass] Exception thrown:', exception);
        console.info(`[CourseDeletedEvent:deleteClass] Attempting to retry (${RETRIES})...`);
        RETRIES++;
        if (RETRIES > MAX_RETRIES) {
          throw new MaxRetriesException(exception as Error);
        }
        await TimerService.sleepWith100MsBaseDelayExponentialBackoff(RETRIES);
      }
    }
  }

  private async deleteCategoryLinks(param: { courseId: number, categories?: Set<number> }): Promise<void> {
    const { courseId, categories } = param;
    if (!categories) return;
    for (const categoryId of Array.from(categories)) {
      await this.deleteCategoryLink({ courseId, categoryId });
    }
  }

  private async deleteCategoryLink(param: { courseId: number, categoryId: number }): Promise<void> {
    const { courseId, categoryId } = param;
    const env = await this.getEnv();
    await this.dynamoDBDocumentClient.send(new DeleteCommand({
      TableName: env.CATEGORY_TABLE,
      Key: new CategoryLinkKey({ categoryId, courseId }),
    }));
  }
}