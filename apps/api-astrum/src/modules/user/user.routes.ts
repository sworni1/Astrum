import { Router } from "express";
import { validateDto } from "../../middlewares/validateDto";
import { UpdateUserDto, updateUserPasswordDto } from "./dto/update-user.dto";
import { UserController } from "./user.controller";

const userController = new UserController();

const userRoutes: Router = Router();

userRoutes.get("/me", userController.userInfo);
userRoutes.delete("/me", userController.deleteUser);
userRoutes.patch("/me", validateDto(UpdateUserDto), userController.updateUser);
userRoutes.patch(
  "/me/password",
  validateDto(updateUserPasswordDto),
  userController.updateUserPassword,
);

export default userRoutes;
