import {
  connect,
  type ChannelModel,
  type ConfirmChannel,
  type ConsumeMessage,
} from "amqplib";
import { prisma } from "../lib/prisma";
import { loadConfig } from "./config";
import { createConfirmationHandler } from "./consumer";
import { createHealthServer } from "./health";
import { describeError, logger } from "./logger";
import { createMailer } from "./mailer";
import { CONFIRMATION_QUEUE, declareTopology } from "./topology";

const CONNECT_RETRY_MS = 2_000;
const RECONNECT_DELAY_MS = 5_000;
const DRAIN_TIMEOUT_MS = 10_000;

const sleep = async (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

const openConnection = async (
  rabbitUrl: string,
): Promise<{ connection: ChannelModel; channel: ConfirmChannel }> => {
  for (;;) {
    try {
      const connection = await connect(rabbitUrl);
      const channel = await connection.createConfirmChannel();

      await declareTopology(channel);

      return { connection, channel };
    } catch (error) {
      logger.error({
        event: "rabbit.connect.failed",
        reason: describeError(error),
        retryInMs: CONNECT_RETRY_MS,
      });
      await sleep(CONNECT_RETRY_MS);
    }
  }
};

const main = async (): Promise<void> => {
  const config = loadConfig();
  const mailer = createMailer(
    config.smtpUrl,
    config.mailFrom,
    config.mailOutboxDir,
  );

  let ready = false;
  let stopping = false;

  const health = createHealthServer({
    port: config.workerPort,
    isReady: () => ready,
    hasSmtp: mailer.kind === "smtp",
  });

  await health.start();

  let connection: ChannelModel | undefined;
  let channel: ConfirmChannel | undefined;
  let consumerTag: string | undefined;
  let inFlight: Promise<void> = Promise.resolve();

  const handleMessage = (handler: (message: ConsumeMessage | null) => Promise<void>) => (
    message: ConsumeMessage | null,
  ): void => {
    const work = handler(message).catch((error: unknown) => {
      logger.error({
        event: "email.handler.failed",
        reason: describeError(error),
      });
    });

    inFlight = inFlight.then(() => work);
  };

  const shutDown = async (signal: string): Promise<void> => {
    if (stopping) {
      return;
    }

    stopping = true;
    ready = false;

    logger.info({ event: "worker.stopping", signal });

    if (channel && consumerTag) {
      try {
        await channel.cancel(consumerTag);
      } catch (error) {
        logger.error({
          event: "worker.cancel.failed",
          reason: describeError(error),
        });
      }
    }

    await Promise.race([inFlight, sleep(DRAIN_TIMEOUT_MS)]);

    try {
      await channel?.close();
      await connection?.close();
    } catch (error) {
      logger.error({
        event: "worker.connection.close.failed",
        reason: describeError(error),
      });
    }

    await health.stop();
    await prisma.$disconnect();

    logger.info({ event: "worker.stopped" });
    process.exit(0);
  };

  process.on("SIGTERM", () => void shutDown("SIGTERM"));
  process.on("SIGINT", () => void shutDown("SIGINT"));

  while (!stopping) {
    const opened = await openConnection(config.rabbitUrl);

    connection = opened.connection;
    channel = opened.channel;

    const consumingHandler = createConfirmationHandler({
      channel,
      prisma,
      mailer,
      storefrontUrl: config.storefrontUrl,
    });

    const closed = new Promise<void>((resolve) => {
      connection?.once("close", () => resolve());
      connection?.once("error", (error: Error) => {
        logger.error({ event: "rabbit.connection.error", reason: error.message });
        resolve();
      });
    });

    const consumed = await channel.consume(
      CONFIRMATION_QUEUE,
      handleMessage(consumingHandler),
    );

    consumerTag = consumed.consumerTag;
    ready = true;

    logger.info({ event: "worker.ready", queue: CONFIRMATION_QUEUE });

    await closed;

    ready = false;
    consumerTag = undefined;

    if (stopping) {
      break;
    }

    logger.warn({ event: "rabbit.connection.closed", retryInMs: RECONNECT_DELAY_MS });
    await sleep(RECONNECT_DELAY_MS);
  }
};

main().catch((error: unknown) => {
  logger.error({ event: "worker.boot.failed", reason: describeError(error) });
  process.exit(1);
});
