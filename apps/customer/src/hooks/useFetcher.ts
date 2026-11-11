"use client";

import en from "@messages/en.json";
import axios, { type AxiosInstance } from "axios";
import { createTranslator, useTranslations } from "next-intl";
import { useCallback, useEffect, useMemo, useState } from "react";
import { requestConfirmationForCurrentUser } from "@/common/helpers/confirmEmail";
import { deleteSession } from "@/common/helpers/session";
import { showToast } from "@/common/helpers/showToast";
import { acceptLanguage } from "@/i18n/config";

const authServiceUrl = process.env.NEXT_PUBLIC_API_GATEWAY_URL;

const SIGN_IN_PATH = "/auth/signin";

type ErrorsTranslator = ReturnType<typeof useTranslations<"errors">>;

/** Messages for a toast raised before any screen has mounted. */
const fallbackTranslator = createTranslator({
  locale: "en",
  messages: en,
  namespace: "errors",
}) as ErrorsTranslator;

let activeTranslator: ErrorsTranslator | undefined;

const translateErrors = (): ErrorsTranslator =>
  activeTranslator ?? fallbackTranslator;

/** The session is really gone: the cookie cannot be used any more. */
const SESSION_GONE_CODES = [
  "SESSION_REVOKED",
  "TOKEN_INVALID",
  "SESSION_MISSING",
];

/**
 * One session ends once, however many requests notice it: the flag stops a
 * burst of refused calls (including the SWR retries) from stacking toasts and
 * navigations. A successful sign in resets it.
 */
let sessionEnded = false;
let storeWarningShown = false;
let confirmationWarningShown = false;

export const resetSessionEnded = (): void => {
  sessionEnded = false;
};

const refusalCode = (error: unknown): string | undefined => {
  if (!axios.isAxiosError(error) || error.response?.status !== 401) {
    return undefined;
  }

  const data: unknown = error.response.data;

  if (typeof data !== "object" || data === null) {
    return undefined;
  }

  const { code } = data as { code?: unknown };

  return typeof code === "string" ? code : undefined;
};

const endSessionHere = async (t: ErrorsTranslator): Promise<void> => {
  if (sessionEnded) {
    return;
  }

  sessionEnded = true;

  await deleteSession();

  showToast({
    title: t("sessionEndedTitle"),
    description: t("sessionEndedText"),
    type: "error",
  });

  // A full reload is the point: it drops every cached answer of the ended session.
  window.location.href = SIGN_IN_PATH;
};

const handleRefusal = async (
  error: unknown,
  t: ErrorsTranslator,
): Promise<void> => {
  const code = refusalCode(error);

  if (!code) {
    return;
  }

  if (code === "SESSION_STORE_UNAVAILABLE") {
    if (!storeWarningShown) {
      storeWarningShown = true;
      showToast({
        title: t("sessionStoreTitle"),
        description: t("sessionStoreText"),
        type: "warning",
      });
    }

    return;
  }

  if (code === "EMAIL_NOT_CONFIRMED") {
    if (!confirmationWarningShown) {
      confirmationWarningShown = true;
      showToast({
        title: t("emailNotConfirmedTitle"),
        description: t("emailNotConfirmedText"),
        type: "warning",
        action: {
          label: t("resendAction"),
          onClick: () => {
            void requestConfirmationForCurrentUser();
          },
        },
      });
    }

    return;
  }

  if (SESSION_GONE_CODES.includes(code)) {
    await endSessionHere(t);
  }
};

const createAxiosInstance = (
  translator: () => ErrorsTranslator,
): AxiosInstance => {
  const instance = axios.create({
    withCredentials: true,
    baseURL: authServiceUrl,
    timeout: 10000,
    headers: {
      "Content-Type": "application/json",
    },
  });

  instance.interceptors.request.use((config) => {
    config.headers.set("Accept-Language", acceptLanguage()["Accept-Language"]);
    return config;
  });

  instance.interceptors.response.use(
    (response) => {
      storeWarningShown = false;
      confirmationWarningShown = false;
      return response;
    },
    async (error: unknown) => {
      await handleRefusal(error, translator());
      return await Promise.reject(error);
    },
  );

  return instance;
};

export const useFetcher = () => {
  const t = useTranslations("errors");

  useEffect(() => {
    activeTranslator = t;
  }, [t]);

  const [fetcher] = useState<AxiosInstance>(() =>
    createAxiosInstance(translateErrors),
  );
  const getData = useCallback(
    async (url: string) => {
      try {
        const response = await fetcher.get(url);
        return response.data;
      } catch (error) {
        console.error("GET request failed:", url, error);
        throw error;
      }
    },
    [fetcher],
  );

  const deleteItem = useCallback(
    async (url: string) => {
      try {
        const response = await fetcher.delete(url);
        return response.data;
      } catch (error) {
        console.error("DELETE request failed:", url, error);
        throw error;
      }
    },
    [fetcher],
  );

  const patchItem = useCallback(
    async <TData>(url: string, { arg }: { arg: TData }) => {
      try {
        const response = await fetcher.patch(url, arg);
        return response.data;
      } catch (error) {
        console.error("PATCH request failed:", url, error);
        throw error;
      }
    },
    [fetcher],
  );

  const postItem = useCallback(
    async <TData>(
      url: string,
      { arg, headers }: { arg: TData; headers?: Record<string, string> },
    ) => {
      try {
        const response = await fetcher.post(url, arg, { headers });
        return response.data;
      } catch (error) {
        console.error("POST request failed:", url, error);
        throw error;
      }
    },
    [fetcher],
  );

  const putItem = useCallback(
    async <TData>(url: string, { arg }: { arg: TData }) => {
      try {
        const response = await fetcher.put(url, arg);
        return response.data;
      } catch (error) {
        console.error("PUT request failed:", url, error);
        throw error;
      }
    },
    [fetcher],
  );

  return useMemo(
    () => ({
      fetcher,
      getData,
      deleteItem,
      patchItem,
      postItem,
      putItem,
    }),
    [getData, deleteItem, patchItem, postItem, putItem, fetcher],
  );
};
