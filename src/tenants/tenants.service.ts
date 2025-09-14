import { Injectable, ConflictException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateTenantDto } from './dto/create-tenant.dto';
import { UpdateTenantDto } from './dto/update-tenant.dto';

@Injectable()
export class TenantsService {
  constructor(private prisma: PrismaService) {}

  async create(createTenantDto: CreateTenantDto) {
    // Vérifier l'unicité du slug et de l'email
    const existingTenant = await this.prisma.tenant.findFirst({
      where: {
        OR: [
          { slug: createTenantDto.slug },
          { email: createTenantDto.email },
        ],
      },
    });

    if (existingTenant) {
      if (existingTenant.slug === createTenantDto.slug) {
        throw new ConflictException('Ce slug est déjà utilisé');
      }
      if (existingTenant.email === createTenantDto.email) {
        throw new ConflictException('Cet email est déjà utilisé');
      }
    }

    return this.prisma.tenant.create({
      data: createTenantDto,
      select: {
        id: true,
        name: true,
        slug: true,
        email: true,
        phone: true,
        address: true,
        description: true,
        website: true,
        logo_url: true,
        banner_url: true,
        payment_info: true,
        is_active: true,
        created_at: true,
        updated_at: true,
      },
    });
  }

  async findAll() {
    return this.prisma.tenant.findMany({
      where: { is_active: true },
      select: {
        id: true,
        name: true,
        slug: true,
        email: true,
        phone: true,
        address: true,
        description: true,
        website: true,
        logo_url: true,
        banner_url: true,
        payment_info: true,
        is_active: true,
        created_at: true,
        updated_at: true,
      },
      orderBy: { created_at: 'desc' },
    });
  }

  async findOne(id: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        slug: true,
        email: true,
        phone: true,
        address: true,
        description: true,
        website: true,
        logo_url: true,
        banner_url: true,
        payment_info: true,
        is_active: true,
        created_at: true,
        updated_at: true,
      },
    });

    if (!tenant) {
      throw new NotFoundException('Tenant non trouvé');
    }

    return tenant;
  }

  async findBySlug(slug: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { slug },
      select: {
        id: true,
        name: true,
        slug: true,
        email: true,
        phone: true,
        address: true,
        description: true,
        website: true,
        logo_url: true,
        banner_url: true,
        payment_info: true,
        is_active: true,
        created_at: true,
        updated_at: true,
      },
    });

    if (!tenant) {
      throw new NotFoundException('Restaurant non trouvé');
    }

    if (!tenant.is_active) {
      throw new NotFoundException('Restaurant non disponible');
    }

    return tenant;
  }

  async update(id: string, updateTenantDto: UpdateTenantDto) {
    // Vérifier que le tenant existe
    await this.findOne(id);

    // Vérifier l'unicité du slug et de l'email si ils sont modifiés
    if (updateTenantDto.slug || updateTenantDto.email) {
      const conditions = [];
      if (updateTenantDto.slug) conditions.push({ slug: updateTenantDto.slug });
      if (updateTenantDto.email) conditions.push({ email: updateTenantDto.email });

      const existingTenant = await this.prisma.tenant.findFirst({
        where: {
          AND: [
            { id: { not: id } },
            { OR: conditions },
          ],
        },
      });

      if (existingTenant) {
        if (existingTenant.slug === updateTenantDto.slug) {
          throw new ConflictException('Ce slug est déjà utilisé');
        }
        if (existingTenant.email === updateTenantDto.email) {
          throw new ConflictException('Cet email est déjà utilisé');
        }
      }
    }

    return this.prisma.tenant.update({
      where: { id },
      data: updateTenantDto,
      select: {
        id: true,
        name: true,
        slug: true,
        email: true,
        phone: true,
        address: true,
        logo_url: true,
        is_active: true,
        created_at: true,
        updated_at: true,
      },
    });
  }

  async remove(id: string) {
    // Vérifier que le tenant existe
    await this.findOne(id);

    // Soft delete - désactiver le tenant au lieu de le supprimer
    return this.prisma.tenant.update({
      where: { id },
      data: { is_active: false },
      select: {
        id: true,
        name: true,
        slug: true,
        is_active: true,
      },
    });
  }

  // Méthodes utilitaires
  async getTenantStats(tenantId: string) {
    const [
      totalOrders,
      totalRevenue,
      totalItems,
      totalTables,
      activeOrders,
    ] = await Promise.all([
      this.prisma.order.count({ where: { tenant_id: tenantId } }),
      this.prisma.order.aggregate({
        where: { tenant_id: tenantId, status: 'DELIVERED' },
        _sum: { total_amount: true },
      }),
      this.prisma.item.count({ where: { tenant_id: tenantId, is_available: true } }),
      this.prisma.table.count({ where: { tenant_id: tenantId, is_active: true } }),
      this.prisma.order.count({
        where: {
          tenant_id: tenantId,
          status: { in: ['PENDING', 'ACCEPTED', 'PREPARING', 'READY'] },
        },
      }),
    ]);

    return {
      totalOrders,
      totalRevenue: totalRevenue._sum.total_amount || 0,
      totalItems,
      totalTables,
      activeOrders,
    };
  }
}












