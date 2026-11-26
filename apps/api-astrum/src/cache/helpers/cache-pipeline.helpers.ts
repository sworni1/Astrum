export const failedCommand = (results: unknown): Error | null => {
  if (!Array.isArray(results)) {
    return new Error("cache pipeline answered nothing");
  }

  for (const entry of results) {
    if (!Array.isArray(entry)) {
      continue;
    }

    const [error] = entry as [unknown, unknown];

    if (error !== null && error !== undefined) {
      return error instanceof Error ? error : new Error(String(error));
    }
  }

  return null;
};
