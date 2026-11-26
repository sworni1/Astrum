import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { createTransport } from "nodemailer";
import { SEND_TIMEOUT_MS } from "./constants/mailer.constants";
import { withTimeout } from "./helpers/async.helpers";
import { outboxFileName } from "./helpers/mailer.helpers";
import { logger } from "./logger";
import type { Mailer } from "./types/worker.types";

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
