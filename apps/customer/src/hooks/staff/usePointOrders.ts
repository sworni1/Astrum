"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useFetcher } from "@/hooks/useFetcher";
import type { PointOrder, PointOrdersPage } from "./pointOrder.types";

const PAGE_SIZE = 20;

export interface UsePointOrdersReturn {
  orders: PointOrder[];
  page: number;
  totalPages: number;
  total: number;
  isLoading: boolean;
  isValidating: boolean;
  error: unknown;
  showMore: () => void;
  mutate: () => Promise<void>;
}

/**
 * The parcels of the caller's own point, one page at a time. `showMore` appends
 * the next page, and `mutate` drops every accumulated page and re-reads the
 * first one, so a closed order can never leave a shifted offset behind
 * (spec 0018, AC-10, AC-11).
 */
export const usePointOrders = (): UsePointOrdersReturn => {
  const { getData } = useFetcher();
  const [orders, setOrders] = useState<PointOrder[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isValidating, setIsValidating] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const generation = useRef(0);

  const load = useCallback(
    async (target: number): Promise<void> => {
      generation.current += 1;
      const own = generation.current;

      setIsValidating(true);
      setIsLoading(target === 1);

      try {
        const answer = (await getData(
          `/staff/point/orders?page=${target}&limit=${PAGE_SIZE}`,
        )) as PointOrdersPage;

        // A newer read has started, so this answer is already stale.
        if (generation.current !== own) {
          return;
        }

        setOrders((current) =>
          target === 1 ? answer.orders : [...current, ...answer.orders],
        );
        setPage(answer.page);
        setTotalPages(answer.totalPages);
        setTotal(answer.total);
        setError(null);
      } catch (raised) {
        if (generation.current === own) {
          setError(raised);
        }
      } finally {
        if (generation.current === own) {
          setIsLoading(false);
          setIsValidating(false);
        }
      }
    },
    [getData],
  );

  useEffect(() => {
    void load(1);
  }, [load]);

  const showMore = useCallback((): void => {
    if (page >= totalPages) {
      return;
    }

    void load(page + 1);
  }, [load, page, totalPages]);

  const mutate = useCallback(async (): Promise<void> => {
    await load(1);
  }, [load]);

  return {
    orders,
    page,
    totalPages,
    total,
    isLoading,
    isValidating,
    error,
    showMore,
    mutate,
  };
};
