import {
  Controller,
  Get,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { MenuService } from './menu.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { TenantGuard } from '../common/guards/tenant.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Public } from '../auth/decorators/public.decorator';
import { CurrentTenant } from '../common/decorators/tenant.decorator';
import { UserRole } from '../common/types/user.types';

@Controller('menu')
export class MenuController {
  constructor(private readonly menuService: MenuService) {}

  @Get()
  @UseGuards(TenantGuard)
  getFullMenu(
    @CurrentTenant() tenant: any,
    @Query('include_unavailable') includeUnavailable?: string,
  ) {
    const includeUnavailableFlag = includeUnavailable === 'true';
    return this.menuService.getFullMenu(tenant.id, includeUnavailableFlag);
  }

  @Public()
  @Get('public/:tenantSlug')
  getPublicMenu(@Param('tenantSlug') tenantSlug: string) {
    return this.menuService.getPublicMenu(tenantSlug);
  }

  @Get('search')
  @UseGuards(TenantGuard)
  searchMenu(
    @CurrentTenant() tenant: any,
    @Query('q') query: string,
  ) {
    return this.menuService.searchInMenu(tenant.id, query);
  }

  @Get('stats')
  @UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  getMenuStats(@CurrentTenant() tenant: any) {
    return this.menuService.getMenuStats(tenant.id);
  }

  @Get('export')
  @UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  exportMenu(@CurrentTenant() tenant: any) {
    return this.menuService.exportMenu(tenant.id);
  }
}












