import { type NextRequest, NextResponse } from "next/server";
import { decrypt } from "./common/helpers/session";

/** A visitor with no account reads these paths; everything else needs a session. */
const guestPaths = ["/", "/cart", "/wishlist"];
const guestPrefixes = ["/auth", "/categories", "/products"];

export const isGuestPath = (path: string): boolean =>
  guestPaths.includes(path) ||
  guestPrefixes.some(
    (prefix) => path === prefix || path.startsWith(`${prefix}/`),
  );

export default async function proxy(req: NextRequest) {
  const path = req.nextUrl.pathname;

  const cookie = req.cookies.get("__auth")?.value;

  const session = await decrypt(cookie);

  if (session?.userId || isGuestPath(path)) {
    return NextResponse.next();
  }

  const signIn = new URL("/auth/signin", req.nextUrl);
  signIn.searchParams.set("next", path);

  return NextResponse.redirect(signIn);
}

export const config = {
  matcher: ["/((?!api|health|_next/static|_next/image|.*\\.png$).*)"],
};
