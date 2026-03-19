export enum Gender {
  Male,
  Female,
}

export type SignUpCredentials = {
  email: string;
  password: string;
  nickName: string | null;
  dateOfBirth: Date;
  gender: Gender;
};

export type SignInCredentials = {
  email: string;
  password: string;
};
