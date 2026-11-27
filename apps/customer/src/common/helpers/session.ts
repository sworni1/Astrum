"use server";

import { jwtVerify } from "jose";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";

const secretKey = process.env.JWT_SECRET;
const encodedKey = new TextEncoder().encode(secretKey);

const SESSION_LIFETIME_MS = 24 * 60 * 60 * 1000;
const LOGOUT_TIMEOUT_MS = 2000;
const SESSION_PROBE_TIMEOUT_MS = 2000;
const GATEWAY_URL = (
  process.env.API_GATEWAY_INTERNAL_URL ?? "http://127.0.0.1:3580"
).replace(/\/+$/, "");

export async function decrypt(session: string | undefined = "") {
  if (!session) {
    return undefined;
  }

  try {
    const { payload } = await jwtVerify(session, encodedKey, {
      algorithms: ["HS256"],
    });
    return payload;
  } catch (error) {
    if ((error as { code?: string }).code !== "ERR_JWT_EXPIRED") {
      console.error(
        JSON.stringify({
          event: "session.decrypt_failed",
          reason: error instanceof Error ? error.message : String(error),
        }),
      );
    }
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

const sessionWasDropped = async (cookie: string): Promise<boolean> => {
  try {
    const response = await fetch(`${GATEWAY_URL}/api/users/me`, {
      headers: { cookie: `__auth=${cookie}` },
      signal: AbortSignal.timeout(SESSION_PROBE_TIMEOUT_MS),
      cache: "no-store",
    });

    return response.status === 401;
  } catch (error) {
    console.error(
      JSON.stringify({
        event: "session.probe_failed",
        reason: error instanceof Error ? error.message : String(error),
      }),
    );

    return false;
  }
};

export const readVerifiedSession = async () => {
  const cookie = (await cookies()).get("__auth")?.value;
  const session = await decrypt(cookie);

  if (!session?.userId || !cookie) {
    redirect("/auth/signin");
  }

  if (await sessionWasDropped(cookie)) {
    redirect("/auth/signin");
  }

  return { isAuth: true, userId: session.userId, cookie };
};

export const verifySession = cache(readVerifiedSession);

export const readSessionUserId = async (): Promise<string | null> => {
  const cookie = (await cookies()).get("__auth")?.value;
  const session = await decrypt(cookie);

  return typeof session?.userId === "string" ? session.userId : null;
};
