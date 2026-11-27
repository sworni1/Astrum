import { useEffect, useMemo, useRef, useState } from "react";
import {
  readCheckoutSelection,
  writeCheckoutSelection,
} from "@/common/helpers/checkoutSelection";
import type { ProductCartProps } from "@/common/types/product.types";

type CartSelection = {
  selectedIds: Set<string>;
  subtotal: number;
  allSelected: boolean;
  someSelected: boolean;
  toggleItem: (itemId: string, checked: boolean) => void;
  toggleAll: (checked: boolean) => void;
};

export const useCartSelection = (items: ProductCartProps[]): CartSelection => {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const restored = useRef(false);

  useEffect(() => {
    if (restored.current || items.length === 0) {
      return;
    }

    restored.current = true;
    const live = new Set(items.map((item) => item.id));
    const stored = readCheckoutSelection().filter((id) => live.has(id));

    if (stored.length > 0) {
      setSelectedIds(new Set(stored));
    }
  }, [items]);

  useEffect(() => {
    if (!restored.current) {
      return;
    }

    writeCheckoutSelection([...selectedIds]);
  }, [selectedIds]);

  const selectedItems = useMemo(
    () => items.filter((item) => selectedIds.has(item.id)),
    [items, selectedIds],
  );

  const subtotal = selectedItems.reduce(
    (total, item) => total + item.price * item.quantityInCart,
    0,
  );

  const toggleItem = (itemId: string, checked: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);

      if (checked) {
        next.add(itemId);
      } else {
        next.delete(itemId);
      }

      return next;
    });
  };

  const toggleAll = (checked: boolean) => {
    setSelectedIds(checked ? new Set(items.map((item) => item.id)) : new Set());
  };

  return {
    selectedIds,
    subtotal,
    allSelected: items.length > 0 && selectedIds.size === items.length,
    someSelected: selectedIds.size > 0,
    toggleItem,
    toggleAll,
  };
};
