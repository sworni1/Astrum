export const withTimeout = async <T>(
  work: Promise<T>,
  timeoutMs: number,
  message: string,
): Promise<T> => {
  let timer: NodeJS.Timeout | undefined;

  const budget = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(() => reject(new Error(message)), timeoutMs);
  });

  try {
    return await Promise.race([work, budget]);
  } finally {
    clearTimeout(timer);
  }
};
