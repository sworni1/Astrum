import type { z } from "zod";
import type { createEditProfileFormSchema } from "@/common/zodSchemes/edit-profile.scheme";

export type updateUserDto = z.infer<
  ReturnType<typeof createEditProfileFormSchema>
>;

export type updatePasswordUserDto = {
  oldPassword: string;
  newPassword: string;
};
