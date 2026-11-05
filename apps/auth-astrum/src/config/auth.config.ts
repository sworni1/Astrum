export type AuthConfig = {
  rabbitUrl: string;
  storefrontUrl: string;
};

export type ConfirmOutcome = "ok" | "expired" | "used" | "invalid";

const readRequired = (
  env: NodeJS.ProcessEnv,
  name: string,
  hint: string,
): string => {
  const value = env[name]?.trim();

  if (!value) {
    throw new Error(`${name} is required: ${hint}`);
  }

  return value;
};

const withoutTrailingSlash = (value: string): string =>
  value.replace(/\/+$/, "");

/**
 * Checked before the Nest application is created, so a missing variable ends
 * the boot with a readable reason instead of a confirm route that redirects
 * somewhere broken.
 */
export const loadAuthConfig = (
  env: NodeJS.ProcessEnv = process.env,
): AuthConfig => ({
  rabbitUrl: readRequired(
    env,
    "RABBITMQ_URL",
    "registration publishes the confirmation event to the broker",
  ),
  storefrontUrl: withoutTrailingSlash(
    readRequired(
      env,
      "STOREFRONT_URL",
      "the confirm route redirects to the storefront",
    ),
  ),
});

export const confirmRedirectUrl = (
  storefrontUrl: string,
  outcome: ConfirmOutcome,
): string => `${storefrontUrl}/auth/confirm-email?status=${outcome}`;
