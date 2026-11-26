export const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => {
    setTimeout(resolve, ms);
  });

export const addMinutes = (from: Date, minutes: number): Date =>
  new Date(from.getTime() + minutes * 60_000);
