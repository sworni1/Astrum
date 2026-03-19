import { Router } from "express";
import { UserController } from "./user.controller";
import { validateDto } from "../../middlewares/validateDto";
import { UpdateUserDto, updateUserPasswordDto } from "./dto/update-user.dto";

const userController = new UserController();

const userRoutes = Router();

userRoutes.get("/me", userController.userInfo);
userRoutes.delete("/me", userController.deleteUser);
userRoutes.patch("/me", validateDto(UpdateUserDto), userController.updateUser);
userRoutes.patch(
  "/me/password",
  validateDto(updateUserPasswordDto),
  userController.updateUserPassword
);

export default userRoutes;
