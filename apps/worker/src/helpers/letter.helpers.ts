import type { LetterLocale } from "../types/worker.types";

export const resolveLetterLocale = (value: unknown): LetterLocale =>
  value === "ru" ? "ru" : "en";

export const escapeHtml = (value: string): string =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
