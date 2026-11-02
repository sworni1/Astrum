import type { z } from "zod";
import type { editProfileFormSchema } from "../zodSchemes/edit-profile.scheme";

// Single source of truth: the zod schema the profile form validates against.
export type updateUserDto = z.infer<typeof editProfileFormSchema>;

export type updatePasswordUserDto = {
  oldPassword: string;
  newPassword: string;
};
