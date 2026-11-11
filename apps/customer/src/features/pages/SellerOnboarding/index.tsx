"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useEffect, useMemo, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { showToast } from "@/common/helpers/showToast";
import {
  createShopNameSchema,
  type ShopNameForm,
} from "@/common/zodSchemes/shop-name.scheme";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { sellerErrorCode } from "@/hooks/seller/sellerError";
import { useBecomeSeller } from "@/hooks/seller/useBecomeSeller";
import { useUser } from "@/hooks/user/useUser";

export type OnboardingState =
  | "loading"
  | "failure"
  | "success"
  | "alreadySeller"
  | "form";

type StateInput = {
  created: boolean;
  profileIsLoading: boolean;
  profileIsError: boolean;
  isSeller: boolean;
};

/** One state shows at a time: success beats already sells beats the form (AC-3). */
export const resolveOnboardingState = ({
  created,
  profileIsLoading,
  profileIsError,
  isSeller,
}: StateInput): OnboardingState => {
  if (created) {
    return "success";
  }

  if (profileIsLoading) {
    return "loading";
  }

  if (profileIsError) {
    return "failure";
  }

  if (isSeller) {
    return "alreadySeller";
  }

  return "form";
};

const LoadingState = ({ label }: { label: string }) => (
  <div
    className="mx-auto max-w-screen-xl px-4 py-6 2xl:px-0"
    aria-label={label}
  >
    <Skeleton className="h-7 w-48" />
    <Skeleton className="mt-3 h-4 w-64" />
    <Skeleton className="mt-6 h-8 w-full max-w-sm" />
  </div>
);

export default function SellerOnboarding() {
  const t = useTranslations("seller");
  const validation = useTranslations("validation");
  const { profileData, profileIsLoading, profileIsError, mutateProfile } =
    useUser();
  const { becomeSeller, isSubmitting } = useBecomeSeller();
  const [createdName, setCreatedName] = useState<string | null>(null);
  const successHeading = useRef<HTMLHeadingElement>(null);

  const schema = useMemo(() => createShopNameSchema(validation), [validation]);
  const form = useForm<ShopNameForm>({
    resolver: zodResolver(schema),
    defaultValues: { name: "" },
    mode: "onChange",
  });

  const state = resolveOnboardingState({
    created: createdName !== null,
    profileIsLoading,
    profileIsError,
    isSeller: profileData?.isSeller === true,
  });
  const isPending = profileData?.status === "PENDING";

  useEffect(() => {
    if (state === "success") {
      successHeading.current?.focus();
    }
  }, [state]);

  const submit = async (data: ShopNameForm) => {
    try {
      const result = await becomeSeller({ name: data.name });

      if (!result.isSeller) {
        return;
      }

      await mutateProfile();
      setCreatedName(result.businessName);
      showToast({ title: t("onboarding.successToast"), type: "success" });
    } catch (error) {
      const code = sellerErrorCode(error);

      if (code === "VALIDATION") {
        form.setError("name", { message: t("onboarding.errors.validation") });
        return;
      }

      if (code === "EMAIL_NOT_CONFIRMED") {
        showToast({
          title: t("onboarding.errors.emailNotConfirmed"),
          type: "warning",
        });
        await mutateProfile();
        return;
      }

      showToast({
        title: t("onboarding.errors.failureTitle"),
        description: t("onboarding.errors.failureText"),
        type: "error",
        action: {
          label: t("onboarding.retry"),
          onClick: () => {
            void form.handleSubmit(submit)();
          },
        },
      });
    }
  };

  if (state === "loading") {
    return <LoadingState label={t("onboarding.loadingLabel")} />;
  }

  if (state === "failure") {
    return (
      <section className="mx-auto max-w-screen-xl px-4 py-12 text-center 2xl:px-0">
        <h1 className="text-xl font-semibold">
          {t("onboarding.failureTitle")}
        </h1>
        <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
          {t("onboarding.failureText")}
        </p>
        <Button className="mt-4" onClick={() => void mutateProfile()}>
          {t("onboarding.retry")}
        </Button>
      </section>
    );
  }

  if (state === "success") {
    return (
      <section className="mx-auto max-w-screen-xl px-4 py-12 2xl:px-0">
        <div
          role="status"
          aria-live="polite"
          className="mx-auto max-w-xl space-y-3 rounded-xl border p-6"
        >
          <h1
            ref={successHeading}
            tabIndex={-1}
            className="text-xl font-semibold outline-none"
          >
            {t("onboarding.successTitle")}
          </h1>
          <p className="text-sm text-muted-foreground">
            {t("onboarding.successText")}
          </p>
          <p className="text-lg font-medium">{createdName}</p>
          <Button asChild>
            <Link href="/seller/orders">{t("onboarding.successAction")}</Link>
          </Button>
        </div>
      </section>
    );
  }

  if (state === "alreadySeller") {
    return (
      <section className="mx-auto max-w-screen-xl px-4 py-12 2xl:px-0">
        <div className="mx-auto max-w-xl space-y-3 rounded-xl border p-6">
          <h1 className="text-xl font-semibold">
            {t("onboarding.alreadyTitle")}
          </h1>
          <p className="text-sm text-muted-foreground">
            {t("onboarding.alreadyText")}
          </p>
          <Button asChild>
            <Link href="/seller/orders">{t("onboarding.alreadyAction")}</Link>
          </Button>
        </div>
      </section>
    );
  }

  return (
    <section className="py-4 antialiased md:py-8">
      <div className="mx-auto max-w-screen-xl px-4 2xl:px-0">
        <h1 className="text-xl font-medium">{t("onboarding.title")}</h1>
        <p className="mt-1 max-w-xl text-sm text-muted-foreground">
          {t("onboarding.subtitle")}
        </p>

        {isPending && (
          <div
            role="status"
            className="mt-4 max-w-xl rounded-lg border border-dashed px-3 py-2 text-sm"
          >
            {t("onboarding.pendingNotice")}
          </div>
        )}

        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(submit)}
            className="mt-6 max-w-xl space-y-4"
          >
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("onboarding.nameLabel")}</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      value={field.value ?? ""}
                      disabled={isPending || isSubmitting}
                    />
                  </FormControl>
                  <FormDescription>{t("onboarding.nameHint")}</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <Button
              type="submit"
              disabled={isPending || isSubmitting || !form.formState.isValid}
            >
              {isSubmitting
                ? t("onboarding.submitting")
                : t("onboarding.submit")}
            </Button>
          </form>
        </Form>
      </div>
    </section>
  );
}
