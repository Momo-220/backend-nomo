import { Injectable, NotFoundException, ConflictException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UserRole } from '../common/types/user.types';
import * as bcrypt from 'bcryptjs';

export interface CreateUserDto {
  tenant_id: string;
  email: string;
  password: string;
  first_name: string;
  last_name: string;
  role: UserRole;
}

export interface UpdateUserDto {
  email?: string;
  first_name?: string;
  last_name?: string;
  role?: UserRole;
  is_active?: boolean;
}

export interface ChangePasswordDto {
  current_password: string;
  new_password: string;
}

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  async create(createUserDto: CreateUserDto, creatorTenantId: string) {
    // Vérifier que le créateur appartient au même tenant
    if (createUserDto.tenant_id !== creatorTenantId) {
      throw new ForbiddenException('Vous ne pouvez créer des utilisateurs que dans votre tenant');
    }

    // Vérifier l'unicité de l'email
    const existingUser = await this.prisma.user.findUnique({
      where: { email: createUserDto.email },
    });

    if (existingUser) {
      throw new ConflictException('Un utilisateur avec cet email existe déjà');
    }

    // Hasher le mot de passe
    const saltRounds = 12;
    const hashedPassword = await bcrypt.hash(createUserDto.password, saltRounds);

    return this.prisma.user.create({
      data: {
        ...createUserDto,
        password: hashedPassword,
      },
      select: {
        id: true,
        email: true,
        first_name: true,
        last_name: true,
        role: true,
        tenant_id: true,
        is_active: true,
        created_at: true,
        updated_at: true,
        tenant: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
      },
    });
  }

  async findAllByTenant(tenantId: string) {
    return this.prisma.user.findMany({
      where: { tenant_id: tenantId },
      select: {
        id: true,
        email: true,
        first_name: true,
        last_name: true,
        role: true,
        is_active: true,
        created_at: true,
        updated_at: true,
      },
      orderBy: { created_at: 'desc' },
    });
  }

  async findOne(id: string, tenantId: string) {
    const user = await this.prisma.user.findFirst({
      where: {
        id,
        tenant_id: tenantId,
      },
      select: {
        id: true,
        email: true,
        first_name: true,
        last_name: true,
        role: true,
        is_active: true,
        created_at: true,
        updated_at: true,
        tenant: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
      },
    });

    if (!user) {
      throw new NotFoundException('Utilisateur non trouvé');
    }

    return user;
  }

  async update(id: string, updateUserDto: UpdateUserDto, tenantId: string) {
    // Vérifier que l'utilisateur existe et appartient au tenant
    await this.findOne(id, tenantId);

    // Vérifier l'unicité de l'email si modifié
    if (updateUserDto.email) {
      const existingUser = await this.prisma.user.findFirst({
        where: {
          email: updateUserDto.email,
          id: { not: id },
        },
      });

      if (existingUser) {
        throw new ConflictException('Un utilisateur avec cet email existe déjà');
      }
    }

    return this.prisma.user.update({
      where: { id },
      data: updateUserDto,
      select: {
        id: true,
        email: true,
        first_name: true,
        last_name: true,
        role: true,
        is_active: true,
        created_at: true,
        updated_at: true,
      },
    });
  }

  async remove(id: string, tenantId: string) {
    // Vérifier que l'utilisateur existe et appartient au tenant
    await this.findOne(id, tenantId);

    // Soft delete - désactiver l'utilisateur
    return this.prisma.user.update({
      where: { id },
      data: { is_active: false },
      select: {
        id: true,
        email: true,
        first_name: true,
        last_name: true,
        is_active: true,
      },
    });
  }

  async changePassword(userId: string, changePasswordDto: ChangePasswordDto, tenantId: string) {
    // Récupérer l'utilisateur avec le mot de passe
    const user = await this.prisma.user.findFirst({
      where: {
        id: userId,
        tenant_id: tenantId,
      },
    });

    if (!user) {
      throw new NotFoundException('Utilisateur non trouvé');
    }

    // Vérifier le mot de passe actuel
    const isCurrentPasswordValid = await bcrypt.compare(
      changePasswordDto.current_password,
      user.password
    );

    if (!isCurrentPasswordValid) {
      throw new ForbiddenException('Mot de passe actuel incorrect');
    }

    // Hasher le nouveau mot de passe
    const saltRounds = 12;
    const hashedNewPassword = await bcrypt.hash(changePasswordDto.new_password, saltRounds);

    // Mettre à jour le mot de passe
    await this.prisma.user.update({
      where: { id: userId },
      data: { password: hashedNewPassword },
    });

    // Log de l'événement
    await this.prisma.event.create({
      data: {
        tenant_id: tenantId,
        user_id: userId,
        event_type: 'SYSTEM_EVENT',
        description: 'Mot de passe modifié',
        metadata: {
          action: 'password_change',
        },
      },
    });

    return { message: 'Mot de passe modifié avec succès' };
  }

  async getUserStats(tenantId: string) {
    const [totalUsers, activeUsers, usersByRole] = await Promise.all([
      this.prisma.user.count({ where: { tenant_id: tenantId } }),
      this.prisma.user.count({ where: { tenant_id: tenantId, is_active: true } }),
      this.prisma.user.groupBy({
        by: ['role'],
        where: { tenant_id: tenantId, is_active: true },
        _count: { role: true },
      }),
    ]);

    return {
      totalUsers,
      activeUsers,
      inactiveUsers: totalUsers - activeUsers,
      usersByRole: usersByRole.reduce((acc, item) => {
        acc[item.role] = item._count.role;
        return acc;
      }, {} as Record<string, number>),
    };
  }
}
