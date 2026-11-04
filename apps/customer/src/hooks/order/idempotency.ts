import axios from "axios";

/**
 * 16 random bytes as 32 hex characters. `crypto.randomUUID` is undefined
 * outside a secure context, and the demo stack can be plain HTTP.
 */
export const createIdempotencyKey = (): string => {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);

  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join(
    "",
  );
};

/**
 * A 4xx is the server's final word, so the key is spent. A network error, a
 * timeout or a 5xx keeps it, because the server may still have created the
 * order and the retry has to answer with that same order.
 */
export const isTerminalAnswer = (error: unknown): boolean => {
  if (!axios.isAxiosError(error)) {
    return false;
  }

  const status = error.response?.status;

  return status !== undefined && status >= 400 && status < 500;
};
