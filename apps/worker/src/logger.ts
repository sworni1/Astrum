type LogFields = Record<string, unknown>;

const write = (level: string, fields: LogFields): void => {
  const line = JSON.stringify({
    level,
    time: new Date().toISOString(),
    service: "worker",
    ...fields,
  });

  if (level === "error") {
    console.error(line);
    return;
  }

  if (level === "warn") {
    console.warn(line);
    return;
  }

  console.info(line);
};

/** One structured line per event, the same shape the gateway and auth use. */
export const logger = {
  info: (fields: LogFields) => write("info", fields),
  warn: (fields: LogFields) => write("warn", fields),
  error: (fields: LogFields) => write("error", fields),
};

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
