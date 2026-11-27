import { CATALOG } from "./constants/letter.constants";
import { escapeHtml } from "./helpers/letter.helpers";
import type { Letter, LetterLocale } from "./types/worker.types";

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
