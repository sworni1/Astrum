"use client";

import { useEffect, useState } from "react";
import { readCheckoutSelection } from "@/common/helpers/checkoutSelection";

export const useHandedIds = (): string[] | null => {
  const [handed, setHanded] = useState<string[] | null>(null);

  useEffect(() => {
    setHanded(readCheckoutSelection());
  }, []);

  return handed;
};
