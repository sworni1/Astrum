/**
 * amqplib reports a refused connection as an AggregateError whose own message is
 * empty; the readable part lives in `errors[]`. Without this unwrapping a failed
 * publish logs `reason: ""`. The check is structural because this package
 * compiles against es2016, where the `AggregateError` global is not declared.
 */
export const describeError = (error: unknown): string => {
  if (error instanceof Error) {
    const nested = (error as { errors?: unknown }).errors;

    if (Array.isArray(nested) && nested.length > 0) {
      const details = nested
        .map((inner: unknown) => describeError(inner))
        .filter((detail) => detail.length > 0);

      if (details.length > 0) {
        return details.join(" | ");
      }
    }
  }

  if (error instanceof Error) {
    return error.message || error.name;
  }

  return String(error);
};
