import { AssignmentTaskType } from './AssignmentTaskType';

export default class ClassAssignmentEntity {
  public assignmentId!: number;
  public courseId!: number;
  public classId!: number;
  public title!: string;
  public submission!: string;
  public deadline!: string;
  public description!: string;
  public taskType!: AssignmentTaskType;
  public createdAt!: string;
  public updatedAt!: string;

  constructor() {
  }
}
