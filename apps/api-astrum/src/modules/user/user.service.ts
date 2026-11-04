import { hash, verify } from "argon2";
import type { User } from "../../../generated/prisma/client";
import { prisma } from "../../../lib/prisma";
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

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: { ...dto },
    });

    if (!updatedUser) {
      throw new Error("Email is occupied by another user");
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
