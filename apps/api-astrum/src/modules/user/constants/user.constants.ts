export const USER_PROFILE_SELECT = {
  nickName: true,
  email: true,
  dateOfBirth: true,
  gender: true,
  status: true,
  business: { select: { id: true } },
  pointWorker: { select: { id: true } },
  courier: { select: { id: true } },
} as const;

export const USER_ERROR_CODES = {
  emailNotConfirmed: "EMAIL_NOT_CONFIRMED",
  emailUnchanged: "EMAIL_UNCHANGED",
  emailTaken: "EMAIL_TAKEN",
} as const;
