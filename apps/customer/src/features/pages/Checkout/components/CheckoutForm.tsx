"use client";

import type { ProductCartProps } from "@/common/types/product.types";
import { Form } from "@/components/ui/form";
import PaymentSection from "@/features/pages/Checkout/components/PaymentSection";
import ReceiptSection from "@/features/pages/Checkout/components/ReceiptSection";
import SelectedLines from "@/features/pages/Checkout/components/SelectedLines";
import SummaryCard from "@/features/pages/Checkout/components/SummaryCard";
import { useCheckoutForm } from "@/features/pages/Checkout/hooks/useCheckoutForm";
import {
  CHECKOUT_COLUMNS,
  CHECKOUT_FORM_COLUMN,
  CHECKOUT_SUMMARY_COLUMN,
} from "@/features/pages/Checkout/lib/styles";

type Props = {
  lines: ProductCartProps[];
};

/**
 * The two columns inside one `<form>`: the three cards on the left, the sticky
 * summary on the right (spec 0024, AC-9, AC-13).
 */
const CheckoutForm = ({ lines }: Props) => {
  const { form, state, submit } = useCheckoutForm(lines);

  return (
    <Form {...form}>
      <form onSubmit={submit} className={CHECKOUT_COLUMNS} noValidate>
        <div className={CHECKOUT_FORM_COLUMN}>
          <SelectedLines lines={lines} currency={state.currency} />
          <ReceiptSection form={form} state={state} />
          <PaymentSection form={form} />
        </div>

        <div className={CHECKOUT_SUMMARY_COLUMN}>
          <SummaryCard state={state} />
        </div>
      </form>
    </Form>
  );
};

export default CheckoutForm;
