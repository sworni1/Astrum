"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import {
  isLocale,
  LOCALE_COOKIE,
  LOCALE_COOKIE_MAX_AGE_SECONDS,
} from "../../i18n/config";

/**
 * The language is a preference, not a secret, so the cookie stays readable by
 * the request helpers that follow it. Any value outside the two known ones is
 * ignored rather than guessed at.
 */
export async function setLocale(locale: string): Promise<void> {
  if (!isLocale(locale)) {
    return;
  }

  const cookieStore = await cookies();

  cookieStore.set(LOCALE_COOKIE, locale, {
    path: "/",
    sameSite: "lax",
    maxAge: LOCALE_COOKIE_MAX_AGE_SECONDS,
  });

  revalidatePath("/", "layout");
}
