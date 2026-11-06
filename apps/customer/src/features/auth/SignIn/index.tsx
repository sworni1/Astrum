"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useMemo } from "react";
import { useForm } from "react-hook-form";
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
import { cn } from "@/lib/utils";
import {
  createSignInFormSchema,
  type SignInCredentials,
} from "../../../common";
import { useAuth } from "../../../hooks";

export default function SignIn() {
  const { handleSignIn } = useAuth();
  const t = useTranslations("auth");
  const validation = useTranslations("validation");

  const schema = useMemo(
    () => createSignInFormSchema(validation),
    [validation],
  );

  const form = useForm<SignInCredentials>({
    resolver: zodResolver(schema),
    defaultValues: {
      email: "",
      password: "",
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
          <CardTitle className="text-2xl">{t("signInTitle")}</CardTitle>
          <CardDescription>{t("signInDescription")}</CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={handleSubmit(handleSignIn)}>
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

                <Button disabled={!isValid} type="submit" className="w-full">
                  {t("signIn")}
                </Button>
              </div>
              <div className="mt-4 text-center text-sm">
                {t("needAccount")}&nbsp;{" "}
                <Link
                  href="/auth/register"
                  className="underline underline-offset-4"
                >
                  {t("register")}
                </Link>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
