import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Query,
} from '@nestjs/common';
import { CategoriesService } from './categories.service';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { Public } from '../../auth/decorators/public.decorator';
import { CurrentTenant } from '../../common/decorators/tenant.decorator';
import { UserRole } from '../../common/types/user.types';

@Controller('menu/categories')
export class CategoriesController {
  constructor(private readonly categoriesService: CategoriesService) {}

  @Post()
  @UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  create(
    @Body() createCategoryDto: CreateCategoryDto,
    @CurrentTenant() tenant: any,
  ) {
    return this.categoriesService.create(createCategoryDto, tenant.id);
  }

  @Get()
  @UseGuards(TenantGuard)
  findAll(
    @CurrentTenant() tenant: any,
    @Query('include_inactive') includeInactive?: string,
  ) {
    const includeInactiveFlag = includeInactive === 'true';
    return this.categoriesService.findAllByTenant(tenant.id, includeInactiveFlag);
  }

  @Public()
  @Get('public/:tenantSlug')
  async findAllPublic(@Param('tenantSlug') tenantSlug: string) {
    // Pour les endpoints publics, nous devrons d'abord récupérer le tenant par slug
    // puis retourner les catégories actives seulement
    return this.categoriesService.findAllByTenant(tenantSlug, false);
  }

  @Get('stats')
  @UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  getStats(@CurrentTenant() tenant: any) {
    return this.categoriesService.getCategoryStats(tenant.id);
  }

  @Get(':id')
  @UseGuards(TenantGuard)
  findOne(@Param('id') id: string, @CurrentTenant() tenant: any) {
    return this.categoriesService.findOne(id, tenant.id);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  update(
    @Param('id') id: string,
    @Body() updateCategoryDto: UpdateCategoryDto,
    @CurrentTenant() tenant: any,
  ) {
    return this.categoriesService.update(id, updateCategoryDto, tenant.id);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  remove(@Param('id') id: string, @CurrentTenant() tenant: any) {
    return this.categoriesService.remove(id, tenant.id);
  }

  @Patch('reorder')
  @UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  reorder(
    @Body() categoryOrders: { id: string; sort_order: number }[],
    @CurrentTenant() tenant: any,
  ) {
    return this.categoriesService.reorderCategories(tenant.id, categoryOrders);
  }
}












