"use client";

import axios from "axios";
import { useRouter } from "next/navigation";
import { useCallback, useMemo } from "react";
import type { SubmitHandler } from "react-hook-form";
import {
  type SignInCredentials,
  type SignUpCredentials,
  showToast,
} from "../../common";
import { createSession } from "../../common/helpers/session";
import { useFetcher } from "../useFetcher";

export const useAuth = () => {
  const { fetcher } = useFetcher();

  const router = useRouter();

  const goNext = useCallback(() => router.push("/"), [router]);

  const handleRegister: SubmitHandler<SignUpCredentials> = useCallback(
    async (signUpData: SignUpCredentials) => {
      try {
        signUpData.dateOfBirth.toISOString();

        const res = await fetcher.post("/auth/register", signUpData);

        if (res.status === 200) {
          await createSession(res.data.token);

          goNext();

          showToast({
            title: "Success!",
            type: "success",
            description: "You have successfully registered",
          });
        }
      } catch (error) {
        if (axios.isAxiosError(error) && error.response) {
          if (error.response.status === 403) {
            showToast({
              title: "Error",
              description: "Conflict: The user with this email already exists",
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
    [goNext, fetcher],
  );

  const handleSignIn: SubmitHandler<SignInCredentials> = useCallback(
    async (signInData: SignInCredentials) => {
      try {
        const res = await fetcher.post("/auth/signin", signInData);

        console.log(res.data);

        if (res.status === 200) {
          await createSession(res.data.token);

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
    }),
    [handleRegister, handleSignIn],
  );
};
