import { DeleteCommand, DynamoDBDocumentClient, QueryCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import generateDynamoDBDocumentClient from '../../../common/generateDynamoDBDocumentClient';
import TimerService from '../../../common/TimerService';
import MaxRetriesException from '../../../common/MaxRetriesException';
import TagEventHandler from '../TagEventHandler';
import TagDeletedEvent from '../event/TagDeletedEvent';
import { ConditionalCheckFailedException } from '@aws-sdk/client-dynamodb';
import TagEntity from '../../../common/entity/TagEntity';
import ScholarshipKey from '../../../common/entity/ScholarshipKey';
import TagLinkKey from '../../../common/entity/TagLinkKey';

export default class TagDeletedEventHandler extends TagEventHandler {
  private readonly dynamoDBDocumentClient: DynamoDBDocumentClient = generateDynamoDBDocumentClient();

  public async handle(tagDeletedEvent: TagDeletedEvent) {
    const tagEntity: TagEntity = tagDeletedEvent.data.OldImage;
    await this.removeScholarshipTags({ tagId: tagEntity.tagId });
  }

  private async removeScholarshipTags(param: { tagId: number }): Promise<void> {
    const { tagId } = param;
    const env = await this.getEnv();
    let lastEvaluatedKey: Record<string, any> | undefined = undefined;
    do {
      const {
        Items: tagLinkKeys,
        LastEvaluatedKey,
      } = await this.dynamoDBDocumentClient.send(new QueryCommand({
        TableName: env.TAG_TABLE,
        KeyConditionExpression: '#id = :value0',
        ExpressionAttributeNames: {
          '#id': 'id',
        },
        ExpressionAttributeValues: {
          ':value0': String(tagId),
        },
        ExclusiveStartKey: lastEvaluatedKey,
      }));
      console.info(`[TagDeletedEventHandler] Retrieved ${tagLinkKeys?.length ?? 0} tags`);
      if (tagLinkKeys) {
        for (const tagLinkKey of tagLinkKeys as TagEntity[]) {
          await this.removeScholarshipTag({
            key: {
              scholarshipId: tagLinkKey.tagId,
              tagId,
            },
          });
        }
      }
      lastEvaluatedKey = LastEvaluatedKey as any;
    } while (lastEvaluatedKey);
  }

  private async removeScholarshipTag(param: {
    key: {
      scholarshipId: number,
      tagId: number
    }
  }): Promise<void> {
    const { scholarshipId, tagId } = param.key;
    let RETRIES: number = 0;
    const MAX_RETRIES: number = 3;
    while (RETRIES <= MAX_RETRIES) {
      try {
        await this.removeTagFromScholarship(scholarshipId, tagId);
        await this.deleteTagLink(scholarshipId, tagId);
        return;
      } catch (exception) {
        console.info('[TagDeletedEventHandler:removeScholarshipTag] Exception thrown:', exception);
        console.info(`[TagDeletedEventHandler:removeScholarshipTag] Attempting to retry (${RETRIES})...`);
        RETRIES++;
        if (RETRIES > MAX_RETRIES) {
          throw new MaxRetriesException(exception as Error);
        }
        await TimerService.sleepWith100MsBaseDelayExponentialBackoff(RETRIES);
      }
    }
  }

  private async removeTagFromScholarship(
    scholarshipId: number,
    tagId: number,
  ): Promise<void> {
    const env = await this.getEnv();
    try {
      await this.dynamoDBDocumentClient.send(
        new UpdateCommand({
          TableName: env.SCHOLARSHIP_TABLE,
          Key: new ScholarshipKey({ scholarshipId }),
          ConditionExpression:
            'attribute_exists(id) AND attribute_exists(scholarshipId)',
          UpdateExpression: 'DELETE #tags :tagId',
          ExpressionAttributeNames: {
            '#tags': 'tag',
          },
          ExpressionAttributeValues: {
            ':tagId': new Set([tagId]),
          },
        }),
      );
    } catch (exception) {
      if (exception instanceof ConditionalCheckFailedException) return;
      console.info('[TagDeletedEventHandler:removeTagFromScholarship] Exception thrown: ', exception);
      throw exception;
    }
  }

  private async deleteTagLink(
    scholarshipId: number,
    tagId: number,
  ): Promise<void> {
    const env = await this.getEnv();
    try {
      await this.dynamoDBDocumentClient.send(
        new DeleteCommand({
          TableName: env.TAG_TABLE,
          Key: new TagLinkKey({ tagId, scholarshipId }),
        }),
      );
    } catch (exception) {
      console.info('[TagDeletedEventHandler:deleteTagLink] Exception thrown: ', exception);
    }
  }
}