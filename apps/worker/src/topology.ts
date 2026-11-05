import type { Channel } from "amqplib";

export const EVENTS_EXCHANGE = "astrum.events";
export const CONFIRMATION_ROUTING_KEY = "account.confirmation.requested";
export const CONFIRMATION_QUEUE = "mail.confirmation";
export const DEAD_LETTER_QUEUE = "mail.confirmation.dead";

/** 60, 300 and 900 seconds, the three delays the spec fixes. */
export const RETRY_DELAYS_MS = [60_000, 300_000, 900_000] as const;

export const MAX_ATTEMPTS = RETRY_DELAYS_MS.length + 1;

export const ATTEMPT_HEADER = "x-attempt";

export const retryQueueName = (attempt: number): string =>
  `mail.confirmation.wait.${attempt}`;

/**
 * The event exchange and the main queue are declared by both sides (auth
 * publishes, the worker consumes), so either can start first. A waiting queue
 * carries no consumer: its message returns to the main queue once the ttl
 * expires.
 */
export const declareTopology = async (channel: Channel): Promise<void> => {
  await channel.assertExchange(EVENTS_EXCHANGE, "direct", { durable: true });

  await channel.assertQueue(CONFIRMATION_QUEUE, { durable: true });
  await channel.bindQueue(
    CONFIRMATION_QUEUE,
    EVENTS_EXCHANGE,
    CONFIRMATION_ROUTING_KEY,
  );

  for (const [index, delay] of RETRY_DELAYS_MS.entries()) {
    const queue = retryQueueName(index + 1);

    await channel.assertQueue(queue, {
      durable: true,
      arguments: {
        "x-message-ttl": delay,
        "x-dead-letter-exchange": EVENTS_EXCHANGE,
        "x-dead-letter-routing-key": CONFIRMATION_ROUTING_KEY,
      },
    });
  }

  await channel.assertQueue(DEAD_LETTER_QUEUE, { durable: true });

  await channel.prefetch(1);
};

export const attemptOf = (headers: unknown): number => {
  if (typeof headers !== "object" || headers === null) {
    return 1;
  }

  const raw = (headers as Record<string, unknown>)[ATTEMPT_HEADER];
  const parsed = Number(raw);

  return Number.isInteger(parsed) && parsed >= 1 ? parsed : 1;
};
