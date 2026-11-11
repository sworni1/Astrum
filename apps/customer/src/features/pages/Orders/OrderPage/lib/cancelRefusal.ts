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

/**
 * The gateway refuses a cancel while any line is shipped or otherwise finished
 * (spec 0002, AC-10) and names that line status in `from`, so the screen can
 * say why instead of showing a generic failure.
 *
 * A request that got no answer at all is not a refusal: the gateway may have
 * committed the cancellation before the answer was lost, so the screen says the
 * result is unknown instead of calling it a failure (spec 0011, AC-6).
 */
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
