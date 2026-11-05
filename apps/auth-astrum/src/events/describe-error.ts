/**
 * One readable sentence out of whatever a broker client throws. amqplib
 * rejects a refused connection with an AggregateError whose own message is
 * empty, so the useful text lives one level down in `errors`.
 */
export const describeError = (error: unknown): string => {
  if (error instanceof Error) {
    const nested = (error as { errors?: unknown }).errors;

    if (Array.isArray(nested) && nested.length > 0) {
      const details = nested
        .map((inner) => describeError(inner))
        .filter((detail) => detail.length > 0);

      if (details.length > 0) {
        return details.join(" | ");
      }
    }

    return error.message || error.name;
  }

  return String(error);
};
