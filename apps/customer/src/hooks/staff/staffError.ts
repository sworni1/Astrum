import { refusalCode } from "@/common/helpers/apiRefusal";

/** Every refusal the staff screens render comes from the response code alone. */
export const staffErrorCode = refusalCode;

export const isNotPointWorker = (error: unknown): boolean =>
  staffErrorCode(error) === "NOT_POINT_WORKER";

export const isNotCourier = (error: unknown): boolean =>
  staffErrorCode(error) === "NOT_COURIER";
