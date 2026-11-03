"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { editPasswordFormSchema, showToast } from "../../../../../common";
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

  const form = useForm<updatePasswordUserDto>({
    resolver: zodResolver(editPasswordFormSchema),
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
            title: "Success!",
            type: "success",
            description: "Password updated successfully",
          });

          reset();
          setIsDialogOpen(false);
        },
        onError: () =>
          showToast({
            title: "Error!",
            type: "error",
            description: "The old password is incorrect",
          }),
      });
    } catch (error) {
      console.error(error);
    }
  };

  return (
    <div className="mt-8 pt-4">
      <h2 className="text-xl font-medium ">Change password</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Click the button below to change password.
      </p>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogTrigger asChild>
          <Button type="button" variant="destructive" className="mt-4">
            Change password
          </Button>
        </DialogTrigger>
        <DialogContent className="text-gray-900 dark:text-white">
          <DialogHeader>
            <DialogTitle>Update password</DialogTitle>
            <DialogDescription>
              Make changes to your profile here. Click save when you&apos;re
              done.
            </DialogDescription>
          </DialogHeader>

          <Form {...form}>
            <form onSubmit={handleSubmit(editPassword)} className="space-y-8">
              <FormField
                control={control}
                name="oldPassword"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Old password</FormLabel>
                    <FormControl>
                      <Input
                        type="password"
                        placeholder="Old password"
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
                    <FormLabel>New password</FormLabel>
                    <FormControl>
                      <Input
                        type="password"
                        placeholder="New password"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <DialogFooter>
                <DialogClose asChild>
                  <Button variant={"outline"}>Cancel</Button>
                </DialogClose>
                <Button type="submit" disabled={!isValid}>
                  Save changes
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
