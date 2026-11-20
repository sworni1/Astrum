import {
  refusalAnswered,
  refusalBody,
  refusalCode,
} from "@/common/helpers/apiRefusal";
import { type ItemStatusKey, itemStatusKey } from "@/common/helpers/itemStatus";

export type CancelRefusal =
  | { key: "cancelBlockedByLine"; statusKey: ItemStatusKey }
  | { key: "cancelFailed" }
  | { key: "cancelUnconfirmed" };

export const cancelRefusal = (error: unknown): CancelRefusal => {
  if (!refusalAnswered(error)) {
    return { key: "cancelUnconfirmed" };
  }

  const { from } = refusalBody(error);

  if (refusalCode(error) !== "INVALID_STATUS_TRANSITION") {
    return { key: "cancelFailed" };
  }

  const statusKey = typeof from === "string" ? itemStatusKey(from) : undefined;

  return statusKey
    ? { key: "cancelBlockedByLine", statusKey }
    : { key: "cancelFailed" };
};
