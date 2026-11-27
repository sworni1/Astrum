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
  notFound: "USER_NOT_FOUND",
  emailNotConfirmed: "EMAIL_NOT_CONFIRMED",
  emailUnchanged: "EMAIL_UNCHANGED",
  emailTaken: "EMAIL_TAKEN",
  invalidOldPassword: "INVALID_OLD_PASSWORD",
  deleteRestricted: "USER_DELETE_RESTRICTED",
} as const;
