export default class UserEntity {
  public userId!: number;
  public avatar!: string;
  public email!: string;
  public password!: string;
  public phoneNumber!: string;
  public name!: string;
  public about!: string;
  public createdAt!: string;
  public updatedAt!: string;
  public dateOfBirth!: string;
  public address!: string;
  public bloodType!: string;
  public medicalHistories!: string[];
  public enrolledStudentUnits!: string[];
  public hobbies!: string[];
  public lineId!: string;
  public emergencyNumber!: string;
  public numberOfManagedClasses!: number;
}
