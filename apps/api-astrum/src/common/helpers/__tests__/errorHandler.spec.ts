import type { Response } from "express";
import { ReasonPhrases, StatusCodes } from "http-status-codes";

import { AppError } from "../appError";
import { handleErrors } from "../errorHandler";

const createMockResponse = (): jest.Mocked<Response> => {
  const res = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
  } as unknown as jest.Mocked<Response>;
  return res;
};

describe("handleErrors", () => {
  beforeEach(() => {
    jest.spyOn(console, "error").mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("отдаёт статус, код и детали из AppError", () => {
    const res = createMockResponse();
    const err = new AppError(409, "OUT_OF_STOCK", "Only 2 left", {
      items: [{ productId: "p-1", requested: 3, available: 2 }],
    });

    handleErrors(res, err);

    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith({
      code: "OUT_OF_STOCK",
      message: "Only 2 left",
      items: [{ productId: "p-1", requested: 3, available: 2 }],
    });
  });

  it("отдаёт 500 для обычного Error, чтобы сбой базы не читался как ошибка клиента", () => {
    const res = createMockResponse();

    handleErrors(res, new Error("connection lost"));

    expect(res.status).toHaveBeenCalledWith(StatusCodes.INTERNAL_SERVER_ERROR);
    expect(res.json).toHaveBeenCalledWith({
      message: ReasonPhrases.INTERNAL_SERVER_ERROR,
    });
  });

  it("отдаёт 500, когда бросили не Error", () => {
    const res = createMockResponse();

    handleErrors(res, "string-not-error");

    expect(res.status).toHaveBeenCalledWith(StatusCodes.INTERNAL_SERVER_ERROR);
    expect(res.json).toHaveBeenCalledWith({
      message: ReasonPhrases.INTERNAL_SERVER_ERROR,
    });
  });
});
