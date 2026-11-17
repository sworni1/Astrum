"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { TAB_ITEM, TAB_TRACK } from "@/features/general/lib/screenStyles";

export type FilterTabItem = {
  id: string;
  label: ReactNode;
};

type Props = {
  items: readonly FilterTabItem[];
  currentId: string;
  onChange: (id: string) => void;
  /** The accessible name of the strip; a tablist without one reads as a list of buttons. */
  label?: string;
};

/**
 * A strip of mutually exclusive choices: the current one, the items and a change
 * handler. Moved out of `Orders/components/OrdersToolbar/OrderTabs.tsx` and
 * generalised, so both order screens read one component (spec 0026, AC-13).
 */
const FilterTabs = ({ items, currentId, onChange, label }: Props) => (
  <div
    className={TAB_TRACK}
    role="tablist"
    aria-label={label}
  >
    {items.map((item) => {
      const active = item.id === currentId;

      return (
        <button
          key={item.id}
          type="button"
          role="tab"
          aria-selected={active}
          className={cn(
            TAB_ITEM,
            "cursor-pointer transition-colors focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring",
            active
              ? "bg-secondary text-foreground"
              : "text-muted-foreground hover:text-foreground",
          )}
          onClick={() => onChange(item.id)}
        >
          {item.label}
        </button>
      );
    })}
  </div>
);

export default FilterTabs;
