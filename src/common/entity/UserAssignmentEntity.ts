import { AssignmentTaskType } from './AssignmentTaskType';
import { AssignmentType } from '../AssignmentType';
import { CompletionStatus } from '../CompletionStatus';

export default class UserAssignmentEntity {
  public userId!: number;
  public assignmentId!: number;
  public course!: string;
  public title!: string;
  public submission!: string;
  public deadline!: string;
  public description!: string;
  public taskType!: AssignmentTaskType;
  public assignmentType!: AssignmentType;
  public completionStatus!: CompletionStatus;
  public createdAt!: string;
  public classId!: number;
}
