import { Context, SQSEvent, SQSHandler } from 'aws-lambda';
import { unmarshall } from '@aws-sdk/util-dynamodb';

export const handleClassAssignmentEvent: SQSHandler = async (
  event: SQSEvent,
  context: Context,
): Promise<void> => {
  for (const record of event.Records) {
    const body = JSON.parse(record.body);
    console.log('@handleClassAssignmentEvent * record:', record);
    console.log('@handleClassAssignmentEvent * body:', body);
    console.log('@handleClassAssignmentEvent * marshalled NewImage:', unmarshall(body.NewImage ?? {}));
    console.log('@handleClassAssignmentEvent * marshalled OldImage:', unmarshall(body.OldImage ?? {}));
  }
};