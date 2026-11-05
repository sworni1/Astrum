"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import axios from "axios";
import dayjs from "dayjs";
import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import {
  editProfileFormSchema,
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

const describeProfileError = (error: unknown): string => {
  if (!axios.isAxiosError(error)) {
    return "Повторите попытку позже.";
  }

  const code = (error.response?.data as { code?: string } | undefined)?.code;

  if (code === "EMAIL_TAKEN") {
    return "Этот адрес занят другим аккаунтом.";
  }

  if (code === "EMAIL_UNCHANGED") {
    return "Адрес уже указан в профиле.";
  }

  if (code === "EMAIL_NOT_CONFIRMED") {
    return "Пока адрес не подтверждён, менять можно только почту.";
  }

  return "Повторите попытку позже.";
};

const EditProfileForm = ({ profileData }: Props) => {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isFormChanged, setIsFormChanged] = useState(false);

  const { updateAccountTrigger, mutateProfile } = useUser();
  const isPending = profileData.status === "PENDING";

  const defaultValues = useMemo<Partial<updateUserDto>>(
    () => ({
      email: profileData.email,
      nickName: profileData.nickName,
    }),
    [profileData.email, profileData.nickName],
  );

  const form = useForm<updateUserDto>({
    resolver: zodResolver(editProfileFormSchema),
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
        title: "Изменений нет",
        description: "Поля совпадают с профилем.",
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
                  title: "Проверьте новую почту",
                  description:
                    "Мы отправили письмо со ссылкой на новый адрес. Заказы откроются после подтверждения.",
                  type: "success",
                }
              : {
                  title: "Профиль обновлён",
                  type: "success",
                },
          );

          setIsFormChanged(false);
          setIsDialogOpen(false);
          await mutateProfile();
        },
        onError: (error: unknown) =>
          showToast({
            title: "Не удалось сохранить",
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

  return (
    <>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(editUser)} className="space-y-8">
          <FormField
            control={form.control}
            name="nickName"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Username</FormLabel>
                <FormControl>
                  <Input
                    placeholder="shadcn"
                    {...field}
                    value={field.value ?? ""}
                    disabled={isPending}
                  />
                </FormControl>
                {isPending ? (
                  <FormDescription>
                    Ник можно изменить после подтверждения почты.
                  </FormDescription>
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
                <FormLabel>Email</FormLabel>
                <FormControl>
                  <Input placeholder="email" {...field} />
                </FormControl>
                <FormDescription>
                  {isPending
                    ? "Пока адрес не подтверждён, менять можно только его."
                    : "После смены адреса аккаунт снова ждёт подтверждения."}
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <div className="space-y-2">
            <Label htmlFor="dateOfBirth">Date of birth</Label>
            <Input
              id="dateOfBirth"
              readOnly
              disabled
              value={dayjs(profileData?.dateOfBirth).format("YYYY-MM-DD")}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="gender">Gender</Label>
            <Input id="gender" readOnly disabled value={profileData.gender} />
          </div>

          <AlertDialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <AlertDialogTrigger asChild>
              <Button
                type="button"
                disabled={!isFormChanged || !form.formState.isValid}
              >
                Update profile
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                <AlertDialogDescription>
                  Изменения сохранятся в профиле.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={() => editUser(form.getValues())}>
                  Confirm
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
