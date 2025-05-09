export default class ScholarshipEntity {
  public scholarshipId!: number;
  public image!: string;
  public title!: string;
  public description!: string;
  public provider!: string;
  public deadline!: string;
  public reference!: string;
  public tags!: Set<number>;
  public createdAt!: Date;
  public updatedAt!: Date;
}
