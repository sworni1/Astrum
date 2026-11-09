import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";
import { CreateOnboardingDto } from "./create-onboarding.dto";

const parse = async (input: unknown) => {
  const dto = plainToInstance(
    CreateOnboardingDto,
    { name: input },
    { excludeExtraneousValues: true },
  );
  const errors = await validate(dto);

  return { dto, errors };
};

describe("CreateOnboardingDto", () => {
  it("normalizes the name before it reaches the service (AC-6)", async () => {
    const { dto, errors } = await parse("  My   Shop  ");

    expect(errors).toHaveLength(0);
    expect(dto.name).toBe("My Shop");
  });

  it("stores the NFC form of a decomposed accent (AC-6)", async () => {
    const { dto, errors } = await parse("Cafe\u0301");

    expect(errors).toHaveLength(0);
    expect(dto.name).toBe("Caf\u00e9");
  });

  it("accepts 60 code points and rejects 61 (AC-6)", async () => {
    const sixty = await parse("x".repeat(60));
    const sixtyOne = await parse("x".repeat(61));

    expect(sixty.errors).toHaveLength(0);
    expect(sixtyOne.errors).toHaveLength(1);
    expect(sixtyOne.errors[0].property).toBe("name");
  });

  it("counts code points, so one astral character is too short (AC-6)", async () => {
    const { errors } = await parse("\u{1f600}");

    expect(errors.map((error) => error.property)).toEqual(["name"]);
  });

  it("rejects control and format characters (AC-6)", async () => {
    for (const input of ["Shop\u0000", "Shop\u202e", "Shop\u200d"]) {
      const { errors } = await parse(input);

      expect({ input, refused: errors.length > 0 }).toEqual({
        input,
        refused: true,
      });
    }
  });

  it("reports a refusal as a field error on name (AC-6)", async () => {
    const { errors } = await parse("A");

    expect(errors[0].property).toBe("name");
    expect(errors[0].constraints).toBeDefined();
  });

  it("rejects a non string body without throwing (AC-6)", async () => {
    const { errors } = await parse(42);

    expect(errors.map((error) => error.property)).toContain("name");
  });
});
