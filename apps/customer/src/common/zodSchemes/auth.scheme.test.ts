import { subYears } from "date-fns";
import { describe, expect, it } from "vitest";
import { MIN_AGE_YEARS, registerFormSchema } from "./auth.scheme";

const validCredentials = {
  email: "vanyanikitin84@gmail.com",
  password: "Test123!",
  nickName: "vanya",
  gender: "Male" as const,
};

describe("registerFormSchema", () => {
  it("принимает дату рождения ровно в минимальный возраст", () => {
    const dateOfBirth = subYears(new Date(), MIN_AGE_YEARS);

    const result = registerFormSchema.safeParse({
      ...validCredentials,
      dateOfBirth,
    });

    expect(result.success).toBe(true);
  });

  it("отклоняет дату рождения младше минимального возраста", () => {
    const dateOfBirth = subYears(new Date(), MIN_AGE_YEARS - 1);

    const result = registerFormSchema.safeParse({
      ...validCredentials,
      dateOfBirth,
    });

    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.path).toEqual(["dateOfBirth"]);
    expect(result.error?.issues[0]?.message).toBe(
      `You must be at least ${MIN_AGE_YEARS} years old`,
    );
  });

  it("отклоняет будущую дату рождения", () => {
    const dateOfBirth = new Date(Date.now() + 24 * 60 * 60 * 1000);

    const result = registerFormSchema.safeParse({
      ...validCredentials,
      dateOfBirth,
    });

    expect(result.success).toBe(false);
  });

  it("требует дату рождения и гендер", () => {
    const result = registerFormSchema.safeParse({
      email: validCredentials.email,
      password: validCredentials.password,
    });

    expect(result.success).toBe(false);
    expect(result.error?.issues.map((issue) => issue.path[0])).toEqual(
      expect.arrayContaining(["dateOfBirth", "gender"]),
    );
  });
});
