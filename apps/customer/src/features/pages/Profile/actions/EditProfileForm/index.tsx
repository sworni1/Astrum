"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import axios from "axios";
import { useFormatter, useTranslations } from "next-intl";
import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import {
  createEditProfileFormSchema,
  showToast,
  type UserData,
} from "../../../../../common";
import type { updateUserDto } from "../../../../../common/dto/update-user.dto";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "../../../../../components/ui/alert-dialog";
import { Button } from "../../../../../components/ui/button";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "../../../../../components/ui/form";
import { Input } from "../../../../../components/ui/input";
import { Label } from "../../../../../components/ui/label";
import { useUser } from "../../../../../hooks";

type Props = {
  profileData: UserData;
};

const EditProfileForm = ({ profileData }: Props) => {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isFormChanged, setIsFormChanged] = useState(false);

  const { updateAccountTrigger, mutateProfile } = useUser();
  const isPending = profileData.status === "PENDING";
  const t = useTranslations("profile");
  const common = useTranslations("common");
  const validation = useTranslations("validation");
  const format = useFormatter();

  const describeProfileError = (error: unknown): string => {
    if (!axios.isAxiosError(error)) {
      return t("tryLater");
    }

    const code = (error.response?.data as { code?: string } | undefined)?.code;

    if (code === "EMAIL_TAKEN") {
      return t("errorEmailTaken");
    }

    if (code === "EMAIL_UNCHANGED") {
      return t("errorEmailUnchanged");
    }

    if (code === "EMAIL_NOT_CONFIRMED") {
      return t("errorEmailNotConfirmed");
    }

    return t("tryLater");
  };

  const schema = useMemo(
    () => createEditProfileFormSchema(validation),
    [validation],
  );

  const defaultValues = useMemo<Partial<updateUserDto>>(
    () => ({
      email: profileData.email,
      nickName: profileData.nickName,
    }),
    [profileData.email, profileData.nickName],
  );

  const form = useForm<updateUserDto>({
    resolver: zodResolver(schema),
    defaultValues,
    mode: "onChange",
  });

  const editUser = async (data: updateUserDto) => {
    const payload: Partial<updateUserDto> = {};

    if (data.email !== profileData.email) {
      payload.email = data.email;
    }

    if (!isPending && data.nickName !== profileData.nickName) {
      payload.nickName = data.nickName;
    }

    if (!payload.email && !payload.nickName) {
      showToast({
        title: t("noChangesTitle"),
        description: t("noChangesText"),
        type: "info",
      });
      setIsDialogOpen(false);
      return;
    }

    try {
      await updateAccountTrigger(payload, {
        onSuccess: async () => {
          showToast(
            payload.email
              ? {
                  title: t("checkNewEmailTitle"),
                  description: t("checkNewEmailText"),
                  type: "success",
                }
              : {
                  title: t("profileUpdated"),
                  type: "success",
                },
          );

          setIsFormChanged(false);
          setIsDialogOpen(false);
          await mutateProfile();
        },
        onError: (error: unknown) =>
          showToast({
            title: t("saveFailed"),
            type: "error",
            description: describeProfileError(error),
          }),
      });
    } catch (error) {
      console.error(error);
    }
  };

  useEffect(() => {
    const subscription = form.watch((value) => {
      if (
        value.email !== defaultValues.email ||
        value.nickName !== defaultValues.nickName
      ) {
        setIsFormChanged(true);
      } else {
        setIsFormChanged(false);
      }
    });
    return () => subscription.unsubscribe();
  }, [form, defaultValues]);

  const gender = String(profileData.gender);
  const genderLabel =
    gender === "Female"
      ? t("genderFemale")
      : gender === "Male"
        ? t("genderMale")
        : gender;

  return (
    <>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(editUser)} className="space-y-8">
          <FormField
            control={form.control}
            name="nickName"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t("username")}</FormLabel>
                <FormControl>
                  <Input
                    placeholder="shadcn"
                    {...field}
                    value={field.value ?? ""}
                    disabled={isPending}
                  />
                </FormControl>
                {isPending ? (
                  <FormDescription>{t("nicknameLocked")}</FormDescription>
                ) : null}
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t("email")}</FormLabel>
                <FormControl>
                  <Input placeholder="email" {...field} />
                </FormControl>
                <FormDescription>
                  {isPending ? t("emailPendingNote") : t("emailChangeNote")}
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <div className="space-y-2">
            <Label htmlFor="dateOfBirth">{t("dateOfBirth")}</Label>
            <Input
              id="dateOfBirth"
              readOnly
              disabled
              value={format.dateTime(new Date(profileData.dateOfBirth), {
                dateStyle: "long",
              })}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="gender">{t("gender")}</Label>
            <Input
              id="gender"
              readOnly
              disabled
              value={genderLabel}
            />
          </div>

          <AlertDialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <AlertDialogTrigger asChild>
              <Button
                type="button"
                disabled={!isFormChanged || !form.formState.isValid}
              >
                {t("updateProfile")}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>{t("sureTitle")}</AlertDialogTitle>
                <AlertDialogDescription>
                  {t("saveConfirmText")}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>{common("cancel")}</AlertDialogCancel>
                <AlertDialogAction onClick={() => editUser(form.getValues())}>
                  {common("confirm")}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </form>
      </Form>
    </>
  );
};

export default EditProfileForm;
