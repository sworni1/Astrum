"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Lock } from "lucide-react";
import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import type { updatePasswordUserDto } from "@/common/dto/update-user.dto";
import { showToast } from "@/common/helpers/showToast";
import { createEditPasswordFormSchema } from "@/common/zodSchemes/edit-password.scheme";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  ACTION_SIZE,
  ROW,
  ROW_HINT,
  ROW_TEXT,
} from "@/features/pages/Profile/lib/styles";
import { useUser } from "@/hooks/user/useUser";

const ChangePasswordForm = () => {
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const { updatePasswordTrigger } = useUser();
  const t = useTranslations("profile");
  const common = useTranslations("common");
  const validation = useTranslations("validation");

  const schema = useMemo(
    () => createEditPasswordFormSchema(validation),
    [validation],
  );

  const form = useForm<updatePasswordUserDto>({
    resolver: zodResolver(schema),
    mode: "onChange",
  });

  const {
    control,
    handleSubmit,
    reset,
    formState: { isValid },
  } = form;

  const editPassword = async (data: updatePasswordUserDto) => {
    try {
      await updatePasswordTrigger(data, {
        onSuccess: () => {
          showToast({
            title: t("passwordUpdated"),
            type: "success",
          });

          reset();
          setIsDialogOpen(false);
        },
        onError: () =>
          showToast({
            title: t("oldPasswordWrong"),
            type: "error",
          }),
      });
    } catch (error) {
      console.error(error);
    }
  };

  return (
    <div className={ROW} data-testid="change-password-row">
      <div>
        <div className={ROW_TEXT}>{t("changePasswordTitle")}</div>
        <p className={ROW_HINT}>{t("changePasswordSubtitle")}</p>
      </div>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogTrigger asChild>
          <Button type="button" variant="outline" className={ACTION_SIZE}>
            <Lock />
            {t("changePasswordButton")}
          </Button>
        </DialogTrigger>
        <DialogContent className="text-gray-900 dark:text-white">
          <DialogHeader>
            <DialogTitle>{t("updatePasswordTitle")}</DialogTitle>
            <DialogDescription>{t("updatePasswordSubtitle")}</DialogDescription>
          </DialogHeader>

          <Form {...form}>
            <form onSubmit={handleSubmit(editPassword)} className="space-y-8">
              <FormField
                control={control}
                name="oldPassword"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("oldPassword")}</FormLabel>
                    <FormControl>
                      <Input
                        type="password"
                        placeholder={t("oldPassword")}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={control}
                name="newPassword"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("newPassword")}</FormLabel>
                    <FormControl>
                      <Input
                        type="password"
                        placeholder={t("newPassword")}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <DialogFooter>
                <DialogClose asChild>
                  <Button variant={"outline"}>{common("cancel")}</Button>
                </DialogClose>
                <Button type="submit" disabled={!isValid}>
                  {t("saveChanges")}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ChangePasswordForm;
