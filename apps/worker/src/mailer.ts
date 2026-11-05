import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { createTransport } from "nodemailer";
import { logger } from "./logger";
import type { Letter } from "./letter";

export const SEND_TIMEOUT_MS = 10_000;

export type Mailer = {
  kind: "smtp" | "outbox";
  send(to: string, letter: Letter): Promise<void>;
};

const withTimeout = async <T>(
  work: Promise<T>,
  timeoutMs: number,
): Promise<T> => {
  let timer: NodeJS.Timeout | undefined;

  try {
    return await Promise.race([
      work,
      new Promise<never>((_resolve, reject) => {
        timer = setTimeout(
          () => reject(new Error(`send did not resolve within ${timeoutMs} ms`)),
          timeoutMs,
        );
      }),
    ]);
  } finally {
    if (timer) {
      clearTimeout(timer);
    }
  }
};

const outboxFileName = (to: string, now: Date): string => {
  const stamp = now.toISOString().replace(/[:.]/g, "-");
  const safeTo = to.replace(/[^a-zA-Z0-9@._-]/g, "_");

  return `${stamp}-${safeTo}.eml`;
};

/**
 * Without SMTP_URL the letter goes to the log and to a file, so a developer
 * reads the confirmation link without running a mail server.
 */
const createOutboxMailer = (mailFrom: string, outboxDir: string): Mailer => ({
  kind: "outbox",
  send: async (to, letter) => {
    await mkdir(outboxDir, { recursive: true });

    const file = join(outboxDir, outboxFileName(to, new Date()));

    await writeFile(
      file,
      [
        `From: ${mailFrom}`,
        `To: ${to}`,
        `Subject: ${letter.subject}`,
        "",
        letter.text,
      ].join("\n"),
      "utf8",
    );

    logger.info({ event: "email.outbox.written", to, file });
  },
});

const createSmtpMailer = (smtpUrl: string, mailFrom: string): Mailer => {
  const transport = createTransport(smtpUrl);

  return {
    kind: "smtp",
    send: async (to, letter) => {
      await withTimeout(
        transport.sendMail({
          from: mailFrom,
          to,
          subject: letter.subject,
          text: letter.text,
          html: letter.html,
        }),
        SEND_TIMEOUT_MS,
      );
    },
  };
};

export const createMailer = (
  smtpUrl: string | undefined,
  mailFrom: string,
  outboxDir: string,
): Mailer =>
  smtpUrl
    ? createSmtpMailer(smtpUrl, mailFrom)
    : createOutboxMailer(mailFrom, outboxDir);
