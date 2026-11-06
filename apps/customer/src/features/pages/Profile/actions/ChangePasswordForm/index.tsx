"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { createEditPasswordFormSchema, showToast } from "../../../../../common";
import type { updatePasswordUserDto } from "../../../../../common/dto/update-user.dto";
import { Button } from "../../../../../components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "../../../../../components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "../../../../../components/ui/form";
import { Input } from "../../../../../components/ui/input";
import { useUser } from "../../../../../hooks/user";

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
    <div className="mt-8 pt-4">
      <h2 className="text-xl font-medium ">{t("changePasswordTitle")}</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        {t("changePasswordSubtitle")}
      </p>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogTrigger asChild>
          <Button type="button" variant="destructive" className="mt-4">
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
