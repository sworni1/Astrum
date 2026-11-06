import { type ClassConstructor, plainToInstance } from "class-transformer";
import { type ValidationError, validate } from "class-validator";
import type { NextFunction, Request, Response } from "express";
import { ReasonPhrases, StatusCodes } from "http-status-codes";

type ValidateDtoOptions = {
  /** HTTP status for an invalid body. Defaults to 400. */
  status?: number;
  /** Machine readable code added to the invalid body response. */
  code?: string;
};

export const validateDto = <T extends object>(
  dtoClass: ClassConstructor<T>,
  options: ValidateDtoOptions = {},
) => {
  const status = options.status ?? StatusCodes.BAD_REQUEST;

  return async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    const dtoInstance = plainToInstance(dtoClass, req.body, {
      excludeExtraneousValues: true,
    });
    const errors: ValidationError[] = await validate(dtoInstance);

    if (errors.length > 0) {
      const formattedErrors = errors.map((error) => ({
        property: error.property,
        constraints: error.constraints,
      }));

      const payload = options.code
        ? {
            code: options.code,
            message: ReasonPhrases.UNPROCESSABLE_ENTITY,
            errors: formattedErrors,
          }
        : { errors: formattedErrors };

      res.status(status).json(payload);
    } else {
      req.body = dtoInstance;

      next();
    }
  };
};
