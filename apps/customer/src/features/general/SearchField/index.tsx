"use client";

import { Loader2, Search } from "lucide-react";
import { SEARCH_FIELD, SEARCH_INPUT } from "@/features/general/lib/screenStyles";

type Props = {
  value: string;
  busy: boolean;
  placeholder: string;

  label: string;
  onChange: (value: string) => void;
};

const SearchField = ({ value, busy, placeholder, label, onChange }: Props) => (
  <div className={SEARCH_FIELD}>
    <Search className="size-4 shrink-0 text-muted-foreground" aria-hidden />
    <input
      type="search"
      className={SEARCH_INPUT}
      value={value}
      placeholder={placeholder}
      aria-label={label}
      onChange={(event) => onChange(event.target.value)}
    />
    {busy && (
      <Loader2
        className="size-4 shrink-0 animate-spin text-muted-foreground"
        aria-hidden
      />
    )}
  </div>
);

export default SearchField;
