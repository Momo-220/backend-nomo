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
import { ItemsService } from './items.service';
import { CreateItemDto } from './dto/create-item.dto';
import { UpdateItemDto } from './dto/update-item.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { Public } from '../../auth/decorators/public.decorator';
import { CurrentTenant } from '../../common/decorators/tenant.decorator';
import { UserRole } from '../../common/types/user.types';

@Controller('menu/items')
export class ItemsController {
  constructor(private readonly itemsService: ItemsService) {}

  @Post()
  @UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  create(@Body() createItemDto: CreateItemDto, @CurrentTenant() tenant: any) {
    return this.itemsService.create(createItemDto, tenant.id);
  }

  @Get()
  @UseGuards(TenantGuard)
  findAll(
    @CurrentTenant() tenant: any,
    @Query('include_unavailable') includeUnavailable?: string,
    @Query('category_id') categoryId?: string,
  ) {
    const includeUnavailableFlag = includeUnavailable === 'true';
    
    if (categoryId) {
      return this.itemsService.findAllByCategory(categoryId, tenant.id, includeUnavailableFlag);
    }
    
    return this.itemsService.findAllByTenant(tenant.id, includeUnavailableFlag);
  }

  @Get('search')
  @UseGuards(TenantGuard)
  search(
    @CurrentTenant() tenant: any,
    @Query('q') query: string,
  ) {
    if (!query || query.trim().length < 2) {
      return [];
    }
    return this.itemsService.searchItems(tenant.id, query.trim());
  }

  @Get('stats')
  @UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  getStats(@CurrentTenant() tenant: any) {
    return this.itemsService.getItemStats(tenant.id);
  }

  @Get(':id')
  @UseGuards(TenantGuard)
  findOne(@Param('id') id: string, @CurrentTenant() tenant: any) {
    return this.itemsService.findOne(id, tenant.id);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  update(
    @Param('id') id: string,
    @Body() updateItemDto: UpdateItemDto,
    @CurrentTenant() tenant: any,
  ) {
    return this.itemsService.update(id, updateItemDto, tenant.id);
  }

  @Patch(':id/toggle-stock')
  @UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.STAFF)
  toggleStock(@Param('id') id: string, @CurrentTenant() tenant: any) {
    return this.itemsService.toggleStock(id, tenant.id);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  remove(@Param('id') id: string, @CurrentTenant() tenant: any) {
    return this.itemsService.remove(id, tenant.id);
  }

  @Patch('category/:categoryId/reorder')
  @UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  reorder(
    @Param('categoryId') categoryId: string,
    @Body() itemOrders: { id: string; sort_order: number }[],
    @CurrentTenant() tenant: any,
  ) {
    return this.itemsService.reorderItems(categoryId, tenant.id, itemOrders);
  }
}












