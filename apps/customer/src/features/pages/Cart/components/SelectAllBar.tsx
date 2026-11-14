"use client";

import { useTranslations } from "next-intl";
import { Checkbox } from "@/components/ui/checkbox";

type Props = {
  itemCount: number;
  selectedCount: number;
  allSelected: boolean;
  someSelected: boolean;
  onCheckedChange: (checked: boolean) => void;
};

const SelectAllBar = ({
  itemCount,
  selectedCount,
  allSelected,
  someSelected,
  onCheckedChange,
}: Props) => {
  const t = useTranslations("cart");

  return (
    <div className="flex items-center gap-3 p-4 bg-muted/30 rounded-lg border">
      <Checkbox
        id="select-all"
        checked={allSelected}
        onCheckedChange={onCheckedChange}
        className="border-gray-400"
      />
      <label
        htmlFor="select-all"
        className="text-sm font-medium cursor-pointer"
      >
        {t("selectAll", { count: itemCount })}
      </label>
      {someSelected && (
        <span className="text-xs text-muted-foreground ml-auto">
          {t("selectedOf", { selected: selectedCount, total: itemCount })}
        </span>
      )}
    </div>
  );
};

export default SelectAllBar;
