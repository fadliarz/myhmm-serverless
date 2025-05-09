import {
  DeleteCommand,
  DynamoDBDocumentClient,
  GetCommand,
  QueryCommand,
  TransactWriteCommand,
} from '@aws-sdk/lib-dynamodb';
import generateDynamoDBDocumentClient from '../../../common/generateDynamoDBDocumentClient';
import TimerService from '../../../common/TimerService';
import MaxRetriesException from '../../../common/MaxRetriesException';
import LessonEventHandler from '../LessonEventHandler';
import LessonDeletedEvent from '../event/LessonDeletedEvent';
import LessonEntity from '../../../common/entity/LessonEntity';
import VideoEntity from '../../../common/entity/VideoEntity';
import AttachmentEntity from '../../../common/entity/AttachmentEntity';
import CourseKey from '../../../common/entity/CourseKey';
import VideoKey from '../../../common/entity/VideoKey';
import AttachmentKey from '../../../common/entity/AttachmentKey';

export default class LessonDeletedEventHandler extends LessonEventHandler {
  private readonly dynamoDBDocumentClient: DynamoDBDocumentClient = generateDynamoDBDocumentClient();

  public async handle(lessonDeletedEvent: LessonDeletedEvent) {
    const deletedLessonEntity: LessonEntity = lessonDeletedEvent.data.OldImage;
    await this.deleteVideos({ lessonId: deletedLessonEntity.lessonId });
    await this.deleteAttachments({ lessonId: deletedLessonEntity.lessonId });
  }

  private async deleteVideos(param: { lessonId: number }): Promise<void> {
    const { lessonId } = param;
    const env = await this.getEnv();
    let lastEvaluatedKey: Record<string, any> | undefined = undefined;
    do {
      const {
        Items: videoEntities,
        LastEvaluatedKey,
      } = await this.dynamoDBDocumentClient.send(new QueryCommand({
        TableName: env.VIDEO_TABLE,
        KeyConditionExpression: '#lessonId = :value0',
        ExpressionAttributeNames: {
          '#lessonId': 'lessonId',
        },
        ExpressionAttributeValues: {
          ':value0': lessonId,
        },
        ExclusiveStartKey: lastEvaluatedKey,
      }));
      console.info(`[LessonDeletedEventHandler] Retrieved ${videoEntities?.length ?? 0} videos`);
      if (videoEntities) {
        for (const videoEntity of videoEntities as VideoEntity[]) {
          await this.deleteVideo({
            key: {
              courseId: videoEntity.courseId,
              lessonId,
              videoId: videoEntity.videoId,
              durationInSec: videoEntity.durationInSec,
            },
          });
        }
      }
      lastEvaluatedKey = LastEvaluatedKey as any;
    } while (lastEvaluatedKey);
  }

  private async deleteVideo(param: {
    key: {
      courseId: number,
      lessonId: number,
      videoId: number,
      durationInSec: number,
    }
  }): Promise<void> {
    const { courseId, lessonId, videoId, durationInSec } = param.key;
    const env = await this.getEnv();
    let RETRIES: number = 0;
    const MAX_RETRIES: number = 3;
    while (RETRIES <= MAX_RETRIES) {
      try {
        const { Item: courseEntity } = await this.dynamoDBDocumentClient.send(
          new GetCommand({
            TableName: env.COURSE_TABLE,
            Key: new CourseKey({ courseId }),
          }),
        );
        if (!courseEntity) {
          await this.dynamoDBDocumentClient.send(new DeleteCommand({
            TableName: env.VIDEO_TABLE,
            Key: new VideoKey({ lessonId, videoId }),
          }));
          return;
        }
        await this.dynamoDBDocumentClient.send(
          new TransactWriteCommand({
            TransactItems: [
              {
                Delete: {
                  TableName: env.VIDEO_TABLE,
                  Key: new VideoKey({ lessonId, videoId }),
                },
              },
              {
                Update: {
                  TableName: env.COURSE_TABLE,
                  Key: new CourseKey({ courseId }),
                  ConditionExpression:
                    'attribute_exists(id) AND attribute_exists(courseId) AND #numberOfDurations = :value0 AND #numberOfVideos = :value1',
                  UpdateExpression:
                    'SET #numberOfDurations = :value2, #numberOfVideos = :value3',
                  ExpressionAttributeNames: {
                    '#numberOfVideos': 'numberOfVideos',
                    '#numberOfDurations': 'numberOfDurations',
                  },
                  ExpressionAttributeValues: {
                    ':value0': courseEntity.numberOfDurations,
                    ':value1': courseEntity.numberOfVideos,
                    ':value2':
                      courseEntity.numberOfDurations -
                      durationInSec,
                    ':value3': courseEntity.numberOfVideos - 1,
                  },
                },
              },
            ],
          }),
        );
        return;
      } catch (exception) {
        console.info('[LessonDeletedEventHandler:deleteVideo] Exception thrown:', exception);
        console.info(`[LessonDeletedEventHandler:deleteVideo] Attempting to retry (${RETRIES})...`);
        RETRIES++;
        if (RETRIES > MAX_RETRIES) {
          throw new MaxRetriesException(exception as Error);
        }
        await TimerService.sleepWith100MsBaseDelayExponentialBackoff(RETRIES);
      }
    }
  }

  private async deleteAttachments(param: { lessonId: number }): Promise<void> {
    const { lessonId } = param;
    const env = await this.getEnv();
    let lastEvaluatedKey: Record<string, any> | undefined = undefined;
    do {
      const {
        Items: attachmentEntities,
        LastEvaluatedKey,
      } = await this.dynamoDBDocumentClient.send(new QueryCommand({
        TableName: env.ATTACHMENT_TABLE,
        KeyConditionExpression: '#lessonId = :value0',
        ExpressionAttributeNames: {
          '#lessonId': 'lessonId',
        },
        ExpressionAttributeValues: {
          ':value0': lessonId,
        },
        ExclusiveStartKey: lastEvaluatedKey,
      }));
      console.info(`[LessonDeletedEventHandler] Retrieved ${attachmentEntities?.length ?? 0} attachments`);
      if (attachmentEntities) {
        for (const attachmentEntity of attachmentEntities as AttachmentEntity[]) {
          await this.deleteAttachment({
            key: {
              courseId: attachmentEntity.courseId,
              lessonId,
              attachmentId: attachmentEntity.attachmentId,
            },
          });
        }
      }
      lastEvaluatedKey = LastEvaluatedKey as any;
    } while (lastEvaluatedKey);
  }

  private async deleteAttachment(param: {
    key: {
      courseId: number,
      lessonId: number,
      attachmentId: number
    }
  }): Promise<void> {
    const { courseId, lessonId, attachmentId } = param.key;
    const env = await this.getEnv();
    let RETRIES: number = 0;
    const MAX_RETRIES: number = 3;
    while (RETRIES <= MAX_RETRIES) {
      try {
        const { Item: courseEntity } = await this.dynamoDBDocumentClient.send(
          new GetCommand({
            TableName: env.COURSE_TABLE,
            Key: new CourseKey({ courseId }),
          }),
        );
        if (!courseEntity) {
          await this.dynamoDBDocumentClient.send(new DeleteCommand({
            TableName: env.ATTACHMENT_TABLE,
            Key: new AttachmentKey({ lessonId, attachmentId }),
          }));
          return;
        }
        await this.dynamoDBDocumentClient.send(
          new TransactWriteCommand({
            TransactItems: [
              {
                Delete: {
                  TableName: env.ATTACHMENT_TABLE,
                  Key: new AttachmentKey({ lessonId, attachmentId }),
                },
              },
              {
                Update: {
                  TableName: env.COURSE_TABLE,
                  Key: new CourseKey({ courseId }),
                  ConditionExpression:
                    'attribute_exists(id) AND attribute_exists(courseId)',
                  UpdateExpression: 'ADD #numberOfAttachments :value0',
                  ExpressionAttributeNames: {
                    '#numberOfAttachments': 'numberOfAttachments',
                  },
                  ExpressionAttributeValues: {
                    ':value0': -1,
                  },
                },
              },
            ],
          }),
        );
        return;
      } catch (exception) {
        console.info('[LessonDeletedEventHandler:deleteAttachment] Exception thrown:', exception);
        console.info(`[LessonDeletedEventHandler:deleteAttachment] Attempting to retry (${RETRIES})...`);
        RETRIES++;
        if (RETRIES > MAX_RETRIES) {
          throw new MaxRetriesException(exception as Error);
        }
        await TimerService.sleepWith100MsBaseDelayExponentialBackoff(RETRIES);
      }
    }
  }
}