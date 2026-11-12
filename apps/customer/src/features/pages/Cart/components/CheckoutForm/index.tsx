"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { CalendarIcon, CreditCard, Loader2 } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { formatMoney, toCurrency } from "@/common/helpers/money";
import {
  CHECKOUT_METHOD_KEYS,
  CHOOSABLE_PAYMENT_METHODS,
} from "@/common/helpers/paymentMethods";
import { showToast } from "@/common/helpers/showToast";
import { PaymentMethod } from "@/common/types/order.types";
import type { ProductCartProps } from "@/common/types/product.types";
import { Currency } from "@/common/types/product.types";
import {
  type CheckoutFormData,
  createCheckoutFormSchema,
} from "@/common/zodSchemes/checkout.scheme";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { refusalReaction } from "@/hooks/order/checkoutErrors";
import { useCheckout } from "@/hooks/order/useCheckout";
import { usePickupPoints } from "@/hooks/pickup/usePickupPoints";
import { useShippingMethods } from "@/hooks/shipping/useShippingMethods";
import { cn } from "@/lib/utils";
import DeliveryField from "./components/DeliveryField";

type Props = {
  cartItems: ProductCartProps[];
  subtotal: number;
};

const CheckoutForm = ({ cartItems, subtotal }: Props) => {
  const { handleCheckout } = useCheckout();
  const {
    methods,
    isLoading: methodsLoading,
    error: methodsError,
    mutate: mutateMethods,
  } = useShippingMethods();
  const {
    points,
    isLoading: pointsLoading,
    error: pointsError,
    mutate: mutatePoints,
  } = usePickupPoints();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isPickup, setIsPickup] = useState(false);
  const t = useTranslations("cart");
  const validation = useTranslations("validation");
  const format = useFormatter();

  const schema = useMemo(
    () => createCheckoutFormSchema(validation, isPickup),
    [validation, isPickup],
  );

  const form = useForm<CheckoutFormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      deliveryAddress: "",
      pickupPointId: "",
      deliveryDate: undefined,
      shippingMethodId: "",
      paymentMethod: PaymentMethod.ONLINE_CARD,
    },
    mode: "onChange",
  });

  const {
    control,
    handleSubmit,
    setValue,
    watch,
    formState: { isValid },
  } = form;

  const selectedShippingMethodId = watch("shippingMethodId");
  const pickupPointId = watch("pickupPointId");

  // A failed request and an empty list leave the same usable state: no method
  // to pick, and a retry next to the select (AC-10).
  const methodsUnavailable =
    methodsError !== null || (!methodsLoading && methods.length === 0);
  const methodsBlocked = methodsLoading || methodsUnavailable;

  // A pickup method cannot be chosen while the shop runs no active point, and a
  // failed points read blocks the point field with its own retry (AC-6).
  const pointsUnavailable = !pointsLoading && points.length === 0;
  const pointsFailed = pointsError !== null;

  const selectedMethod = methods.find(
    (method) => method.id === selectedShippingMethodId,
  );
  const currency = toCurrency(
    selectedMethod?.currency ?? methods[0]?.currency ?? Currency.RUB,
  );
  const shippingPrice = selectedMethod?.price ?? 0;
  const total = subtotal + shippingPrice;
  const pickupWithoutPoint = isPickup && pickupPointId === "";

  const onSubmit = async (data: CheckoutFormData) => {
    setIsSubmitting(true);
    try {
      await handleCheckout(data, cartItems);
    } catch (error) {
      const reaction = refusalReaction(error);

      if (!reaction) {
        return;
      }

      // A refusal that names a gone method or a closed point refetches that
      // list and clears the choice, while the typed fields stay (AC-6).
      if (reaction.resetMethod) {
        await mutateMethods();
        setValue("shippingMethodId", "");
        setIsPickup(false);
      }

      if (reaction.resetPoint) {
        await mutatePoints();
        setValue("pickupPointId", "");
      }

      showToast({ title: t(reaction.key), type: "error" });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CreditCard className="h-5 w-5" />
          {t("checkoutTitle")}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {/* Selected Items Summary */}
        <div className="mb-6 p-4 bg-muted/30 rounded-lg">
          <h3 className="font-medium mb-2">
            {t("checkoutSelectedItems", { count: cartItems.length })}
          </h3>
          <div className="space-y-2">
            {cartItems.map((item) => (
              <div key={item.id} className="flex justify-between text-sm">
                <span className="flex-1">
                  {item.name} x {item.quantityInCart}
                </span>
                <span className="font-medium">
                  {formatMoney(item.price * item.quantityInCart, currency)}
                </span>
              </div>
            ))}
          </div>
        </div>

        <Form {...form}>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            {/* Delivery block: one field, chosen by the method */}
            <DeliveryField
              control={control}
              isPickup={isPickup}
              points={points}
              pointsLoading={pointsLoading}
              pointsFailed={pointsFailed}
              onPointsRetry={() => {
                void mutatePoints();
              }}
            />

            {/* Shipping Method */}
            <FormField
              control={control}
              name="shippingMethodId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("shippingMethod")}</FormLabel>
                  <FormControl>
                    <Select
                      value={field.value}
                      onValueChange={(value) => {
                        field.onChange(value);
                        setIsPickup(
                          methods.find((method) => method.id === value)
                            ?.isPickup ?? false,
                        );
                      }}
                      disabled={methodsBlocked}
                    >
                      <SelectTrigger>
                        <SelectValue
                          placeholder={
                            methodsLoading
                              ? t("shippingLoading")
                              : t("selectShippingMethod")
                          }
                        />
                      </SelectTrigger>
                      <SelectContent>
                        {methods.map((method) => {
                          const pickupBlocked =
                            method.isPickup && pointsUnavailable;

                          return (
                            <SelectItem
                              key={method.id}
                              value={method.id}
                              disabled={pickupBlocked}
                            >
                              <div className="flex flex-col">
                                <div className="font-medium">{method.name}</div>
                                <div className="text-sm text-muted-foreground">
                                  {formatMoney(
                                    method.price,
                                    toCurrency(method.currency),
                                  )}
                                </div>
                                {pickupBlocked && (
                                  <div className="text-sm text-destructive">
                                    {t("pickupUnavailable")}
                                  </div>
                                )}
                              </div>
                            </SelectItem>
                          );
                        })}
                      </SelectContent>
                    </Select>
                  </FormControl>
                  {methodsUnavailable && (
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm text-destructive">
                        {t("shippingUnavailable")}
                      </span>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          void mutateMethods();
                        }}
                      >
                        {t("shippingRetry")}
                      </Button>
                    </div>
                  )}
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Delivery Date */}
            <FormField
              control={control}
              name="deliveryDate"
              render={({ field }) => (
                <FormItem className="flex flex-col">
                  <FormLabel>{t("deliveryDate")}</FormLabel>
                  <Popover>
                    <PopoverTrigger asChild>
                      <FormControl>
                        <Button
                          variant="outline"
                          className={cn(
                            "w-full justify-start text-left font-normal",
                            !field.value && "text-muted-foreground",
                          )}
                        >
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {field.value ? (
                            format.dateTime(field.value, {
                              dateStyle: "long",
                            })
                          ) : (
                            <span>{t("pickDeliveryDate")}</span>
                          )}
                        </Button>
                      </FormControl>
                    </PopoverTrigger>
                    <PopoverContent
                      className="w-auto p-0 bg-background border"
                      align="start"
                    >
                      <Calendar
                        mode="single"
                        selected={field.value}
                        onSelect={field.onChange}
                        disabled={(date) =>
                          date < new Date() || date < new Date("1900-01-01")
                        }
                        className="rounded-md border-0"
                      />
                    </PopoverContent>
                  </Popover>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Payment Method */}
            <FormField
              control={control}
              name="paymentMethod"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("paymentMethod")}</FormLabel>
                  <FormControl>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {CHOOSABLE_PAYMENT_METHODS.map((method) => (
                          <SelectItem key={method} value={method}>
                            {t(CHECKOUT_METHOD_KEYS[method])}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Order Summary */}
            {methods.length > 0 && (
              <div className="space-y-2 border-t pt-4">
                <div className="flex justify-between text-sm">
                  <span>{t("subtotal")}</span>
                  <span>{formatMoney(subtotal, currency)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>{t("shipping")}</span>
                  <span>{formatMoney(shippingPrice, currency)}</span>
                </div>
                <div className="flex justify-between font-medium">
                  <span>{t("total")}</span>
                  <span>{formatMoney(total, currency)}</span>
                </div>
              </div>
            )}

            {/* Submit Button */}
            <Button
              type="submit"
              className="w-full"
              disabled={
                !isValid ||
                isSubmitting ||
                methodsBlocked ||
                selectedShippingMethodId === "" ||
                pickupWithoutPoint
              }
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {t("placingOrder")}
                </>
              ) : (
                <>
                  <CreditCard className="mr-2 h-4 w-4" />
                  {t("placeOrder")}
                </>
              )}
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
};

export default CheckoutForm;
