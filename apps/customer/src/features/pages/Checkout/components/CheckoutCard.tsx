import type { ReactNode } from "react";
import {
  CARD,
  CARD_BODY,
  CARD_HEADER,
  CARD_ICON,
  CARD_TITLE,
} from "@/features/pages/Checkout/lib/styles";
import { cn } from "@/lib/utils";

type Props = {
  title: string;
  icon?: ReactNode;
  children: ReactNode;
  bodyClassName?: string;
};

const CheckoutCard = ({ title, icon, children, bodyClassName }: Props) => (
  <section className={CARD}>
    <div className={CARD_HEADER}>
      {icon ? (
        <span className={CARD_ICON} aria-hidden="true">
          {icon}
        </span>
      ) : null}
      <h2 className={CARD_TITLE}>{title}</h2>
    </div>
    <div className={cn(CARD_BODY, bodyClassName)}>{children}</div>
  </section>
);

export default CheckoutCard;
