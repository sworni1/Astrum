import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";
import { CreatePointWorkerDto } from "../create-point-worker.dto";

/** Mirrors what `validateDto` does: strip, then validate (spec 0017). */
const check = async (body: unknown): Promise<string[]> => {
  const dto = plainToInstance(CreatePointWorkerDto, body, {
    excludeExtraneousValues: true,
  });
  const errors = await validate(dto);

  return errors.map((error) => error.property);
};

describe("CreatePointWorkerDto", () => {
  it("accepts a point id of 1 to 64 characters (AC-4)", async () => {
    await expect(check({ pickupPointId: "pp-1" })).resolves.toEqual([]);
    await expect(check({ pickupPointId: "a".repeat(64) })).resolves.toEqual([]);
  });

  it("refuses a missing, empty, overlong or non string id (AC-4)", async () => {
    await expect(check({})).resolves.toEqual(["pickupPointId"]);
    await expect(check({ pickupPointId: "" })).resolves.toEqual([
      "pickupPointId",
    ]);
    await expect(check({ pickupPointId: "a".repeat(65) })).resolves.toEqual([
      "pickupPointId",
    ]);
    await expect(check({ pickupPointId: 12 })).resolves.toEqual([
      "pickupPointId",
    ]);
  });
});
