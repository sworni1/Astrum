import { Injectable, Logger, type OnModuleDestroy } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { type ChannelModel, type ConfirmChannel, connect } from "amqplib";
import {
  DURABLE_EXCHANGE_OPTIONS,
  EVENTS_EXCHANGE,
  EXCHANGE_TYPE_DIRECT,
  PERSISTENT_JSON_PUBLISH_OPTIONS,
  PUBLISH_TIMEOUT_MS,
  RABBITMQ_URL_VARIABLE,
} from "./constants/events.constants";
import { describeError } from "./describe-error";
import { withTimeout } from "./helpers/rabbit.helpers";

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

    channel.publish(
      EVENTS_EXCHANGE,
      routingKey,
      body,
      PERSISTENT_JSON_PUBLISH_OPTIONS,
    );

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
    const url = this.config.get<string>(RABBITMQ_URL_VARIABLE);

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

    await channel.assertExchange(
      EVENTS_EXCHANGE,
      EXCHANGE_TYPE_DIRECT,
      DURABLE_EXCHANGE_OPTIONS,
    );

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
