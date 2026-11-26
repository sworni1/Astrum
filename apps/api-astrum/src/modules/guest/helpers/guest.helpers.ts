export const isLive = (product: {
  isDeleted: boolean;
  visibility: string;
  status: string;
}): boolean =>
  !product.isDeleted &&
  product.visibility === "Public" &&
  product.status === "Published";

export const describeError = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

export const cookieBase = {
  httpOnly: true,
  sameSite: "lax" as const,
  path: "/",
  secure: process.env.NODE_ENV === "production",
};
