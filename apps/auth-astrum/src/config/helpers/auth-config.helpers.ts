export const readRequired = (
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

export const withoutTrailingSlash = (value: string): string =>
  value.replace(/\/+$/, "");
