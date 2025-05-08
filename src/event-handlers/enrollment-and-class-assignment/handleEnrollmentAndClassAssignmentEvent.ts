import 'dotenv/config';
import { SQSEvent, SQSHandler } from 'aws-lambda';

export const handleEnrollmentAndClassAssignmentEvent: SQSHandler = async (
  event: SQSEvent,
): Promise<void> => {
  for (const record of event.Records) {
    const body = JSON.parse(record.body);
    console.log('body:', body);
  }
};