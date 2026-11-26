export const API_PORT_DEFAULT = 3580;

export const SHUTDOWN_TIMEOUT_MS = 10_000;

export const SHUTDOWN_SIGNALS: readonly NodeJS.Signals[] = [
  "SIGTERM",
  "SIGINT",
];
