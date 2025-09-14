import { Injectable, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateItemDto } from './dto/create-item.dto';
import { UpdateItemDto } from './dto/update-item.dto';

@Injectable()
export class ItemsService {
  constructor(private prisma: PrismaService) {}

  async create(createItemDto: CreateItemDto, tenantId: string) {
    // Vérifier que la catégorie existe et appartient au tenant
    const category = await this.prisma.category.findFirst({
      where: {
        id: createItemDto.category_id,
        tenant_id: tenantId,
        is_active: true,
      },
    });

    if (!category) {
      throw new BadRequestException('Catégorie non trouvée ou inactive');
    }

    // Vérifier l'unicité du nom dans le tenant
    const existingItem = await this.prisma.item.findFirst({
      where: {
        tenant_id: tenantId,
        name: createItemDto.name,
      },
    });

    if (existingItem) {
      throw new ConflictException('Un item avec ce nom existe déjà');
    }

    return this.prisma.item.create({
      data: {
        ...createItemDto,
        tenant_id: tenantId,
      },
      select: {
        id: true,
        name: true,
        description: true,
        price: true,
        image_url: true,
        is_available: true,
        out_of_stock: true,
        sort_order: true,
        created_at: true,
        updated_at: true,
        category: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });
  }

  async findAllByTenant(tenantId: string, includeUnavailable = false) {
    const whereCondition: any = { tenant_id: tenantId };
    
    if (!includeUnavailable) {
      whereCondition.is_available = true;
    }

    return this.prisma.item.findMany({
      where: whereCondition,
      select: {
        id: true,
        name: true,
        description: true,
        price: true,
        image_url: true,
        is_available: true,
        out_of_stock: true,
        sort_order: true,
        created_at: true,
        updated_at: true,
        category: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: [
        { sort_order: 'asc' },
        { created_at: 'asc' },
      ],
    });
  }

  async findAllByCategory(categoryId: string, tenantId: string, includeUnavailable = false) {
    const whereCondition: any = { 
      category_id: categoryId,
      tenant_id: tenantId,
    };
    
    if (!includeUnavailable) {
      whereCondition.is_available = true;
    }

    return this.prisma.item.findMany({
      where: whereCondition,
      select: {
        id: true,
        name: true,
        description: true,
        price: true,
        image_url: true,
        is_available: true,
        out_of_stock: true,
        sort_order: true,
        created_at: true,
        updated_at: true,
      },
      orderBy: [
        { sort_order: 'asc' },
        { created_at: 'asc' },
      ],
    });
  }

  async findOne(id: string, tenantId: string) {
    const item = await this.prisma.item.findFirst({
      where: {
        id,
        tenant_id: tenantId,
      },
      select: {
        id: true,
        name: true,
        description: true,
        price: true,
        image_url: true,
        is_available: true,
        out_of_stock: true,
        sort_order: true,
        created_at: true,
        updated_at: true,
        category: {
          select: {
            id: true,
            name: true,
            description: true,
          },
        },
      },
    });

    if (!item) {
      throw new NotFoundException('Item non trouvé');
    }

    return item;
  }

  async update(id: string, updateItemDto: UpdateItemDto, tenantId: string) {
    // Vérifier que l'item existe et appartient au tenant
    await this.findOne(id, tenantId);

    // Si on change de catégorie, vérifier qu'elle existe et appartient au tenant
    if (updateItemDto.category_id) {
      const category = await this.prisma.category.findFirst({
        where: {
          id: updateItemDto.category_id,
          tenant_id: tenantId,
          is_active: true,
        },
      });

      if (!category) {
        throw new BadRequestException('Catégorie non trouvée ou inactive');
      }
    }

    // Vérifier l'unicité du nom si modifié
    if (updateItemDto.name) {
      const existingItem = await this.prisma.item.findFirst({
        where: {
          tenant_id: tenantId,
          name: updateItemDto.name,
          id: { not: id },
        },
      });

      if (existingItem) {
        throw new ConflictException('Un item avec ce nom existe déjà');
      }
    }

    return this.prisma.item.update({
      where: { id },
      data: updateItemDto,
      select: {
        id: true,
        name: true,
        description: true,
        price: true,
        image_url: true,
        is_available: true,
        out_of_stock: true,
        sort_order: true,
        created_at: true,
        updated_at: true,
        category: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });
  }

  async remove(id: string, tenantId: string) {
    // Vérifier que l'item existe et appartient au tenant
    await this.findOne(id, tenantId);

    // Soft delete - désactiver l'item
    return this.prisma.item.update({
      where: { id },
      data: { is_available: false },
      select: {
        id: true,
        name: true,
        is_available: true,
      },
    });
  }

  async toggleStock(id: string, tenantId: string) {
    const item = await this.findOne(id, tenantId);

    return this.prisma.item.update({
      where: { id },
      data: { out_of_stock: !item.out_of_stock },
      select: {
        id: true,
        name: true,
        out_of_stock: true,
      },
    });
  }

  async reorderItems(categoryId: string, tenantId: string, itemOrders: { id: string; sort_order: number }[]) {
    // Vérifier que la catégorie appartient au tenant
    const category = await this.prisma.category.findFirst({
      where: {
        id: categoryId,
        tenant_id: tenantId,
      },
    });

    if (!category) {
      throw new BadRequestException('Catégorie non trouvée');
    }

    const updatePromises = itemOrders.map(({ id, sort_order }) =>
      this.prisma.item.updateMany({
        where: {
          id,
          category_id: categoryId,
          tenant_id: tenantId,
        },
        data: { sort_order },
      })
    );

    await Promise.all(updatePromises);

    return { message: 'Ordre des items mis à jour avec succès' };
  }

  async getItemStats(tenantId: string) {
    const [
      totalItems,
      availableItems,
      outOfStockItems,
      unavailableItems,
    ] = await Promise.all([
      this.prisma.item.count({ where: { tenant_id: tenantId } }),
      this.prisma.item.count({ 
        where: { 
          tenant_id: tenantId, 
          is_available: true, 
          out_of_stock: false 
        } 
      }),
      this.prisma.item.count({ 
        where: { 
          tenant_id: tenantId, 
          is_available: true, 
          out_of_stock: true 
        } 
      }),
      this.prisma.item.count({ 
        where: { 
          tenant_id: tenantId, 
          is_available: false 
        } 
      }),
    ]);

    return {
      totalItems,
      availableItems,
      outOfStockItems,
      unavailableItems,
    };
  }

  async searchItems(tenantId: string, query: string) {
    return this.prisma.item.findMany({
      where: {
        tenant_id: tenantId,
        is_available: true,
        OR: [
          { name: { contains: query, mode: 'insensitive' } },
          { description: { contains: query, mode: 'insensitive' } },
        ],
      },
      select: {
        id: true,
        name: true,
        description: true,
        price: true,
        image_url: true,
        out_of_stock: true,
        category: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: { name: 'asc' },
    });
  }
}












