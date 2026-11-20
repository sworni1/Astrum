import { Injectable, Logger } from "@nestjs/common";
import { describeError } from "./describe-error";
import { CONFIRMATION_ROUTING_KEY } from "./events.constants";
import { DEFAULT_LETTER_LOCALE, type LetterLocale } from "./locale";
import { RabbitPublisher } from "./rabbit.publisher";

@Injectable()
export class EventsService {
  private readonly logger = new Logger(EventsService.name);

  constructor(private readonly publisher: RabbitPublisher) {}

  async requestAccountConfirmation({
    userId,
    email,
    locale = DEFAULT_LETTER_LOCALE,
  }: {
    userId: string;
    email: string;
    locale?: LetterLocale;
  }): Promise<void> {
    try {
      await this.publisher.publish(CONFIRMATION_ROUTING_KEY, {
        userId,
        email,
        requestedAt: new Date().toISOString(),
        locale,
      });
    } catch (error) {
      this.logger.error(
        JSON.stringify({
          event: "email.publish.failed",
          userId,
          reason: describeError(error),
        }),
      );
    }
  }
}
