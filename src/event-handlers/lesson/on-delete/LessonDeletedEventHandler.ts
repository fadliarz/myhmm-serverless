import { DeleteCommand, DynamoDBDocumentClient, QueryCommand } from '@aws-sdk/lib-dynamodb';
import generateDynamoDBDocumentClient from '../../../common/generateDynamoDBDocumentClient';
import TimerService from '../../../common/TimerService';
import MaxRetriesException from '../../../common/MaxRetriesException';
import LessonEventHandler from '../LessonEventHandler';
import LessonDeletedEvent from '../event/LessonDeletedEvent';
import LessonEntity from '../../../common/entity/LessonEntity';
import VideoEntity from '../../../common/entity/VideoEntity';
import AttachmentEntity from '../../../common/entity/AttachmentEntity';

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
    let deletedVideoCount: number = 0;
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
      if (videoEntities) {
        for (const videoEntity of videoEntities as VideoEntity[]) {
          await this.deleteVideo({
            key: {
              lessonId,
              videoId: videoEntity.videoId,
            },
          });
          deletedVideoCount++;
        }
      }
      lastEvaluatedKey = LastEvaluatedKey as any;
    } while (lastEvaluatedKey);
    console.info('@LessonDeletedEventHandler * successfully deleted ' + deletedVideoCount + ' videos!');
  }

  private async deleteVideo(param: {
    key: {
      lessonId: number,
      videoId: number
    }
  }): Promise<void> {
    const env = await this.getEnv();
    let RETRIES: number = 0;
    const MAX_RETRIES: number = 3;
    while (RETRIES <= MAX_RETRIES) {
      try {
        await this.dynamoDBDocumentClient.send(new DeleteCommand({
          TableName: env.VIDEO_TABLE,
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

  private async deleteAttachments(param: { lessonId: number }): Promise<void> {
    const { lessonId } = param;
    const env = await this.getEnv();
    let deletedAttachmentCount: number = 0;
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
      if (attachmentEntities) {
        for (const attachmentEntity of attachmentEntities as AttachmentEntity[]) {
          await this.deleteAttachment({
            key: {
              lessonId,
              attachmentId: attachmentEntity.attachmentId,
            },
          });
          deletedAttachmentCount++;
        }
      }
      lastEvaluatedKey = LastEvaluatedKey as any;
    } while (lastEvaluatedKey);
    console.info('@LessonDeletedEventHandler * successfully deleted ' + deletedAttachmentCount + ' attachments!');
  }

  private async deleteAttachment(param: {
    key: {
      lessonId: number,
      attachmentId: number
    }
  }): Promise<void> {
    const env = await this.getEnv();
    let RETRIES: number = 0;
    const MAX_RETRIES: number = 3;
    while (RETRIES <= MAX_RETRIES) {
      try {
        await this.dynamoDBDocumentClient.send(new DeleteCommand({
          TableName: env.ATTACHMENT_TABLE,
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