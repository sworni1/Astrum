import { type ChannelModel, type ConfirmChannel, connect } from "amqplib";
import { CONNECT_RETRY_MS } from "../constants/worker.constants";
import { logger } from "../logger";
import { declareTopology } from "../topology";
import { sleep } from "./async.helpers";
import { describeError } from "./error.helpers";

export const openConnection = async (
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
