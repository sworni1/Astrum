"use client";

import { useEffect, useState } from "react";

export const ORDER_SEARCH_DEBOUNCE_MS = 300;

export interface UseOrderSearchReturn {
  inputValue: string;
  debouncedQuery: string;
  setInputValue: (value: string) => void;
}

export const useOrderSearch = (): UseOrderSearchReturn => {
  const [inputValue, setInputValue] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");

  useEffect(() => {
    const trimmed = inputValue.trim();

    const timer = setTimeout(
      () => {
        setDebouncedQuery(trimmed);
      },
      trimmed === "" ? 0 : ORDER_SEARCH_DEBOUNCE_MS,
    );

    return () => {
      clearTimeout(timer);
    };
  }, [inputValue]);

  return { inputValue, debouncedQuery, setInputValue };
};
