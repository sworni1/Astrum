import {
  CHECKOUT_SELECTION_KEY,
  type CheckoutSelection,
} from "@/common/constants/checkout";

/**
 * The handoff between `/cart` and `/checkout` (spec 0024, AC-2). Every function
 * is silent: a storage that refuses (private mode, a quota error) reads as an
 * empty selection and leaves the click alive, and no call touches the storage
 * during a server render.
 */
const storage = (): Storage | null => {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
};

export const readCheckoutSelection = (): CheckoutSelection => {
  const store = storage();

  if (!store) {
    return [];
  }

  try {
    const raw = store.getItem(CHECKOUT_SELECTION_KEY);

    if (!raw) {
      return [];
    }

    const parsed: unknown = JSON.parse(raw);

    return Array.isArray(parsed)
      ? parsed.filter((id): id is string => typeof id === "string")
      : [];
  } catch {
    return [];
  }
};

export const writeCheckoutSelection = (ids: CheckoutSelection): void => {
  const store = storage();

  if (!store) {
    return;
  }

  try {
    store.setItem(CHECKOUT_SELECTION_KEY, JSON.stringify(ids));
  } catch {
    return;
  }
};

export const clearCheckoutSelection = (): void => {
  const store = storage();

  if (!store) {
    return;
  }

  try {
    store.removeItem(CHECKOUT_SELECTION_KEY);
  } catch {
    return;
  }
};
