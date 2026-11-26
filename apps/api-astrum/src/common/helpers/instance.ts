import { UNKNOWN_INSTANCE } from "../constants/app.constants";

export const instanceName = (): string =>
  process.env.HOSTNAME ?? UNKNOWN_INSTANCE;
