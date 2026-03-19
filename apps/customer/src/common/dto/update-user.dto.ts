export type updateUserDto = {
  nickName?: string;
  email?: string;
};

export type updatePasswordUserDto = {
  oldPassword: string;
  newPassword: string;
};
