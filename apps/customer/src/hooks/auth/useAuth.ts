"use client";

import axios from "axios";
import { useRouter } from "next/navigation";
import { useCallback, useMemo, useState } from "react";
import type { SubmitHandler } from "react-hook-form";
import {
  type SignInCredentials,
  type SignUpCredentials,
  showToast,
} from "../../common";
import { createSession } from "../../common/helpers/session";
import { resetSessionEnded, useFetcher } from "../useFetcher";

export const useAuth = () => {
  const { fetcher } = useFetcher();

  const router = useRouter();

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

          resetSessionEnded();

          goConfirmEmail();

          showToast({
            title: "Аккаунт создан",
            type: "success",
            description: "Проверьте почту и подтвердите адрес",
          });
        }
      } catch (error) {
        if (axios.isAxiosError(error) && error.response) {
          if (error.response.status === 403) {
            setEmailTaken(true);
            showToast({
              title: "Адрес уже зарегистрирован",
              description: "Войдите в аккаунт или отправьте письмо снова",
              type: "error",
            });
          } else {
            showToast({
              title: "Error",
              description: "Forbidden: Access to the resource is denied",
              type: "error",
            });
          }
        } else {
          showToast({
            title: "Error",
            description: "An unexpected error occurred",
            type: "error",
          });
        }
      }
    },
    [goConfirmEmail, fetcher],
  );

  const handleSignIn: SubmitHandler<SignInCredentials> = useCallback(
    async (signInData: SignInCredentials) => {
      try {
        const res = await fetcher.post("/auth/signin", signInData);

        if (res.status === 200) {
          await createSession(res.data.token);

          resetSessionEnded();

          goNext();

          showToast({
            title: "Success!",
            type: "success",
            description: "You have successfully signed in",
          });
        }
      } catch (error) {
        if (axios.isAxiosError(error) && error.response) {
          if (error.response.status === 403) {
            showToast({
              title: "Error!",
              type: "error",
              description: "User doesn't exist or incorrect login or password",
            });
          } else {
            showToast({
              title: "Error",
              description: "Access denied. Please try again later.",
              type: "error",
            });
          }
        } else {
          showToast({
            title: "Error",
            description: "An unexpected error occurred",
            type: "error",
          });
        }
      }
    },
    [goNext, fetcher],
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
