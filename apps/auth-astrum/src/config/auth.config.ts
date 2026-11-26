import {
  readRequired,
  withoutTrailingSlash,
} from "./helpers/auth-config.helpers";

export type AuthConfig = {
  rabbitUrl: string;
  storefrontUrl: string;
};

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
