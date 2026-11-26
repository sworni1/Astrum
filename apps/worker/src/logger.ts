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

export const logger = {
  info: (fields: LogFields) => write("info", fields),
  warn: (fields: LogFields) => write("warn", fields),
  error: (fields: LogFields) => write("error", fields),
};
