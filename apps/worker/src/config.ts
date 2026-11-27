export type WorkerConfig = {
  databaseUrl: string;
  rabbitUrl: string;
  mailFrom: string;
  storefrontUrl: string;
  smtpUrl?: string;
  workerPort: number;
  mailOutboxDir: string;
};

const DEFAULT_WORKER_PORT = 5580;
const DEFAULT_OUTBOX_DIR = "./tmp/mail";

const readRequired = (
  env: NodeJS.ProcessEnv,
  name: string,
  hint: string,
): string => {
  const value = env[name]?.trim();

  if (!value) {
    throw new Error(`${name} is required: ${hint}`);
  }

  return value;
};

const withoutTrailingSlash = (value: string): string =>
  value.replace(/\/+$/, "");

export const loadConfig = (
  env: NodeJS.ProcessEnv = process.env,
): WorkerConfig => {
  const port = Number(env.WORKER_PORT ?? DEFAULT_WORKER_PORT);

  if (!Number.isInteger(port) || port <= 0) {
    throw new Error("WORKER_PORT must be a positive integer");
  }

  return {
    databaseUrl: readRequired(
      env,
      "DATABASE_URL",
      "the worker mints tokens in Postgres",
    ),
    rabbitUrl: readRequired(
      env,
      "RABBITMQ_URL",
      "the worker consumes account events from the broker",
    ),
    mailFrom: readRequired(
      env,
      "MAIL_FROM",
      "every letter needs a sender address",
    ),
    storefrontUrl: withoutTrailingSlash(
      readRequired(
        env,
        "STOREFRONT_URL",
        "the confirmation link points at the storefront origin",
      ),
    ),
    smtpUrl: env.SMTP_URL?.trim() || undefined,
    workerPort: port,
    mailOutboxDir: env.MAIL_OUTBOX_DIR?.trim() || DEFAULT_OUTBOX_DIR,
  };
};
