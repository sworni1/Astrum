import type { User } from "@astrum/db/client";
import { UserStatus } from "@astrum/db/enums";
import { hash, verify } from "argon2";
import { prisma } from "../../../lib/prisma";
import { isUniqueViolation } from "../../common/helpers/prismaErrors";
import { staffRolesOf } from "../../common/helpers/staffRoles";
import { DEFAULT_LETTER_LOCALE, type LetterLocale } from "../../events/locale";
import { publishConfirmationRequested } from "../../events/publisher";
import { revokeSession } from "../../session/revokeSession";
import { getSessionStore, type SessionStore } from "../../session/sessionStore";
import { USER_PROFILE_SELECT } from "./constants/user.constants";
import type {
  UpdateUserDto,
  updateUserPasswordDto,
} from "./dto/update-user.dto";
import {
  emailNotConfirmed,
  emailTaken,
  emailUnchanged,
  userNotFound,
} from "./helpers/user.errors";

export class UserService {
  constructor(private readonly sessions: SessionStore = getSessionStore()) {}

  async userInfo(userId: User["id"]) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: USER_PROFILE_SELECT,
    });

    if (!user) {
      throw userNotFound();
    }

    const { business, pointWorker, courier, ...profile } = user;

    return {
      ...profile,
      isSeller: business !== null,
      staffRoles: staffRolesOf({ pointWorker, courier }),
    };
  }

  async updateUser(
    userId: User["id"],
    dto: UpdateUserDto,
    locale: LetterLocale = DEFAULT_LETTER_LOCALE,
  ) {
    const user = await prisma.user.findUnique({
      where: {
        id: userId,
      },
    });

    if (!user) {
      throw userNotFound();
    }

    const wantsNickName = dto.nickName !== undefined;
    const wantsEmail = dto.email !== undefined;

    if (user.status !== UserStatus.ACTIVE && wantsNickName) {
      throw emailNotConfirmed();
    }

    if (wantsEmail && dto.email === user.email) {
      throw emailUnchanged();
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
      if (isUniqueViolation(error)) {
        throw emailTaken();
      }

      throw error;
    }

    if (wantsEmail) {
      await publishConfirmationRequested({
        userId: updatedUser.id,
        email: updatedUser.email,
        locale,
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
      throw userNotFound();
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
    } catch {
      throw userNotFound();
    }
  }
}
