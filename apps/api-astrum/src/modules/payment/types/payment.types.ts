export type StartPaymentResult = {
  url: string;
  expiresAt: Date;
  created: boolean;
};

export type ProviderSession = {
  id: string;
  status: string | null;
  paymentStatus: string | null;
  amountTotal: number | null;
  currency: string | null;
  paymentIntentId: string | null;
  orderId: string | null;
};

export type ProviderEvent = {
  id: string;
  type: string;
  sessionId: string | null;
  paymentIntentId: string | null;
  orderId: string | null;
  amount: number | null;
  currency: string | null;
  sessionStatus: string | null;
  paymentStatus: string | null;
  declineCode: string | null;
  errorMessage: string | null;
};

export type ExpiryOutcome = "closed" | "seller" | "unchanged";

export type ApplyResult = "applied" | "ignored";

export type SessionOutcome = "paid" | "expired" | "open" | "unknown";
