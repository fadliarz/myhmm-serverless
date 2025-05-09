import { DeleteCommand, DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import generateDynamoDBDocumentClient from '../../../common/generateDynamoDBDocumentClient';
import ScholarshipEventHandler from '../ScholarshipEventHandler';
import ScholarshipDeletedEvent from '../event/ScholarshipDeletedEvent';
import ScholarshipEntity from '../../../common/entity/ScholarshipEntity';
import TagLinkKey from '../../../common/entity/TagLinkKey';

export default class ScholarshipDeletedEventHandler extends ScholarshipEventHandler {
  private readonly dynamoDBDocumentClient: DynamoDBDocumentClient = generateDynamoDBDocumentClient();

  public async handle(scholarshipDeletedEvent: ScholarshipDeletedEvent) {
    const deletedScholarshipEntity: ScholarshipEntity = scholarshipDeletedEvent.data.OldImage;
    await this.deleteScholarshipLinks({
      scholarshipId: deletedScholarshipEntity.scholarshipId,
      tags: deletedScholarshipEntity.tags,
    });
  }

  private async deleteScholarshipLinks(param: { scholarshipId: number, tags?: Set<number> }): Promise<void> {
    const { scholarshipId, tags } = param;
    if (!tags) return;
    for (const tagId of Array.from(tags)) {
      await this.deleteScholarshipLink({ scholarshipId, tagId });
    }
  }

  private async deleteScholarshipLink(param: { scholarshipId: number, tagId: number }): Promise<void> {
    const { scholarshipId, tagId } = param;
    const env = await this.getEnv();
    await this.dynamoDBDocumentClient.send(new DeleteCommand({
      TableName: env.TAG_TABLE,
      Key: new TagLinkKey({ tagId, scholarshipId }),
    }));
  }
}