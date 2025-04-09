import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import generateDynamoDBDocumentClient from '../../../common/generateDynamoDBDocumentClient';

export default class ClassAssignmentUpdatedEventHandler {

  private readonly dynamoDBDocumentClient: DynamoDBDocumentClient = generateDynamoDBDocumentClient();

  public async handle() {
    console.log('Handling ClassAssignmentUpdatedEvent...');
  }
}