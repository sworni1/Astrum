export type Letter = {
  subject: string;
  text: string;
  html: string;
};

export const CONFIRMATION_SUBJECT = "Подтвердите адрес почты в Astrum";

const escapeHtml = (value: string): string =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

/** One link, a plain part and a minimal HTML part, nothing else. */
export const buildConfirmationLetter = (link: string): Letter => {
  const safeLink = escapeHtml(link);

  const text = [
    "Здравствуйте!",
    "",
    "Подтвердите адрес почты, чтобы оформлять заказы и оставлять отзывы в Astrum.",
    "",
    link,
    "",
    "Ссылка действует 24 часа. Если вы не регистрировались в Astrum, просто проигнорируйте это письмо.",
  ].join("\n");

  const html = [
    '<div style="font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.5;color:#111111">',
    "<p>Здравствуйте!</p>",
    "<p>Подтвердите адрес почты, чтобы оформлять заказы и оставлять отзывы в Astrum.</p>",
    `<p><a href="${safeLink}" style="color:#2563eb">Подтвердить адрес</a></p>`,
    `<p style="font-size:13px;color:#555555">${safeLink}</p>`,
    '<p style="font-size:13px;color:#555555">Ссылка действует 24 часа. Если вы не регистрировались в Astrum, просто проигнорируйте это письмо.</p>',
    "</div>",
  ].join("");

  return { subject: CONFIRMATION_SUBJECT, text, html };
};
