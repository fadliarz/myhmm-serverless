export default class LessonEntity {
  public lessonId!: number;
  public courseId!: number;
  public title!: string;
  public description!: string;
  public numberOfVideos!: number;
  public numberOfDurations!: number;
  public numberOfAttachments!: number;
  public createdAt!: string;
  public updatedAt!: string;
  public version!: number;
  public videoArrangementVersion!: number;
}
