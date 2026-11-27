import { type NextRequest, NextResponse } from "next/server";
import { decrypt } from "./common/helpers/session";

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

  const staleCookie = cookie !== undefined && !session?.userId;

  if (!session?.userId && !isGuestPath(path)) {
    const signIn = new URL("/auth/signin", req.nextUrl);
    signIn.searchParams.set("next", path);

    const redirect = NextResponse.redirect(signIn);

    if (staleCookie) {
      redirect.cookies.delete("__auth");
    }

    return redirect;
  }

  const response = NextResponse.next();

  if (staleCookie) {
    response.cookies.delete("__auth");
  }

  return response;
}

export const config = {
  matcher: ["/((?!api|health|_next/static|_next/image|.*\\.png$).*)"],
};
