"use client";

import type { ReactNode } from "react";
import { TAB_ITEM, TAB_TRACK } from "@/features/general/lib/screenStyles";
import { cn } from "@/lib/utils";

export type FilterTabItem = {
  id: string;
  label: ReactNode;
};

type Props = {
  items: readonly FilterTabItem[];
  currentId: string;
  onChange: (id: string) => void;

  label?: string;
};

const FilterTabs = ({ items, currentId, onChange, label }: Props) => (
  <div className={TAB_TRACK} role="tablist" aria-label={label}>
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
