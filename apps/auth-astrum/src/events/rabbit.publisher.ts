import { Injectable, Logger, type OnModuleDestroy } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { connect, type ChannelModel, type ConfirmChannel } from "amqplib";
import { describeError } from "./describe-error";
import { EVENTS_EXCHANGE, PUBLISH_TIMEOUT_MS } from "./events.constants";

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
          () =>
            reject(
              new Error(`the broker did not answer within ${timeoutMs} ms`),
            ),
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

/**
 * Publishes with a confirm channel, so a message is on the broker before the
 * call resolves. The connection is opened on first use and the whole publish is
 * bounded: a refused, hung or unreachable broker is a failure the caller can
 * log, never a request that waits on a socket.
 */
@Injectable()
export class RabbitPublisher implements OnModuleDestroy {
  private readonly logger = new Logger(RabbitPublisher.name);
  private connection?: ChannelModel;
  private channel?: ConfirmChannel;
  private opening?: Promise<ConfirmChannel>;

  constructor(private readonly config: ConfigService) {}

  async publish(routingKey: string, payload: unknown): Promise<void> {
    try {
      await withTimeout(this.send(routingKey, payload), PUBLISH_TIMEOUT_MS);
    } catch (error) {
      await this.reset();
      throw error;
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.reset();
  }

  private async send(routingKey: string, payload: unknown): Promise<void> {
    const channel = await this.channelOrOpen();
    const body = Buffer.from(JSON.stringify(payload));

    channel.publish(EVENTS_EXCHANGE, routingKey, body, {
      persistent: true,
      contentType: "application/json",
    });

    await channel.waitForConfirms();
  }

  private async channelOrOpen(): Promise<ConfirmChannel> {
    if (this.channel) {
      return this.channel;
    }

    this.opening ??= this.open().finally(() => {
      this.opening = undefined;
    });

    return await this.opening;
  }

  private async open(): Promise<ConfirmChannel> {
    const url = this.config.get<string>("RABBITMQ_URL");

    if (!url) {
      throw new Error("RABBITMQ_URL is required to publish events");
    }

    const connection = await connect(url);
    const channel = await connection.createConfirmChannel();

    connection.on("error", (error: Error) => {
      this.logger.error(
        JSON.stringify({
          event: "rabbit.connection.error",
          reason: error.message,
        }),
      );
    });

    connection.on("close", () => {
      this.connection = undefined;
      this.channel = undefined;
    });

    await channel.assertExchange(EVENTS_EXCHANGE, "direct", { durable: true });

    this.connection = connection;
    this.channel = channel;

    return channel;
  }

  private async reset(): Promise<void> {
    const connection = this.connection;
    const channel = this.channel;

    this.connection = undefined;
    this.channel = undefined;

    try {
      await channel?.close();
    } catch (error) {
      this.logger.warn(
        JSON.stringify({
          event: "rabbit.channel.close.failed",
          reason: describeError(error),
        }),
      );
    }

    try {
      await connection?.close();
    } catch (error) {
      this.logger.warn(
        JSON.stringify({
          event: "rabbit.connection.close.failed",
          reason: describeError(error),
        }),
      );
    }
  }
}
