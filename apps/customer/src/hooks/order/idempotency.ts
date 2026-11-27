import axios from "axios";

export const createIdempotencyKey = (): string => {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);

  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join(
    "",
  );
};

export const isTerminalAnswer = (error: unknown): boolean => {
  if (!axios.isAxiosError(error)) {
    return false;
  }

  const status = error.response?.status;

  return status !== undefined && status >= 400 && status < 500;
};
