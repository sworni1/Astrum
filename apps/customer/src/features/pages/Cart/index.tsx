"use client";

import { useMemo, useState } from "react";
import { Currency } from "@/common/types/product.types";
import { useGetCart } from "@/hooks/product/useCart/useGetCart";
import CartEmpty from "./components/CartEmpty";
import CartHeader from "./components/CartHeader";
import CartItemsList from "./components/CartItemsList";
import CartLoading from "./components/CartLoading";
import CartSummary from "./components/CartSummary";
import CheckoutScreen from "./components/CheckoutScreen";
import SelectAllBar from "./components/SelectAllBar";
import { useCartSelection } from "./hooks/useCartSelection";
import { useLoadFailureToast } from "./hooks/useLoadFailureToast";

export default function Cart() {
  const { cart, cartIsLoading, cartError } = useGetCart();
  const [showCheckout, setShowCheckout] = useState(false);
  const items = useMemo(() => cart ?? [], [cart]);
  const {
    selectedIds,
    selectedItems,
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
    return <CartEmpty />;
  }

  if (showCheckout) {
    return (
      <CheckoutScreen
        cartItems={selectedItems}
        subtotal={subtotal}
        onBack={() => setShowCheckout(false)}
      />
    );
  }

  return (
    <div className="mx-auto w-full max-w-7xl p-6">
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
            onCheckout={() => setShowCheckout(true)}
          />
        </div>
      </div>
    </div>
  );
}
