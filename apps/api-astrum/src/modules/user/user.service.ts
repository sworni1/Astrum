import { hash, verify } from "argon2";
import { StatusCodes } from "http-status-codes";
import { Prisma, type User } from "../../../generated/prisma/client";
import { UserStatus } from "../../../generated/prisma/enums";
import { prisma } from "../../../lib/prisma";
import { AppError } from "../../common/helpers/appError";
import { publishConfirmationRequested } from "../../events/publisher";
import { revokeSession } from "../../session/revokeSession";
import { getSessionStore, type SessionStore } from "../../session/sessionStore";
import type {
  UpdateUserDto,
  updateUserPasswordDto,
} from "./dto/update-user.dto";

export class UserService {
  constructor(private readonly sessions: SessionStore = getSessionStore()) {}

  async userInfo(userId: User["id"]) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        nickName: true,
        email: true,
        dateOfBirth: true,
        gender: true,
        status: true,
      },
    });

    if (!user) {
      throw new Error("User not found");
    }

    return user;
  }

  async updateUser(userId: User["id"], dto: UpdateUserDto) {
    const user = await prisma.user.findUnique({
      where: {
        id: userId,
      },
    });

    if (!user) {
      throw new Error("User not found");
    }

    const wantsNickName = dto.nickName !== undefined;
    const wantsEmail = dto.email !== undefined;

    if (user.status !== UserStatus.ACTIVE && wantsNickName) {
      throw new AppError(
        StatusCodes.FORBIDDEN,
        "EMAIL_NOT_CONFIRMED",
        "Confirm the email address to change other profile fields",
      );
    }

    if (wantsEmail && dto.email === user.email) {
      throw new AppError(
        StatusCodes.BAD_REQUEST,
        "EMAIL_UNCHANGED",
        "The address is already on your account",
      );
    }

    let updatedUser: User;

    try {
      updatedUser = await prisma.$transaction(async (tx) => {
        const updated = await tx.user.update({
          where: { id: userId },
          data: {
            ...(wantsNickName ? { nickName: dto.nickName } : {}),
            ...(wantsEmail
              ? { email: dto.email, status: UserStatus.PENDING }
              : {}),
          },
        });

        if (wantsEmail) {
          await tx.emailToken.updateMany({
            where: { userId, usedAt: null },
            data: { usedAt: new Date() },
          });
        }

        return updated;
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        throw new AppError(
          StatusCodes.CONFLICT,
          "EMAIL_TAKEN",
          "The address belongs to another account",
        );
      }

      throw error;
    }

    if (wantsEmail) {
      await publishConfirmationRequested({
        userId: updatedUser.id,
        email: updatedUser.email,
      });
    }

    return this.userInfo(updatedUser.id);
  }

  async updateUserPassword(
    userId: User["id"],
    sid: string | undefined,
    dto: updateUserPasswordDto,
  ) {
    const user = await prisma.user.findUnique({
      where: {
        id: userId,
      },
    });

    if (!user) {
      throw new Error("User not found");
    }

    const pwMatches = await verify(user.passwordhash, dto.oldPassword);

    if (!pwMatches) {
      throw new Error("The old password is incorrect");
    }

    const newHashedPassword = await hash(dto.newPassword);

    await revokeSession(this.sessions, sid);

    const updatedUser = await prisma.user.update({
      where: {
        id: userId,
      },
      data: {
        passwordhash: newHashedPassword,
      },
    });

    return this.userInfo(updatedUser.id);
  }

  async deleteUser(userId: User["id"], sid: string | undefined) {
    await revokeSession(this.sessions, sid);

    try {
      await prisma.user.delete({
        where: {
          id: userId,
        },
      });
    } catch (error) {
      throw new Error(`User not found`);
    }
  }
}
