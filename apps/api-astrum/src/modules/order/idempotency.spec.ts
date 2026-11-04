import { AppError } from "../../common/helpers/appError";
import type { CreateOrderDto } from "./dto/create-order.dto";
import {
  canonicalOrderBody,
  hashOrderBody,
  readIdempotencyKey,
} from "./idempotency";

const dtoFor = (overrides: Partial<CreateOrderDto> = {}): CreateOrderDto =>
  ({
    deliveryAddress: "Lenina 1",
    deliveryDate: "2026-11-10T12:00:00.000Z" as never,
    shippingMethodId: "ship-1",
    paymentMethod: "CASH",
    paymentDetails: "Cash on delivery",
    orderItems: [{ productId: "p-1", quantity: 1 }],
    ...overrides,
  }) as CreateOrderDto;

describe("readIdempotencyKey", () => {
  it("принимает ключ из 8 символов и отдаёт его как есть (AC-1)", () => {
    expect(readIdempotencyKey({ "idempotency-key": "a_b-c123" })).toBe(
      "a_b-c123",
    );
  });

  it("отдаёт undefined, когда заголовка нет (AC-1)", () => {
    expect(readIdempotencyKey({})).toBeUndefined();
  });

  it("отказывает короткому ключу с 422 и именем заголовка (AC-4)", () => {
    const run = () => readIdempotencyKey({ "idempotency-key": "abc" });

    expect(run).toThrow(AppError);
    expect(run).toThrow(
      expect.objectContaining({
        status: 422,
        code: "VALIDATION",
        details: {
          errors: [
            expect.objectContaining({ property: "Idempotency-Key" }),
          ],
        },
      }) as never,
    );
  });

  it("отказывает ключу длиннее 128 символов (AC-4)", () => {
    expect(() => readIdempotencyKey({ "idempotency-key": "a".repeat(129) })).toThrow(
      AppError,
    );
    expect(readIdempotencyKey({ "idempotency-key": "a".repeat(128) })).toHaveLength(
      128,
    );
  });

  it("отказывает символу вне алфавита ключа (AC-4)", () => {
    expect(() => readIdempotencyKey({ "idempotency-key": "key with space" })).toThrow(
      AppError,
    );
    expect(() => readIdempotencyKey({ "idempotency-key": "key+plus123" })).toThrow(
      AppError,
    );
  });
});

describe("canonicalOrderBody", () => {
  const lines = [
    { productId: "p-2", quantity: 1 },
    { productId: "p-1", quantity: 2 },
  ];

  it("не зависит от порядка строк в теле (AC-2)", () => {
    expect(canonicalOrderBody(dtoFor(), lines)).toBe(
      canonicalOrderBody(dtoFor(), [...lines].reverse()),
    );
  });

  it("считает смещение и Z одной и той же датой (AC-3)", () => {
    const utc = canonicalOrderBody(
      dtoFor({ deliveryDate: "2026-11-10T12:00:00.000Z" as never }),
      lines,
    );
    const offset = canonicalOrderBody(
      dtoFor({ deliveryDate: "2026-11-10T15:00:00.000+03:00" as never }),
      lines,
    );

    expect(offset).toBe(utc);
  });

  it("различает тела по адресу доставки (AC-3)", () => {
    expect(canonicalOrderBody(dtoFor(), lines)).not.toBe(
      canonicalOrderBody(dtoFor({ deliveryAddress: "Lenina 2" }), lines),
    );
  });

  it("даёт sha256 из 64 шестнадцатеричных знаков (AC-1)", () => {
    expect(hashOrderBody(canonicalOrderBody(dtoFor(), lines))).toMatch(
      /^[0-9a-f]{64}$/,
    );
  });
});
