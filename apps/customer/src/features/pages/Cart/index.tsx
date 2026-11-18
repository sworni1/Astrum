"use client";

import { useMemo } from "react";
import { Currency } from "@/common/types/product.types";
import { useGetCart } from "@/hooks/product/useCart/useGetCart";
import CartEmpty from "./components/CartEmpty";
import CartHeader from "./components/CartHeader";
import CartItemsList from "./components/CartItemsList";
import CartLoading from "./components/CartLoading";
import CartSummary from "./components/CartSummary";
import GuestCartNotice from "./components/GuestCartNotice";
import SelectAllBar from "./components/SelectAllBar";
import { useCartSelection } from "./hooks/useCartSelection";
import { useLoadFailureToast } from "./hooks/useLoadFailureToast";

type CartProps = { guest: boolean };

export default function Cart({ guest }: CartProps) {
  const { cart, cartIsLoading, cartError } = useGetCart();
  const items = useMemo(() => cart ?? [], [cart]);
  const {
    selectedIds,
    subtotal,
    allSelected,
    someSelected,
    toggleItem,
    toggleAll,
  } = useCartSelection(items);

  useLoadFailureToast(cartError);

  if (cartIsLoading) {
    return <CartLoading />;
  }

  if (items.length === 0) {
    return (
      <div className="mx-auto w-full max-w-7xl p-6">
        {guest ? <GuestCartNotice /> : null}
        <CartEmpty />
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-7xl p-6">
      {guest ? <GuestCartNotice /> : null}
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <CartHeader itemCount={items.length} />
          <SelectAllBar
            itemCount={items.length}
            selectedCount={selectedIds.size}
            allSelected={allSelected}
            someSelected={someSelected}
            onCheckedChange={toggleAll}
          />
          <CartItemsList
            items={items}
            selectedIds={selectedIds}
            onSelectionChange={toggleItem}
          />
        </div>

        <div className="space-y-6 lg:sticky lg:top-24 lg:self-start">
          <CartSummary
            itemCount={items.length}
            selectedCount={selectedIds.size}
            subtotal={subtotal}
            currency={Currency.RUB}
            guest={guest}
          />
        </div>
      </div>
    </div>
  );
}
