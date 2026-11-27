import type { Request } from "express";

export type Owner =
  | { kind: "user"; userId: string }
  | { kind: "guest"; guestId: string };

export type OwnerRequest = Request & {
  owner?: Owner;
  sessionStoreUnavailable?: boolean;
};

export const userOwner = (userId: string): Owner => ({ kind: "user", userId });

export const guestOwner = (guestId: string): Owner => ({
  kind: "guest",
  guestId,
});
