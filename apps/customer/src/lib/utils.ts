import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

const classNameCache = new Map<string, string>();
const MAX_CACHE_SIZE = 1000;
export function cn(...inputs: ClassValue[]) {
  const cacheKey = JSON.stringify(inputs);

  if (classNameCache.has(cacheKey)) {
    return classNameCache.get(cacheKey)!;
  }

  const result = twMerge(clsx(inputs));

  if (classNameCache.size >= MAX_CACHE_SIZE) {
    const firstKey = classNameCache.keys().next().value;
    if (firstKey !== undefined) {
      classNameCache.delete(firstKey);
    }
  }

  classNameCache.set(cacheKey, result);

  return result;
}
