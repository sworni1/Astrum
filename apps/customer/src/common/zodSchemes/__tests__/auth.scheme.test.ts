import en from "@messages/en.json";
import ru from "@messages/ru.json";
import { subYears } from "date-fns";
import { describe, expect, it } from "vitest";
import { createRegisterFormSchema, MIN_AGE_YEARS } from "@/common/zodSchemes/auth.scheme";
import type { ValidationTranslator } from "@/common/zodSchemes/translator";

const translatorFor = (catalog: typeof en.validation) => {
  const translate = (
    key: keyof typeof catalog,
    values?: Record<string, unknown>,
  ) =>
    Object.entries(values ?? {}).reduce(
      (text, [name, value]) => text.replaceAll(`{${name}}`, String(value)),
      catalog[key],
    );

  return translate as unknown as ValidationTranslator;
};

const enSchema = createRegisterFormSchema(translatorFor(en.validation));
const ruSchema = createRegisterFormSchema(translatorFor(ru.validation));

const validCredentials = {
  email: "vanyanikitin84@gmail.com",
  password: "Test123!",
  nickName: "vanya",
  gender: "Male" as const,
};

describe("createRegisterFormSchema", () => {
  it("accepts a date of birth exactly at the minimum age", () => {
    const dateOfBirth = subYears(new Date(), MIN_AGE_YEARS);

    const result = enSchema.safeParse({
      ...validCredentials,
      dateOfBirth,
    });

    expect(result.success).toBe(true);
  });

  it("refuses a date of birth under the minimum age", () => {
    const dateOfBirth = subYears(new Date(), MIN_AGE_YEARS - 1);

    const result = enSchema.safeParse({
      ...validCredentials,
      dateOfBirth,
    });

    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.path).toEqual(["dateOfBirth"]);
    expect(result.error?.issues[0]?.message).toBe(
      `You must be at least ${MIN_AGE_YEARS} years old`,
    );
  });

  it("speaks the language it was built for", () => {
    const dateOfBirth = subYears(new Date(), MIN_AGE_YEARS - 1);

    const result = ruSchema.safeParse({
      ...validCredentials,
      dateOfBirth,
    });

    expect(result.error?.issues[0]?.message).toBe(
      ru.validation.minAge.replace("{age}", String(MIN_AGE_YEARS)),
    );
  });

  it("refuses a future date of birth", () => {
    const dateOfBirth = new Date(Date.now() + 24 * 60 * 60 * 1000);

    const result = enSchema.safeParse({
      ...validCredentials,
      dateOfBirth,
    });

    expect(result.success).toBe(false);
  });

  it("requires a date of birth and a gender", () => {
    const result = enSchema.safeParse({
      email: validCredentials.email,
      password: validCredentials.password,
    });

    expect(result.success).toBe(false);
    expect(result.error?.issues.map((issue) => issue.path[0])).toEqual(
      expect.arrayContaining(["dateOfBirth", "gender"]),
    );
  });
});
