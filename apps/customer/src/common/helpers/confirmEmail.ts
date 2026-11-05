import axios from "axios";

const client = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_GATEWAY_URL,
  withCredentials: true,
  timeout: 10000,
  headers: { "Content-Type": "application/json" },
});

/**
 * The resend route answers 204 whatever happens, so a caller cannot tell an
 * unknown address from a known one. The address travels lowercased because
 * that is the identity the rate limit counts.
 */
export const requestConfirmationEmail = async (email: string): Promise<void> => {
  await client.post("/auth/confirm/resend", { email: email.trim().toLowerCase() });
};

export const requestConfirmationForCurrentUser = async (): Promise<void> => {
  const { data } = await client.get<{ email?: string }>("/users/me");

  if (typeof data?.email === "string" && data.email.length > 0) {
    await requestConfirmationEmail(data.email);
  }
};
