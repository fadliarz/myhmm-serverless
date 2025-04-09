import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import generateDynamoDBDocumentClient from '../../../common/generateDynamoDBDocumentClient';

export default class ClassAssignmentDeletedEventHandler {

  private readonly dynamoDBDocumentClient: DynamoDBDocumentClient = generateDynamoDBDocumentClient();

  public async handle() {
    console.log('Handling ClassAssignmentDeletedEvent...');
  }
}