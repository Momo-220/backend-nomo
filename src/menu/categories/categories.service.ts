import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';

@Injectable()
export class CategoriesService {
  constructor(private prisma: PrismaService) {}

  async create(createCategoryDto: CreateCategoryDto, tenantId: string) {
    // Vérifier l'unicité du nom dans le tenant
    const existingCategory = await this.prisma.category.findFirst({
      where: {
        tenant_id: tenantId,
        name: createCategoryDto.name,
      },
    });

    if (existingCategory) {
      throw new ConflictException('Une catégorie avec ce nom existe déjà');
    }

    return this.prisma.category.create({
      data: {
        ...createCategoryDto,
        tenant_id: tenantId,
      },
      select: {
        id: true,
        name: true,
        description: true,
        image_url: true,
        sort_order: true,
        is_active: true,
        created_at: true,
        updated_at: true,
      },
    });
  }

  async findAllByTenant(tenantId: string, includeInactive = false) {
    const whereCondition: any = { tenant_id: tenantId };
    
    if (!includeInactive) {
      whereCondition.is_active = true;
    }

    return this.prisma.category.findMany({
      where: whereCondition,
      select: {
        id: true,
        name: true,
        description: true,
        image_url: true,
        sort_order: true,
        is_active: true,
        created_at: true,
        updated_at: true,
        _count: {
          select: {
            items: {
              where: { is_available: true },
            },
          },
        },
      },
      orderBy: [
        { sort_order: 'asc' },
        { created_at: 'asc' },
      ],
    });
  }

  async findOne(id: string, tenantId: string) {
    const category = await this.prisma.category.findFirst({
      where: {
        id,
        tenant_id: tenantId,
      },
      select: {
        id: true,
        name: true,
        description: true,
        image_url: true,
        sort_order: true,
        is_active: true,
        created_at: true,
        updated_at: true,
        items: {
          where: { is_available: true },
          select: {
            id: true,
            name: true,
            description: true,
            price: true,
            image_url: true,
            out_of_stock: true,
            sort_order: true,
          },
          orderBy: [
            { sort_order: 'asc' },
            { created_at: 'asc' },
          ],
        },
      },
    });

    if (!category) {
      throw new NotFoundException('Catégorie non trouvée');
    }

    return category;
  }

  async update(id: string, updateCategoryDto: UpdateCategoryDto, tenantId: string) {
    // Vérifier que la catégorie existe et appartient au tenant
    await this.findOne(id, tenantId);

    // Vérifier l'unicité du nom si modifié
    if (updateCategoryDto.name) {
      const existingCategory = await this.prisma.category.findFirst({
        where: {
          tenant_id: tenantId,
          name: updateCategoryDto.name,
          id: { not: id },
        },
      });

      if (existingCategory) {
        throw new ConflictException('Une catégorie avec ce nom existe déjà');
      }
    }

    return this.prisma.category.update({
      where: { id },
      data: updateCategoryDto,
      select: {
        id: true,
        name: true,
        description: true,
        image_url: true,
        sort_order: true,
        is_active: true,
        created_at: true,
        updated_at: true,
      },
    });
  }

  async remove(id: string, tenantId: string) {
    // Vérifier que la catégorie existe et appartient au tenant
    await this.findOne(id, tenantId);

    // Vérifier s'il y a des items dans cette catégorie
    const itemsCount = await this.prisma.item.count({
      where: {
        category_id: id,
        is_available: true,
      },
    });

    if (itemsCount > 0) {
      // Soft delete - désactiver la catégorie au lieu de la supprimer
      return this.prisma.category.update({
        where: { id },
        data: { is_active: false },
        select: {
          id: true,
          name: true,
          is_active: true,
        },
      });
    } else {
      // Hard delete si aucun item
      return this.prisma.category.delete({
        where: { id },
        select: {
          id: true,
          name: true,
        },
      });
    }
  }

  async reorderCategories(tenantId: string, categoryOrders: { id: string; sort_order: number }[]) {
    const updatePromises = categoryOrders.map(({ id, sort_order }) =>
      this.prisma.category.updateMany({
        where: {
          id,
          tenant_id: tenantId,
        },
        data: { sort_order },
      })
    );

    await Promise.all(updatePromises);

    return { message: 'Ordre des catégories mis à jour avec succès' };
  }

  async getCategoryStats(tenantId: string) {
    const [
      totalCategories,
      activeCategories,
      totalItems,
      availableItems,
    ] = await Promise.all([
      this.prisma.category.count({ where: { tenant_id: tenantId } }),
      this.prisma.category.count({ where: { tenant_id: tenantId, is_active: true } }),
      this.prisma.item.count({ where: { tenant_id: tenantId } }),
      this.prisma.item.count({ 
        where: { 
          tenant_id: tenantId, 
          is_available: true, 
          out_of_stock: false 
        } 
      }),
    ]);

    return {
      totalCategories,
      activeCategories,
      inactiveCategories: totalCategories - activeCategories,
      totalItems,
      availableItems,
      outOfStockItems: totalItems - availableItems,
    };
  }
}












