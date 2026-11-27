export const withTimeout = async <T>(
  work: Promise<T>,
  timeoutMs: number,
): Promise<T> => {
  let timer: NodeJS.Timeout | undefined;

  try {
    return await Promise.race([
      work,
      new Promise<never>((_resolve, reject) => {
        timer = setTimeout(
          () =>
            reject(
              new Error(`the broker did not answer within ${timeoutMs} ms`),
            ),
          timeoutMs,
        );
      }),
    ]);
  } finally {
    if (timer) {
      clearTimeout(timer);
    }
  }
};
