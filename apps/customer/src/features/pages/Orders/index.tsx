"use client";

import { Loader2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { showToast } from "../../../common";
import { useGetOrders } from "../../../hooks/order";
import OrderCard from "./OrderCard";

export default function Orders() {
  const { orders, isLoading, error } = useGetOrders();

  if (isLoading) {
    return (
      <div className="min-h-screen flex justify-center items-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (error) {
    showToast({
      title: "Error!",
      type: "error",
      description: "Failed to load orders",
    });
  }

  return (
    <div className="min-h-screen mx-auto max-w-screen-xl px-4 2xl:px-3 p-4 md:p-6">
      <div className="mb-4 items-end justify-between space-y-4 sm:flex sm:space-y-0 md:mb-8">
        <h2 className="mt-3 text-xl font-semibold text-gray-900 dark:text-white sm:text-2xl">
          My Orders
        </h2>
        {orders && orders.length > 0 && (
          <p className="text-muted-foreground">
            {orders.length} order{orders.length === 1 ? "" : "s"} found
          </p>
        )}
      </div>

      {!orders || orders.length === 0 ? (
        <Card className="w-full">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <div className="text-center space-y-2">
              <h3 className="text-lg font-medium">No orders yet</h3>
              <p className="text-muted-foreground">
                You haven&apos;t placed any orders yet. Start shopping to see
                your orders here!
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {orders.map((order) => (
            <OrderCard key={order.id} order={order} />
          ))}
        </div>
      )}
    </div>
  );
}
