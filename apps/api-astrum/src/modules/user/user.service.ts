import { User } from '../../../generated/prisma/client';
import { prisma } from '../../../lib/prisma';
import { UpdateUserDto, updateUserPasswordDto } from './dto/update-user.dto';
import { hash, verify } from 'argon2';

export class UserService {
  async userInfo(userId: User['id']) {
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
      throw new Error('User not found');
    }

    return user;
  }

  async updateUser(userId: User['id'], dto: UpdateUserDto) {
    const user = await prisma.user.findUnique({
      where: {
        id: userId,
      },
    });

    if (!user) {
      throw new Error('User not found');
    }

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: { ...dto },
    });

    if (!updatedUser) {
      throw new Error('Email is occupied by another user');
    }

    return this.userInfo(updatedUser.id);
  }

  async updateUserPassword(userId: User['id'], dto: updateUserPasswordDto) {
    const user = await prisma.user.findUnique({
      where: {
        id: userId,
      },
    });

    if (!user) {
      throw new Error('User not found');
    }

    const pwMatches = await verify(user.passwordhash, dto.oldPassword);

    if (!pwMatches) {
      throw new Error('The old password is incorrect');
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

    return this.userInfo(updatedUser.id);
  }

  async deleteUser(userId: User['id']) {
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
