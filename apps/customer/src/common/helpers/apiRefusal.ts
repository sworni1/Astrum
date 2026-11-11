import axios from "axios";

export type RefusalBody = { code?: unknown; from?: unknown; to?: unknown };

/**
 * The gateway answers an expected refusal with `{ code, message, ...details }`,
 * so a machine readable code and its transition details sit at the top level of
 * the body (gateway `handleErrors`).
 */
export const refusalBody = (error: unknown): RefusalBody => {
  if (!axios.isAxiosError(error)) {
    return {};
  }

  const data: unknown = error.response?.data;

  if (typeof data !== "object" || data === null) {
    return {};
  }

  return data as RefusalBody;
};

export const refusalCode = (error: unknown): string | undefined => {
  const { code } = refusalBody(error);

  return typeof code === "string" ? code : undefined;
};
