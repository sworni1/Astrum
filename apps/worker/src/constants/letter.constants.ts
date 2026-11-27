import { enCopy } from "../letters/en";
import { ruCopy } from "../letters/ru";
import type { LetterCopy, LetterLocale } from "../types/worker.types";

export const CATALOG: Record<LetterLocale, LetterCopy> = {
  en: enCopy,
  ru: ruCopy,
};
