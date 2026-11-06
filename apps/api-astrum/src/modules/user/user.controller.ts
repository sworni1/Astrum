import type { Request, Response } from "express";
import { StatusCodes } from "http-status-codes";
import { handleErrors } from "../../common/helpers/errorHandler";
import type { AuthenticatedRequest } from "../../common/types/jwt.payload";
import { resolveLetterLocale } from "../../events/locale";
import { UserService } from "./user.service";

const userService = new UserService();

export class UserController {
  async userInfo(req: Request, res: Response) {
    try {
      const { userId } = req as AuthenticatedRequest;

      const userData = await userService.userInfo(userId);

      res.status(StatusCodes.OK).json(userData);
    } catch (err) {
      handleErrors(res, err);
    }
  }

  async updateUser(req: Request, res: Response) {
    try {
      const { userId } = req as AuthenticatedRequest;

      const updatedUser = await userService.updateUser(
        userId,
        req.body,
        resolveLetterLocale(req.headers["accept-language"]),
      );

      res.status(StatusCodes.OK).json(updatedUser);
    } catch (err) {
      handleErrors(res, err);
    }
  }

  async updateUserPassword(req: Request, res: Response) {
    try {
      const { userId, sid } = req as AuthenticatedRequest;

      const updatedUser = await userService.updateUserPassword(
        userId,
        sid,
        req.body,
      );

      res.status(StatusCodes.OK).json(updatedUser);
    } catch (err) {
      handleErrors(res, err);
    }
  }

  async deleteUser(req: Request, res: Response) {
    try {
      const { userId, sid } = req as AuthenticatedRequest;

      await userService.deleteUser(userId, sid);

      res.status(StatusCodes.OK).json();
    } catch (err) {
      handleErrors(res, err);
    }
  }
}
