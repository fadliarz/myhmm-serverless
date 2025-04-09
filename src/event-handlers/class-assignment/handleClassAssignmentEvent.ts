import { Context, SQSEvent, SQSHandler } from 'aws-lambda';
import { unmarshall } from '@aws-sdk/util-dynamodb';

export const handleClassAssignmentEvent: SQSHandler = async (
  event: SQSEvent,
  context: Context,
): Promise<void> => {
  for (const record of event.Records) {
    const body = JSON.parse(record.body);
    const { Keys, NewImage, OldImage } = body.dynamodb;
    console.log('@handleClassAssignmentEvent * record:', record);
    console.log('@handleClassAssignmentEvent * body:', body);
    console.log('@handleClassAssignmentEvent * unmarshalled Keys:', unmarshall(Keys) ?? {});
    console.log('@handleClassAssignmentEvent * unmarshalled NewImage:', unmarshall(NewImage ?? {}));
    console.log('@handleClassAssignmentEvent * unmarshalled OldImage:', unmarshall(OldImage ?? {}));
  }
};