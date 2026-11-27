import { Prisma } from "@astrum/db/client";

export const SWEEP_TRANSACTION_OPTIONS = {
  maxWait: 5_000,
  timeout: 60_000,
  isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted,
};
