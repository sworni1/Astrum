"use client";

import axios from "axios";
import { refusalCode } from "@/common/helpers/apiRefusal";

export type StaffPageState =
  | "loading"
  | "noRole"
  | "sessionGone"
  | "failure"
  | "ready";

const statusOf = (error: unknown): number | undefined =>
  axios.isAxiosError(error) ? error.response?.status : undefined;

/**
 * What a staff page paints. A role the account does not hold is a screen of its
 * own, an outage is a failure with a retry, and a `401` paints nothing because
 * the fetcher has already ended the session (spec 0017, AC-13).
 */
export const resolveStaffPageState = (
  error: unknown,
  isLoading: boolean,
  notHeldCode: string,
): StaffPageState => {
  if (isLoading) {
    return "loading";
  }

  if (!error) {
    return "ready";
  }

  if (statusOf(error) === 401) {
    return "sessionGone";
  }

  return refusalCode(error) === notHeldCode ? "noRole" : "failure";
};
