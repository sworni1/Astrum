import { showToast } from "./showToast";

/**
 * The failures already announced. SWR hands a new error object per failed
 * request, so the object is the identity of the failure (spec 0025, AC-13).
 */
const announced = new WeakSet<object>();

/**
 * One toast per failed read, however many components watch the same key and
 * however often they render. Call it from an effect, never from a render body
 * (storefront rule S4).
 */
export const showLoadFailureOnce = (error: unknown, title: string): void => {
  if (typeof error !== "object" || error === null || announced.has(error)) {
    return;
  }

  announced.add(error);
  showToast({ title, type: "error" });
};
