import type { useTranslations } from "next-intl";

export type ValidationTranslator = ReturnType<
  typeof useTranslations<"validation">
>;
