"use client";

import type { ProductCartProps } from "@/common/types/product.types";
import CartCard from "./CartCard";

type Props = {
  items: ProductCartProps[];
  selectedIds: Set<string>;
  onSelectionChange: (itemId: string, checked: boolean) => void;
};

const CartItemsList = ({ items, selectedIds, onSelectionChange }: Props) => (
  <div className="space-y-4">
    {items.map((item) => (
      <CartCard
        key={item.id}
        {...item}
        isSelected={selectedIds.has(item.id)}
        onSelectionChange={(checked) => onSelectionChange(item.id, checked)}
      />
    ))}
  </div>
);

export default CartItemsList;
