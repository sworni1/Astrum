"use client";

import axios from "axios";
import { refusalCode } from "@/common/helpers/apiRefusal";

export const STAFF_PAGE_SIZE = 20;

export const NO_BODY = {} as Record<string, never>;

export type StaffPageState =
  | "loading"
  | "noRole"
  | "sessionGone"
  | "failure"
  | "ready";

const statusOf = (error: unknown): number | undefined =>
  axios.isAxiosError(error) ? error.response?.status : undefined;

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
