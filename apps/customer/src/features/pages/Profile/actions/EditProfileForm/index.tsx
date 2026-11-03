"use client";

import { zodResolver } from "@hookform/resolvers/zod";
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

  const { updateAccountTrigger } = useUser();

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
    try {
      await updateAccountTrigger(data, {
        onSuccess: () => {
          showToast({
            title: "Success!",
            type: "success",
            description: "Profile updated successfully",
          });

          setIsFormChanged(false);
        },
        onError: () =>
          showToast({
            title: "Error!",
            type: "error",
            description: "The email is occupied by another user",
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
                  <Input placeholder="shadcn" {...field} />
                </FormControl>
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
                  This will update your data.
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
