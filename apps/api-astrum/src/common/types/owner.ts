import type { Request } from "express";

/** Who a cart or a wishlist row belongs to: an account, or the visitor behind `__guest` (spec 0028). */
export type Owner =
  | { kind: "user"; userId: string }
  | { kind: "guest"; guestId: string };

/** Set by `optionalAuth`: a request with no identity carries no owner at all. */
export type OwnerRequest = Request & { owner?: Owner };

export const userOwner = (userId: string): Owner => ({ kind: "user", userId });

export const guestOwner = (guestId: string): Owner => ({
  kind: "guest",
  guestId,
});
