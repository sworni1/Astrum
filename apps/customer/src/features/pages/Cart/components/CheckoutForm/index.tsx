"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { CalendarIcon, CreditCard, Loader2, MapPin } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { PaymentMethod } from "@/common/types/order.types";
import type { ProductCartProps } from "@/common/types/product.types";
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
import { Input } from "@/components/ui/input";
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
import { Textarea } from "@/components/ui/textarea";
import { useCheckout } from "@/hooks";
import { cn } from "@/lib/utils";

type Props = {
  cartItems: ProductCartProps[];
  subtotal: number;
};

const CheckoutForm = ({ cartItems, subtotal }: Props) => {
  const { handleCheckout } = useCheckout();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const t = useTranslations("cart");
  const validation = useTranslations("validation");
  const format = useFormatter();

  const schema = useMemo(
    () => createCheckoutFormSchema(validation),
    [validation],
  );

  // Temporary shipping methods - should be fetched from API
  const shippingMethods = [
    { id: "cmf3vpjoi0000vdqkkwrasuzx", name: t("shippingStandard"), price: 5.99 },
    { id: "cmf3vq53t0001vdqk50gx74qz", name: t("shippingExpress"), price: 12.99 },
  ];
  const shippingMethodsLoading = false;

  const form = useForm<CheckoutFormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      deliveryAddress: "",
      deliveryDate: undefined,
      shippingMethodId: "",
      paymentMethod: PaymentMethod.ONLINE_CARD,
      paymentDetails: "",
    },
    mode: "onChange",
  });

  const {
    control,
    handleSubmit,
    watch,
    formState: { isValid },
  } = form;

  const selectedShippingMethodId = watch("shippingMethodId");
  const selectedShipping = shippingMethods.find(
    (method) => method.id === selectedShippingMethodId,
  );
  const shippingPrice = selectedShipping?.price || 0;
  const total = subtotal + shippingPrice;
  const paymentMethod = watch("paymentMethod");

  const onSubmit = async (data: CheckoutFormData) => {
    setIsSubmitting(true);
    try {
      console.log(data);
      await handleCheckout(data, cartItems);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Create a wrapper function that only takes the form data
  const handleFormSubmit = (data: CheckoutFormData) => {
    onSubmit(data);
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
                  ${(item.price * item.quantityInCart).toFixed(2)}
                </span>
              </div>
            ))}
          </div>
        </div>

        <Form {...form}>
          <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-6">
            {/* Delivery Address */}
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <MapPin className="h-5 w-5" />
                <FormLabel className="text-base font-medium">
                  {t("deliveryAddress")}
                </FormLabel>
              </div>

              <FormField
                control={control}
                name="deliveryAddress"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("fullAddress")}</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder={t("fullAddressPlaceholder")}
                        rows={3}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Shipping Method */}
            <FormField
              control={control}
              name="shippingMethodId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("shippingMethod")}</FormLabel>
                  <FormControl>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger>
                        <SelectValue placeholder={t("selectShippingMethod")} />
                      </SelectTrigger>
                      <SelectContent>
                        {shippingMethodsLoading ? (
                          <SelectItem value="loading" disabled>
                            <Loader2 className="h-4 w-4 animate-spin" />
                          </SelectItem>
                        ) : (
                          shippingMethods.map((method) => (
                            <SelectItem key={method.id} value={method.id}>
                              <div className="flex flex-col">
                                <div className="font-medium">{method.name}</div>
                                <div className="text-sm text-muted-foreground">
                                  ${method.price.toFixed(2)}
                                </div>
                              </div>
                            </SelectItem>
                          ))
                        )}
                      </SelectContent>
                    </Select>
                  </FormControl>
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
                        <SelectItem value={PaymentMethod.ONLINE_CARD}>
                          {t("paymentOnlineCard")}
                        </SelectItem>
                        <SelectItem value={PaymentMethod.PAYPAL}>
                          {t("paymentPaypal")}
                        </SelectItem>
                        <SelectItem value={PaymentMethod.STRIPE}>
                          {t("paymentStripe")}
                        </SelectItem>
                        <SelectItem value={PaymentMethod.CARD_ON_DELIVERY}>
                          {t("paymentCardOnDelivery")}
                        </SelectItem>
                        <SelectItem value={PaymentMethod.CASH}>
                          {t("paymentCash")}
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Payment Details */}
            {paymentMethod !== PaymentMethod.CASH && (
              <FormField
                control={control}
                name="paymentDetails"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("paymentDetails")}</FormLabel>
                    <FormControl>
                      <Input
                        placeholder={t("paymentDetailsPlaceholder")}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            {/* Order Summary */}
            <div className="space-y-2 border-t pt-4">
              <div className="flex justify-between text-sm">
                <span>{t("subtotal")}</span>
                <span>${subtotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span>{t("shipping")}</span>
                <span>${shippingPrice.toFixed(2)}</span>
              </div>
              <div className="flex justify-between font-medium">
                <span>{t("total")}</span>
                <span>${total.toFixed(2)}</span>
              </div>
            </div>

            {/* Submit Button */}
            <Button
              type="submit"
              className="w-full"
              disabled={!isValid || isSubmitting}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {t("placingOrder")}
                </>
              ) : (
                <>
                  <CreditCard className="mr-2 h-4 w-4" />
                  {t("placeOrder", { price: total.toFixed(2) })}
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
