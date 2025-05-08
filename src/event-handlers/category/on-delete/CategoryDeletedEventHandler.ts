import { DeleteCommand, DynamoDBDocumentClient, QueryCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import generateDynamoDBDocumentClient from '../../../common/generateDynamoDBDocumentClient';
import TimerService from '../../../common/TimerService';
import MaxRetriesException from '../../../common/MaxRetriesException';
import CategoryEventHandler from '../CategoryEventHandler';
import CategoryDeletedEvent from '../event/CategoryDeletedEvent';
import CategoryEntity from '../../../common/entity/CategoryEntity';
import CourseKey from '../../../common/entity/CourseKey';
import CategoryLinkKey from '../../../common/entity/CategoryLinkKey';
import { ConditionalCheckFailedException } from '@aws-sdk/client-dynamodb';

export default class CategoryDeletedEventHandler extends CategoryEventHandler {
  private readonly dynamoDBDocumentClient: DynamoDBDocumentClient = generateDynamoDBDocumentClient();

  public async handle(categoryDeletedEvent: CategoryDeletedEvent) {
    const categoryEntity: CategoryEntity = categoryDeletedEvent.data.OldImage;
    await this.removeCourseCategories({ categoryId: categoryEntity.categoryId });
  }

  private async removeCourseCategories(param: { categoryId: number }): Promise<void> {
    const { categoryId } = param;
    const env = await this.getEnv();
    let lastEvaluatedKey: Record<string, any> | undefined = undefined;
    do {
      const {
        Items: categoryLinkKeys,
        LastEvaluatedKey,
      } = await this.dynamoDBDocumentClient.send(new QueryCommand({
        TableName: env.CATEGORY_TABLE,
        KeyConditionExpression: '#id = :value0',
        ExpressionAttributeNames: {
          '#id': 'id',
        },
        ExpressionAttributeValues: {
          ':value0': String(categoryId),
        },
        ExclusiveStartKey: lastEvaluatedKey,
      }));
      console.info(`[CategoryDeletedEventHandler] Retrieved ${categoryLinkKeys?.length ?? 0} keys`);
      if (categoryLinkKeys) {
        for (const categoryLinkKey of categoryLinkKeys as CategoryEntity[]) {
          await this.removeCourseCategory({
            key: {
              courseId: categoryLinkKey.categoryId,
              categoryId,
            },
          });
        }
      }
      lastEvaluatedKey = LastEvaluatedKey as any;
    } while (lastEvaluatedKey);
  }

  private async removeCourseCategory(param: {
    key: {
      courseId: number,
      categoryId: number
    }
  }): Promise<void> {
    const { courseId, categoryId } = param.key;
    let RETRIES: number = 0;
    const MAX_RETRIES: number = 3;
    while (RETRIES <= MAX_RETRIES) {
      try {
        await this.removeCategoryFromCourse(courseId, categoryId);
        await this.deleteCategoryLink(courseId, categoryId);
        return;
      } catch (exception) {
        console.info('[CategoryDeletedEventHandler:removeCourseCategory] Exception thrown:', exception);
        console.info(`[CategoryDeletedEventHandler:removeCourseCategory] Attempting to retry (${RETRIES})...`);
        RETRIES++;
        if (RETRIES > MAX_RETRIES) {
          throw new MaxRetriesException(exception as Error);
        }
        await TimerService.sleepWith1000MsBaseDelayExponentialBackoff(RETRIES);
      }
    }
  }

  private async removeCategoryFromCourse(
    courseId: number,
    categoryId: number,
  ): Promise<void> {
    const env = await this.getEnv();
    try {
      await this.dynamoDBDocumentClient.send(
        new UpdateCommand({
          TableName: env.COURSE_TABLE,
          Key: new CourseKey({ courseId }),
          ConditionExpression:
            'attribute_exists(id) AND attribute_exists(courseId)',
          UpdateExpression: 'DELETE #categories :categoryId',
          ExpressionAttributeNames: {
            '#categories': 'categories',
          },
          ExpressionAttributeValues: {
            ':categoryId': new Set([categoryId]),
          },
        }),
      );
    } catch (exception) {
      console.info('[CategoryDeletedEventHandler:removeCategoryFromCourse] Exception thrown: ', exception);
      if (exception instanceof ConditionalCheckFailedException) return;
      throw exception;
    }
  }

  private async deleteCategoryLink(
    courseId: number,
    categoryId: number,
  ): Promise<void> {
    const env = await this.getEnv();
    try {
      await this.dynamoDBDocumentClient.send(
        new DeleteCommand({
          TableName: env.CATEGORY_TABLE,
          Key: new CategoryLinkKey({ categoryId, courseId }),
        }),
      );
    } catch (exception) {
      console.info('[CategoryDeletedEventHandler:deleteCategoryLink] Exception thrown: ', exception);
    }
  }
}