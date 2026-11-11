"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useMemo } from "react";
import { useForm } from "react-hook-form";
import { type SignUpCredentials } from "@/common/types/auth.types";
import { createRegisterFormSchema } from "@/common/zodSchemes/auth.scheme";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@/hooks/auth/useAuth";
import { useResendConfirmation } from "@/hooks/user/useResendConfirmation";
import { cn } from "@/lib/utils";
import { DateOfBirthField } from "./DateOfBirthField";

export default function Register() {
  const { handleRegister, emailTaken } = useAuth();
  const { send, isSending, isCoolingDown } = useResendConfirmation();
  const t = useTranslations("auth");
  const validation = useTranslations("validation");

  const schema = useMemo(
    () => createRegisterFormSchema(validation),
    [validation],
  );

  const form = useForm<SignUpCredentials>({
    resolver: zodResolver(schema),
    defaultValues: {
      email: "",
      password: "",
      nickName: "",
      dateOfBirth: undefined,
      gender: undefined,
    },
    mode: "onChange",
  });

  const {
    control,
    handleSubmit,
    formState: { isValid },
  } = form;

  return (
    <div className={cn("flex flex-col gap-6")}>
      <Card className="bg-[hsl(var(--card))]">
        <CardHeader>
          <CardTitle className="text-2xl">{t("registerTitle")}</CardTitle>
          <CardDescription>{t("registerDescription")}</CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={handleSubmit(handleRegister)}>
              <div className="flex flex-col gap-6">
                <FormField
                  name="email"
                  control={control}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("email")}</FormLabel>
                      <FormControl>
                        <Input
                          placeholder={t("emailPlaceholder")}
                          {...field}
                          id="email"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  name="password"
                  control={control}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("password")}</FormLabel>
                      <FormControl>
                        <Input
                          type="password"
                          placeholder={t("passwordPlaceholder")}
                          {...field}
                          id="password"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  name="nickName"
                  control={control}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("nickname")}</FormLabel>
                      <FormControl>
                        <Input
                          placeholder={t("nicknamePlaceholder")}
                          {...field}
                          value={field.value || ""}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="dateOfBirth"
                  render={({ field }) => (
                    <FormItem className="flex flex-col">
                      <FormLabel>{t("dateOfBirth")}</FormLabel>
                      <DateOfBirthField
                        name={field.name}
                        value={field.value}
                        onChange={field.onChange}
                        onBlur={field.onBlur}
                      />
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  name="gender"
                  control={control}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("gender")}</FormLabel>
                      <FormControl>
                        <Select
                          value={field.value ?? ""}
                          onValueChange={(value) =>
                            field.onChange(value as "Male" | "Female")
                          }
                        >
                          <SelectTrigger>
                            <SelectValue placeholder={t("genderPlaceholder")} />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Male">
                              {t("genderMale")}
                            </SelectItem>
                            <SelectItem value="Female">
                              {t("genderFemale")}
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <Button disabled={!isValid} type="submit" className="w-full">
                  {t("signUp")}
                </Button>

                {emailTaken ? (
                  <div className="flex flex-col gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm">
                    <p>{t("emailTaken")}</p>
                    <div className="flex flex-wrap items-center gap-4">
                      <Link
                        href="/auth/signin"
                        className="underline underline-offset-4"
                      >
                        {t("goToSignIn")}
                      </Link>
                      <button
                        type="button"
                        className="underline underline-offset-4 disabled:opacity-50"
                        disabled={isSending || isCoolingDown}
                        onClick={() => void send(form.getValues("email"))}
                      >
                        {t("resendAgain")}
                      </button>
                    </div>
                  </div>
                ) : null}
              </div>
              <div className="mt-4 text-center text-sm">
                {t("haveAccount")}&nbsp;{" "}
                <Link
                  href="/auth/signin"
                  className="underline underline-offset-4"
                >
                  {t("signIn")}
                </Link>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
