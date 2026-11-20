import { Skeleton } from "@/components/ui/skeleton";
import {
  CHECKOUT_COLUMNS,
  CHECKOUT_FORM_COLUMN,
  CHECKOUT_STACK,
  CHECKOUT_SUMMARY_COLUMN,
  CHECKOUT_WRAPPER,
} from "@/features/pages/Checkout/lib/styles";

const CheckoutSkeleton = () => (
  <main className={CHECKOUT_WRAPPER} aria-busy="true">
    <div className={CHECKOUT_STACK}>
      <div className="flex flex-col gap-2">
        <Skeleton className="h-7 w-56" />
        <Skeleton className="h-4 w-72" />
      </div>

      <div className={CHECKOUT_COLUMNS}>
        <div className={CHECKOUT_FORM_COLUMN}>
          <Skeleton className="h-[132px] rounded-xl" />
          <Skeleton className="h-[248px] rounded-xl" />
        </div>
        <div className={CHECKOUT_SUMMARY_COLUMN}>
          <Skeleton className="h-[268px] rounded-xl" />
        </div>
      </div>
    </div>
  </main>
);

export default CheckoutSkeleton;
