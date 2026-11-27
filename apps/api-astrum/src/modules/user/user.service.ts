import type { User } from "@astrum/db/client";
import { UserStatus } from "@astrum/db/enums";
import { hash, verify } from "argon2";
import { prisma } from "../../../lib/prisma";
import {
  hasForeignKeyViolationCode,
  hasNotFoundCode,
  isUniqueViolation,
} from "../../common/helpers/prismaErrors";
import { permissionsOf } from "../../common/helpers/permissions";
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
  deleteRestricted,
  emailNotConfirmed,
  emailTaken,
  emailUnchanged,
  invalidOldPassword,
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

    const { business, pointWorker, courier, roles, ...profile } = user;

    return {
      ...profile,
      isSeller: business !== null,
      staffRoles: staffRolesOf({ pointWorker, courier }),
      roles,
      permissions: permissionsOf(roles),
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
      throw invalidOldPassword();
    }

    const newHashedPassword = await hash(dto.newPassword);

    const updatedUser = await prisma.user.update({
      where: {
        id: userId,
      },
      data: {
        passwordhash: newHashedPassword,
      },
    });

    await revokeSession(this.sessions, sid);

    return this.userInfo(updatedUser.id);
  }

  async deleteUser(userId: User["id"], sid: string | undefined) {
    try {
      await prisma.user.delete({
        where: {
          id: userId,
        },
      });
    } catch (error) {
      if (hasNotFoundCode(error)) {
        throw userNotFound();
      }

      if (hasForeignKeyViolationCode(error)) {
        throw deleteRestricted();
      }

      throw error;
    }

    await revokeSession(this.sessions, sid);
  }
}
