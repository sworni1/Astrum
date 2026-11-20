import { showToast } from "./showToast";

const announced = new WeakSet<object>();

export const showLoadFailureOnce = (error: unknown, title: string): void => {
  if (typeof error !== "object" || error === null || announced.has(error)) {
    return;
  }

  announced.add(error);
  showToast({ title, type: "error" });
};
