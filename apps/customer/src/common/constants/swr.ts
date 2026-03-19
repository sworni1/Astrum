export const SWR_INFINITE_CONFIG = {
  revalidateFirstPage: true,
  revalidateOnMount: true,
  revalidateOnReconnect: true,
  errorRetryCount: 2,
  errorRetryInterval: 1000,
  revalidateOnFocus: true,
  revalidateIfStale: true,
} as const;
