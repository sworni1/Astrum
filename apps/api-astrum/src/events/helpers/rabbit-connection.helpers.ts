import { type ChannelModel, type ConfirmChannel, connect } from "amqplib";

import { describeError } from "../../common/helpers/describeError";
import { logger } from "../../common/helpers/logger";
import {
  EVENTS_EXCHANGE,
  EVENTS_EXCHANGE_OPTIONS,
  EVENTS_EXCHANGE_TYPE,
} from "../constants/events.constants";

let connection: ChannelModel | undefined;
let channel: ConfirmChannel | undefined;
let opening: Promise<ConfirmChannel> | undefined;

const open = async (): Promise<ConfirmChannel> => {
  const url = process.env.RABBITMQ_URL;

  if (!url) {
    throw new Error("RABBITMQ_URL is required to publish events");
  }

  const opened = await connect(url);
  const confirmed = await opened.createConfirmChannel();

  opened.on("error", (error: Error) => {
    logger.error({
      event: "rabbit.connection.error",
      reason: describeError(error),
    });
  });

  opened.on("close", () => {
    connection = undefined;
    channel = undefined;
  });

  await confirmed.assertExchange(
    EVENTS_EXCHANGE,
    EVENTS_EXCHANGE_TYPE,
    EVENTS_EXCHANGE_OPTIONS,
  );

  connection = opened;
  channel = confirmed;

  return confirmed;
};

export const channelOrOpen = async (): Promise<ConfirmChannel> => {
  if (channel) {
    return channel;
  }

  opening ??= open().finally(() => {
    opening = undefined;
  });

  return await opening;
};

export const resetConnection = async (): Promise<void> => {
  const confirmed = channel;
  const opened = connection;

  channel = undefined;
  connection = undefined;

  try {
    await confirmed?.close();
  } catch (error) {
    logger.warn({
      event: "rabbit.channel.close.failed",
      reason: describeError(error),
    });
  }

  try {
    await opened?.close();
  } catch (error) {
    logger.warn({
      event: "rabbit.connection.close.failed",
      reason: describeError(error),
    });
  }
};
