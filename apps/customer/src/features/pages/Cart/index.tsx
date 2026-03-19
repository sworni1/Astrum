"use client";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Package, CreditCard, Truck, Shield, Loader2 } from "lucide-react";
import { useState, useMemo } from "react";
import CartCard from "./components/CartCard";
import CheckoutForm from "./components/CheckoutForm";
import { useGetCart } from "../../../hooks/product/useCart";
import { showToast } from "../../../common";

export default function Cart() {
  const { cart, cartIsLoading, cartError } = useGetCart();
  const [showCheckout, setShowCheckout] = useState(false);
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());

  // Calculate selected items and their subtotal
  const selectedCartItems = useMemo(() => {
    return cart?.filter((item) => selectedItems.has(item.id)) || [];
  }, [cart, selectedItems]);

  const selectedSubtotal = useMemo(() => {
    return selectedCartItems.reduce((total, item) => {
      return total + item.price * item.quantityInCart;
    }, 0);
  }, [selectedCartItems]);

  // Handle item selection
  const handleItemSelect = (itemId: string, checked: boolean) => {
    setSelectedItems((prev) => {
      const newSelected = new Set(prev);
      if (checked) {
        newSelected.add(itemId);
      } else {
        newSelected.delete(itemId);
      }
      return newSelected;
    });
  };

  // Handle select all
  const handleSelectAll = (checked: boolean) => {
    if (checked && cart) {
      setSelectedItems(new Set(cart.map((item) => item.id)));
    } else {
      setSelectedItems(new Set());
    }
  };

  // Check if all items are selected
  const allItemsSelected = cart
    ? selectedItems.size === cart.length && cart.length > 0
    : false;
  const someItemsSelected = selectedItems.size > 0;

  // Calculate subtotal for display purposes (all items)

  if (cartIsLoading) {
    return (
      <div className="flex justify-center items-center py-20">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  if (cartError) {
    showToast({
      title: "Error!",
      type: "error",
      description: "Failed to load cart",
    });
  }

  if (!cart || cart.length === 0) {
    return (
      <div className="text-center py-20 text-muted-foreground">
        Your cart is empty
      </div>
    );
  }

  if (showCheckout) {
    return (
      <div className="mx-auto w-full max-w-4xl p-6">
        <div className="mb-6">
          <Button
            variant="ghost"
            onClick={() => setShowCheckout(false)}
            className="mb-4"
          >
            ← Back to Cart
          </Button>
          <h1 className="text-2xl font-semibold">Checkout</h1>
          <p className="text-muted-foreground">
            Complete your order details below
          </p>
        </div>
        <CheckoutForm
          cartItems={selectedCartItems}
          subtotal={selectedSubtotal}
        />
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-7xl p-6">
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
        {/* Main Cart Section */}
        <div className="space-y-6 lg:col-span-2">
          <div>
            <h1 className="text-2xl font-semibold">Shopping Cart</h1>
            <p className="text-muted-foreground">
              {cart.length} {cart.length === 1 ? "item" : "items"} in your cart
            </p>
          </div>

          {/* Select All Checkbox */}
          <div className="flex items-center gap-3 p-4 bg-muted/30 rounded-lg border">
            <Checkbox
              id="select-all"
              checked={allItemsSelected}
              onCheckedChange={handleSelectAll}
              className="border-gray-400"
            />
            <label
              htmlFor="select-all"
              className="text-sm font-medium cursor-pointer"
            >
              Select all items ({cart.length})
            </label>
            {someItemsSelected && (
              <span className="text-xs text-muted-foreground ml-auto">
                {selectedItems.size} of {cart.length} selected
              </span>
            )}
          </div>

          <div className="space-y-4">
            {cart.map((item) => (
              <CartCard
                key={item.id}
                {...item}
                isSelected={selectedItems.has(item.id)}
                onSelectionChange={(checked) =>
                  handleItemSelect(item.id, checked)
                }
              />
            ))}
          </div>
        </div>

        {/* Order Summary */}
        <div className="space-y-6  lg:sticky lg:top-24 lg:self-start">
          <Card>
            <CardHeader>
              <CardTitle>Order Summary</CardTitle>
              <CardDescription>
                Review your cart and proceed to checkout
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Order Summary */}
              <div className="space-y-2">
                <div className="flex justify-between text-sm text-muted-foreground">
                  <span>Total items in cart</span>
                  <span>{cart.length} items</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>Selected items ({selectedItems.size})</span>
                  <span>${selectedSubtotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm text-muted-foreground">
                  <span>Shipping</span>
                  <span>Calculated at checkout</span>
                </div>
                <div className="flex justify-between font-medium text-base pt-2 border-t">
                  <span>Order Total</span>
                  <span>${selectedSubtotal.toFixed(2)}</span>
                </div>
              </div>

              {/* Features */}
              <div className="space-y-4 border-t pt-4">
                <div className="flex items-center gap-2 text-sm">
                  <Package className="text-primary h-4 w-4" />
                  <span>Free returns within 30 days</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <Shield className="text-primary h-4 w-4" />
                  <span>Secure payment</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <Truck className="text-primary h-4 w-4" />
                  <span>Fast delivery</span>
                </div>
              </div>

              {/* Checkout Button */}
              <Button
                className="w-full"
                onClick={() => setShowCheckout(true)}
                disabled={selectedItems.size === 0}
              >
                <CreditCard className="mr-2 h-4 w-4" />
                {selectedItems.size === 0
                  ? "Select items to checkout"
                  : `Proceed to Checkout (${selectedItems.size} items)`}
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
