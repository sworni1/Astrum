"use client";

import { useCallback, useEffect, useMemo, useRef } from "react";
import type {
  GetRecommendationsType,
  ProductCardProps,
} from "../common/types/product.types";

type Props = {
  data: GetRecommendationsType[] | undefined;
  isLoading: boolean;
  isValidating: boolean;
  setSize: (
    size: number | ((_size: number) => number),
  ) => Promise<GetRecommendationsType[] | undefined>;
};

export type UseInfiniteScrollReturn = ReturnType<typeof useInfiniteScroll>;
export type UseInfiniteScrollProps = Props;

const INTERSECTION_OPTIONS = {
  root: null,
  rootMargin: "300px",
  threshold: 0.1,
} as const;

export const useInfiniteScroll = ({ data, isValidating, setSize }: Props) => {
  const products = useMemo(() => {
    if (!data?.length) return [];
    return data.reduce<ProductCardProps[]>((acc, rec) => {
      if (rec.products?.length) {
        acc.push(...rec.products);
      }
      return acc;
    }, []);
  }, [data]);

  const hasNextPage = useMemo(() => {
    if (!data?.length) return false;
    const lastPage = data.at(-1);
    return lastPage?.hasNextPage ?? false;
  }, [data]);

  const isReachingEnd = useMemo(() => {
    if (!data?.length) return false;
    const lastPage = data.at(-1);
    return lastPage?.nextCursor === null;
  }, [data]);

  const observerRef = useRef<HTMLDivElement | null>(null);
  const observerInstanceRef = useRef<IntersectionObserver | null>(null);

  const handleObserver = useCallback(
    (entries: IntersectionObserverEntry[]) => {
      if (!entries.length) return;

      const target = entries[0];
      if (!target.isIntersecting) return;
      if (isValidating || isReachingEnd) return;
      setSize((prevSize) => prevSize + 1);
    },
    [isValidating, isReachingEnd, setSize],
  );

  useEffect(() => {
    if (observerInstanceRef.current) {
      observerInstanceRef.current.disconnect();
    }
    const observer = new IntersectionObserver(
      handleObserver,
      INTERSECTION_OPTIONS,
    );
    observerInstanceRef.current = observer;

    const currentElement = observerRef.current;
    if (currentElement) {
      observer.observe(currentElement);
    }

    return () => {
      if (observerInstanceRef.current) {
        observerInstanceRef.current.disconnect();
        observerInstanceRef.current = null;
      }
    };
  }, [handleObserver]);

  return useMemo(
    () => ({
      observerRef,
      products,
      hasNextPage,
    }),
    [products, hasNextPage, observerRef],
  );
};
