import type { Response } from "express";
import { StatusCodes, ReasonPhrases } from "http-status-codes";

import { handleErrors } from "../common/helpers/errorHandler";

const createMockResponse = (): jest.Mocked<Response> => {
  const res = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
  } as unknown as jest.Mocked<Response>;
  return res;
};

describe("handleErrors", () => {
  it("возвращает 400 + message, когда err — экземпляр Error", () => {
    const res = createMockResponse();
    const err = new Error("bad input");

    handleErrors(res, err);

    expect(res.status).toHaveBeenCalledWith(StatusCodes.BAD_REQUEST);
    expect(res.json).toHaveBeenCalledWith({ message: "bad input" });
  });

  it("возвращает 500 + INTERNAL_SERVER_ERROR, когда err — не Error", () => {
    const res = createMockResponse();
    const err = "string-not-error";

    handleErrors(res, err);

    expect(res.status).toHaveBeenCalledWith(StatusCodes.INTERNAL_SERVER_ERROR);
    expect(res.json).toHaveBeenCalledWith({
      message: ReasonPhrases.INTERNAL_SERVER_ERROR,
    });
  });
});
