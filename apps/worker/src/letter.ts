import { enCopy } from "./letters/en";
import { ruCopy } from "./letters/ru";

export type Letter = {
  subject: string;
  text: string;
  html: string;
};

export type LetterLocale = "en" | "ru";

export type LetterCopy = {
  subject: string;
  greeting: string;
  intro: string;
  action: string;
  hint: string;
};

const CATALOG: Record<LetterLocale, LetterCopy> = {
  en: enCopy,
  ru: ruCopy,
};

/** An unknown or missing language is English, never a failed delivery. */
export const resolveLetterLocale = (value: unknown): LetterLocale =>
  value === "ru" ? "ru" : "en";

const escapeHtml = (value: string): string =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

/** One link, a plain part and a minimal HTML part, nothing else. */
export const buildConfirmationLetter = (
  link: string,
  locale: LetterLocale = "en",
): Letter => {
  const copy = CATALOG[locale];
  const safeLink = escapeHtml(link);

  const text = [copy.greeting, "", copy.intro, "", link, "", copy.hint].join(
    "\n",
  );

  const html = [
    '<div style="font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.5;color:#111111">',
    `<p>${escapeHtml(copy.greeting)}</p>`,
    `<p>${escapeHtml(copy.intro)}</p>`,
    `<p><a href="${safeLink}" style="color:#2563eb">${escapeHtml(copy.action)}</a></p>`,
    `<p style="font-size:13px;color:#555555">${safeLink}</p>`,
    `<p style="font-size:13px;color:#555555">${escapeHtml(copy.hint)}</p>`,
    "</div>",
  ].join("");

  return { subject: copy.subject, text, html };
};
