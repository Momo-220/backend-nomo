import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CategoriesService } from './categories/categories.service';
import { ItemsService } from './items/items.service';

@Injectable()
export class MenuService {
  constructor(
    private prisma: PrismaService,
    private categoriesService: CategoriesService,
    private itemsService: ItemsService,
  ) {}

  async getFullMenu(tenantId: string, includeUnavailable = false) {
    const categories = await this.categoriesService.findAllByTenant(tenantId, includeUnavailable);
    
    const categoriesWithItems = await Promise.all(
      categories.map(async (category) => {
        const items = await this.itemsService.findAllByCategory(
          category.id,
          tenantId,
          includeUnavailable
        );
        
        return {
          ...category,
          items,
        };
      })
    );

    return categoriesWithItems;
  }

  async getPublicMenu(tenantSlug: string) {
    // D'abord récupérer le tenant par slug
    const tenant = await this.prisma.tenant.findUnique({
      where: { 
        slug: tenantSlug,
        is_active: true,
      },
      select: {
        id: true,
        name: true,
        slug: true,
        email: true,
        phone: true,
        address: true,
        logo_url: true,
      },
    });

    if (!tenant) {
      throw new Error('Restaurant non trouvé');
    }

    // Récupérer le menu complet (seulement les items disponibles)
    const menu = await this.getFullMenu(tenant.id, false);

    return {
      restaurant: tenant,
      menu: menu.filter(category => category.items.length > 0), // Seulement les catégories avec des items
    };
  }

  async getMenuStats(tenantId: string) {
    const [categoryStats, itemStats] = await Promise.all([
      this.categoriesService.getCategoryStats(tenantId),
      this.itemsService.getItemStats(tenantId),
    ]);

    return {
      categories: categoryStats,
      items: itemStats,
      summary: {
        totalCategories: categoryStats.activeCategories,
        totalItems: itemStats.availableItems,
        outOfStockItems: itemStats.outOfStockItems,
        completionRate: categoryStats.totalCategories > 0 
          ? Math.round((itemStats.availableItems / categoryStats.totalCategories) * 100) / 100
          : 0,
      },
    };
  }

  async searchInMenu(tenantId: string, query: string) {
    if (!query || query.trim().length < 2) {
      return {
        categories: [],
        items: [],
      };
    }

    const [categories, items] = await Promise.all([
      this.prisma.category.findMany({
        where: {
          tenant_id: tenantId,
          is_active: true,
          OR: [
            { name: { contains: query, mode: 'insensitive' } },
            { description: { contains: query, mode: 'insensitive' } },
          ],
        },
        select: {
          id: true,
          name: true,
          description: true,
          image_url: true,
        },
      }),
      this.itemsService.searchItems(tenantId, query),
    ]);

    return {
      categories,
      items,
    };
  }

  async exportMenu(tenantId: string) {
    const fullMenu = await this.getFullMenu(tenantId, true);
    
    return {
      exportDate: new Date().toISOString(),
      tenantId,
      menu: fullMenu,
      stats: await this.getMenuStats(tenantId),
    };
  }
}












