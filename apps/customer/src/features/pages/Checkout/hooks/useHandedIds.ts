"use client";

import { useEffect, useState } from "react";
import { readCheckoutSelection } from "@/common/helpers/checkoutSelection";

/**
 * The ids the cart handed over, read once on the client so no server render sees
 * the storage, and `null` until that read happened (spec 0024, AC-2, AC-4).
 */
export const useHandedIds = (): string[] | null => {
  const [handed, setHanded] = useState<string[] | null>(null);

  useEffect(() => {
    setHanded(readCheckoutSelection());
  }, []);

  return handed;
};
