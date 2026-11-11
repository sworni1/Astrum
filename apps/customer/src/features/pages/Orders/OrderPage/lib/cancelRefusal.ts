import { refusalBody } from "@/common/helpers/apiRefusal";
import { itemStatusKey, type ItemStatusKey } from "@/common/helpers/itemStatus";

export type CancelRefusal =
  | { key: "cancelBlockedByLine"; statusKey: ItemStatusKey }
  | { key: "cancelFailed" };

/**
 * The gateway refuses a cancel while any line is shipped or otherwise finished
 * (spec 0002, AC-10) and names that line status in `from`, so the screen can
 * say why instead of showing a generic failure.
 */
export const cancelRefusal = (error: unknown): CancelRefusal => {
  const { code, from } = refusalBody(error);

  if (code !== "INVALID_STATUS_TRANSITION") {
    return { key: "cancelFailed" };
  }

  const statusKey = typeof from === "string" ? itemStatusKey(from) : undefined;

  return statusKey
    ? { key: "cancelBlockedByLine", statusKey }
    : { key: "cancelFailed" };
};
