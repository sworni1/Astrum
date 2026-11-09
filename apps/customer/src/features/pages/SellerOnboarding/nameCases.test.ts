import { describe, expect, it } from "vitest";
import {
  normalizeShopName,
  shopNameProblem,
} from "../../../../../api-astrum/src/modules/seller/shop-name";
import {
  createShopNameSchema,
  normalizeShopName as normalizeOnClient,
  shopNameProblem as problemOnClient,
} from "../../../common/zodSchemes/shop-name.scheme";
import { SHOP_NAME_CASES } from "./nameCases";

const translator = ((key: string) => key) as never;
const schema = createShopNameSchema(translator);

describe("shop name rule", () => {
  it("runs the shared table through the client schema and the server rule (AC-4, AC-6)", () => {
    for (const testCase of SHOP_NAME_CASES) {
      const parsed = schema.safeParse({ name: testCase.input });

      expect({
        label: testCase.label,
        clientValid: parsed.success,
        clientStored: parsed.success ? parsed.data.name : "",
      }).toEqual({
        label: testCase.label,
        clientValid: testCase.valid,
        clientStored: testCase.stored,
      });

      expect({
        label: testCase.label,
        serverValid:
          shopNameProblem(normalizeShopName(testCase.input)) === null,
        serverStored:
          shopNameProblem(normalizeShopName(testCase.input)) === null
            ? normalizeShopName(testCase.input)
            : "",
      }).toEqual({
        label: testCase.label,
        serverValid: testCase.valid,
        serverStored: testCase.stored,
      });
    }
  });

  it("normalizes the same way on both sides", () => {
    for (const input of ["  My   Shop  ", "Cafe\u0301", "A \t B"]) {
      expect(normalizeOnClient(input)).toBe(normalizeShopName(input));
      expect(problemOnClient(normalizeOnClient(input))).toBe(
        shopNameProblem(normalizeShopName(input)),
      );
    }
  });

  it("names the problem for a form message (AC-4)", () => {
    expect(problemOnClient("")).toBe("required");
    expect(problemOnClient("A")).toBe("tooShort");
    expect(problemOnClient("x".repeat(61))).toBe("tooLong");
    expect(problemOnClient("Shop\u202e")).toBe("forbidden");
    expect(problemOnClient("My Shop")).toBeNull();
  });
});
