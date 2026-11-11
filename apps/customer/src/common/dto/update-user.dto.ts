import type { z } from "zod";
import type { createEditProfileFormSchema } from "@/common/zodSchemes/edit-profile.scheme";

// Single source of truth: the zod schema the profile form validates against.
export type updateUserDto = z.infer<
  ReturnType<typeof createEditProfileFormSchema>
>;

export type updatePasswordUserDto = {
  oldPassword: string;
  newPassword: string;
};
