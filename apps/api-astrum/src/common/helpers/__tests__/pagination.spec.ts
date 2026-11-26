import { MAX_PAGE_SIZE } from "../../constants/pagination.constants";
import { AppError } from "../appError";
import { parsePagination, parsePaginationValue } from "../pagination";

const invalid = () => new AppError(422, "VALIDATION", "Invalid pagination.");

describe("parsePagination", () => {
  it("falls back on the first page of twenty when the query names neither", () => {
    expect(parsePagination(undefined, undefined, invalid)).toEqual({
      page: 1,
      limit: 20,
    });
  });

  it("reads the two values the query carries", () => {
    expect(parsePagination("4", "35", invalid)).toEqual({ page: 4, limit: 35 });
  });

  it("clamps the limit to the shared ceiling", () => {
    expect(parsePagination("1", "500", invalid).limit).toBe(MAX_PAGE_SIZE);
  });

  it("refuses a value that is not a positive integer with the caller's own refusal", () => {
    for (const [page, limit] of [
      ["0", undefined],
      ["-1", undefined],
      ["1.5", undefined],
      ["abc", undefined],
      [undefined, "0"],
      [undefined, "1.5"],
      ["9007199254740992", undefined],
    ] as Array<[string | undefined, string | undefined]>) {
      expect(() => parsePagination(page, limit, invalid)).toThrow(AppError);
      expect(() => parsePagination(page, limit, invalid)).toThrow(
        "Invalid pagination.",
      );
    }
  });

  it("keeps one refusal factory per read, so no code table is imported here", () => {
    const refused = () => new AppError(422, "OTHER_CODE", "Other wording.");

    expect(() => parsePaginationValue("x", 1, refused)).toThrow(
      expect.objectContaining({
        code: "OTHER_CODE",
        message: "Other wording.",
      }),
    );
  });
});
