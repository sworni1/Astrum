import en from "@messages/en.json";
import ru from "@messages/ru.json";
import { cookies } from "next/headers";
import { getRequestConfig } from "next-intl/server";
import { LOCALE_COOKIE, type Locale, resolveLocale } from "./config";

const CATALOGS: Record<Locale, typeof en> = { en, ru };

export default getRequestConfig(async () => {
  const locale = resolveLocale((await cookies()).get(LOCALE_COOKIE)?.value);

  return {
    locale,
    messages: CATALOGS[locale],
    timeZone: "UTC",
  };
});
