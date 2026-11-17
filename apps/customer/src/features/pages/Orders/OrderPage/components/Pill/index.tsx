import type { ReactNode } from "react";
import {
  PILL_CLASS,
  PILL_TONE_CLASSES,
} from "@/features/pages/Orders/OrderPage/lib/pills";
import type { PillTone } from "@/features/pages/Orders/OrderPage/lib/status";
import { cn } from "@/lib/utils";

type Props = {
  tone: PillTone;
  children: ReactNode;
  testId?: string;
};

/** The one status pill of this screen, on the three token sets of AC-8. */
const Pill = ({ tone, children, testId }: Props) => (
  <span
    className={cn(PILL_CLASS, PILL_TONE_CLASSES[tone])}
    data-testid={testId}
  >
    {children}
  </span>
);

export default Pill;
