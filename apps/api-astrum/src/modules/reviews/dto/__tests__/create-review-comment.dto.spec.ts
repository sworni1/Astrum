import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";
import { CreateReviewCommentDto } from "../create-review-comment.dto";

const build = (body: Record<string, unknown>): CreateReviewCommentDto =>
  plainToInstance(CreateReviewCommentDto, body, {
    excludeExtraneousValues: true,
  });

const invalidProperties = async (
  body: Record<string, unknown>,
): Promise<string[]> =>
  (await validate(build(body))).map((error) => error.property);

describe("CreateReviewCommentDto", () => {
  it("trims the body before validation and before the write (AC-8)", () => {
    expect(build({ body: "   a reply   " }).body).toBe("a reply");
  });

  it("refuses a body shorter than five characters after the trim (AC-8)", async () => {
    expect(await invalidProperties({ body: "  four  " })).toEqual(["body"]);
  });

  it("refuses a body longer than 2000 characters (AC-8)", async () => {
    expect(await invalidProperties({ body: "a".repeat(2001) })).toEqual([
      "body",
    ]);
  });

  it("accepts a body of exactly 2000 characters and of exactly five (AC-8)", async () => {
    expect(await invalidProperties({ body: "a".repeat(2000) })).toEqual([]);
    expect(await invalidProperties({ body: "  reply  " })).toEqual([]);
  });

  it("names the body when it is missing (AC-8)", async () => {
    expect(await invalidProperties({})).toEqual(["body"]);
  });
});
