export default class CourseEntity {
  public courseId!: number;
  public code!: string;
  public image!: string;
  public title!: string;
  public description!: string;
  public numberOfStudents!: number;
  public numberOfInstructors!: number;
  public numberOfClasses!: number;
  public numberOfAssignments!: number;
  public numberOfLessons!: number;
  public numberOfVideos!: number;
  public numberOfDurations!: number;
  public numberOfAttachments!: number;
  public categories!: Set<number>;
  public createdAt!: string;
  public updatedAt!: Date;
  public version!: number;
  public lessonArrangementVersion!: number;
}
