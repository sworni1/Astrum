"use client";

import axios from "axios";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useCallback, useMemo, useState } from "react";
import type { SubmitHandler } from "react-hook-form";
import { createSession } from "@/common/helpers/session";
import { showToast } from "@/common/helpers/showToast";
import {
  type SignInCredentials,
  type SignUpCredentials,
} from "@/common/types/auth.types";
import { resetSessionEnded, useFetcher } from "@/hooks/useFetcher";
import { useSessionCacheReset } from "@/hooks/useSessionCacheReset";

export const useAuth = () => {
  const { fetcher } = useFetcher();

  const resetSessionCache = useSessionCacheReset();

  const router = useRouter();

  const t = useTranslations("auth");

  const [emailTaken, setEmailTaken] = useState(false);

  const goNext = useCallback(() => router.push("/"), [router]);

  const goConfirmEmail = useCallback(
    () => router.push("/auth/confirm-email"),
    [router],
  );

  const handleRegister: SubmitHandler<SignUpCredentials> = useCallback(
    async (signUpData: SignUpCredentials) => {
      try {
        signUpData.dateOfBirth.toISOString();

        const res = await fetcher.post("/auth/register", signUpData);

        if (res.status === 200) {
          setEmailTaken(false);

          await createSession(res.data.token);

          resetSessionCache({ revalidate: true });

          resetSessionEnded();

          goConfirmEmail();

          showToast({
            title: t("createdTitle"),
            type: "success",
            description: t("createdText"),
          });
        }
      } catch (error) {
        if (axios.isAxiosError(error) && error.response) {
          if (error.response.status === 403) {
            setEmailTaken(true);
            showToast({
              title: t("emailTakenTitle"),
              description: t("emailTakenText"),
              type: "error",
            });
          } else {
            showToast({
              title: t("errorTitle"),
              description: t("errorForbidden"),
              type: "error",
            });
          }
        } else {
          showToast({
            title: t("errorTitle"),
            description: t("errorUnexpected"),
            type: "error",
          });
        }
      }
    },
    [goConfirmEmail, fetcher, resetSessionCache, t],
  );

  const handleSignIn: SubmitHandler<SignInCredentials> = useCallback(
    async (signInData: SignInCredentials) => {
      try {
        const res = await fetcher.post("/auth/signin", signInData);

        if (res.status === 200) {
          await createSession(res.data.token);

          resetSessionCache({ revalidate: true });

          resetSessionEnded();

          router.refresh();

          goNext();

          showToast({
            title: t("signInSuccessTitle"),
            type: "success",
            description: t("signInSuccessText"),
          });
        }
      } catch (error) {
        if (axios.isAxiosError(error) && error.response) {
          if (error.response.status === 403) {
            showToast({
              title: t("signInFailedTitle"),
              type: "error",
              description: t("signInFailedText"),
            });
          } else {
            showToast({
              title: t("errorTitle"),
              description: t("accessDenied"),
              type: "error",
            });
          }
        } else {
          showToast({
            title: t("errorTitle"),
            description: t("errorUnexpected"),
            type: "error",
          });
        }
      }
    },
    [goNext, fetcher, resetSessionCache, router, t],
  );

  return useMemo(
    () => ({
      handleRegister,
      handleSignIn,
      emailTaken,
    }),
    [handleRegister, handleSignIn, emailTaken],
  );
};
