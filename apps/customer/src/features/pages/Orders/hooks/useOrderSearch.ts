"use client";

import { useEffect, useState } from "react";

export const ORDER_SEARCH_DEBOUNCE_MS = 300;

export interface UseOrderSearchReturn {
  inputValue: string;
  debouncedQuery: string;
  setInputValue: (value: string) => void;
}

/**
 * The field holds its own state and moves the trimmed query into the request key
 * 300 ms after the last keystroke. Clearing it returns at once, so the customer
 * never waits to see the unfiltered list (spec 0025, AC-9).
 */
export const useOrderSearch = (): UseOrderSearchReturn => {
  const [inputValue, setInputValue] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");

  useEffect(() => {
    const trimmed = inputValue.trim();

    // Clearing settles on the next tick, so returning to the unfiltered list
    // never waits for the typing debounce (spec 0025, AC-9).
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
