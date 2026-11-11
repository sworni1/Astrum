"use server";

import { jwtVerify } from "jose";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";

const secretKey = process.env.JWT_SECRET;
const encodedKey = new TextEncoder().encode(secretKey);

/** The cookie lives exactly as long as the token inside it. */
const SESSION_LIFETIME_MS = 24 * 60 * 60 * 1000;
const LOGOUT_TIMEOUT_MS = 2000;
const GATEWAY_URL = (
  process.env.API_GATEWAY_INTERNAL_URL ?? "http://127.0.0.1:3580"
).replace(/\/+$/, "");

export async function decrypt(session: string | undefined = "") {
  try {
    const { payload } = await jwtVerify(session, encodedKey, {
      algorithms: ["HS256"],
    });
    return payload;
  } catch {
    console.error("Failed to verify session");
  }
}

export async function createSession(token: string) {
  const expiresAt = new Date(Date.now() + SESSION_LIFETIME_MS);
  const cookieStore = await cookies();

  cookieStore.set("__auth", token, {
    httpOnly: true,
    secure: true,
    expires: expiresAt,
    sameSite: "lax",
    path: "/",
  });
}

export async function deleteSession() {
  const cookieStore = await cookies();
  cookieStore.delete("__auth");
}

/**
 * Ends the session on the server before it ends in the browser, so a copied
 * cookie stops working at the next request. A backend that is down or slow must
 * never trap the customer inside the account, so the cookie is deleted either
 * way and the failure only reaches the logs.
 */
export async function endSession(): Promise<void> {
  const cookieStore = await cookies();
  const token = cookieStore.get("__auth")?.value;

  if (token) {
    try {
      const response = await fetch(`${GATEWAY_URL}/api/auth/logout`, {
        method: "POST",
        headers: { cookie: `__auth=${token}` },
        signal: AbortSignal.timeout(LOGOUT_TIMEOUT_MS),
        cache: "no-store",
      });

      if (!response.ok) {
        throw new Error(`logout answered ${response.status}`);
      }
    } catch (error) {
      console.error(
        JSON.stringify({
          event: "session.logout.remote_failed",
          reason: error instanceof Error ? error.message : String(error),
        }),
      );
    }
  }

  cookieStore.delete("__auth");
  redirect("/auth/signin");
}

export const verifySession = cache(async () => {
  const cookie = (await cookies()).get("__auth")?.value;
  const session = await decrypt(cookie);

  if (!session?.userId) {
    redirect("/auth/signin");
  }

  return { isAuth: true, userId: session.userId, cookie };
});
