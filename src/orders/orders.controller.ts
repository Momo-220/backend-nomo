import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { OrdersService } from './orders.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { UpdateOrderStatusDto } from './dto/update-order-status.dto';
import { OrderFiltersDto } from './dto/order-filters.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { TenantGuard } from '../common/guards/tenant.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Public } from '../auth/decorators/public.decorator';
import { CurrentUser, CurrentTenant } from '../common/decorators/tenant.decorator';
import { UserRole } from '../common/types/user.types';

@Controller('orders')
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Public()
  @Post('public/:tenantSlug')
  @HttpCode(HttpStatus.CREATED)
  async createPublicOrder(
    @Param('tenantSlug') tenantSlug: string,
    @Body() createOrderDto: CreateOrderDto,
  ) {
    return this.ordersService.createPublicOrder(createOrderDto, tenantSlug);
  }

  @Post()
  @UseGuards(JwtAuthGuard, TenantGuard)
  @HttpCode(HttpStatus.CREATED)
  create(
    @Body() createOrderDto: CreateOrderDto,
    @CurrentTenant() tenant: any,
    @CurrentUser() user: any,
  ) {
    return this.ordersService.create(createOrderDto, tenant.id, user.id);
  }

  @Get()
  @UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.STAFF)
  findAll(
    @CurrentTenant() tenant: any,
    @Query() filters: OrderFiltersDto,
  ) {
    return this.ordersService.findAllByTenant(tenant.id, filters);
  }

  @Get('active')
  @UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.STAFF)
  getActiveOrders(@CurrentTenant() tenant: any) {
    return this.ordersService.getActiveOrders(tenant.id);
  }

  @Get('stats')
  @UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  getStats(
    @CurrentTenant() tenant: any,
    @Query('date_from') dateFrom?: string,
    @Query('date_to') dateTo?: string,
  ) {
    const dateFromObj = dateFrom ? new Date(dateFrom) : undefined;
    const dateToObj = dateTo ? new Date(dateTo) : undefined;
    
    return this.ordersService.getOrderStats(tenant.id, dateFromObj, dateToObj);
  }

  @Get(':id')
  @UseGuards(TenantGuard)
  findOne(@Param('id') id: string, @CurrentTenant() tenant: any) {
    return this.ordersService.findOne(id, tenant.id);
  }

  @Patch(':id/status')
  @UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.STAFF)
  updateStatus(
    @Param('id') id: string,
    @Body() updateStatusDto: UpdateOrderStatusDto,
    @CurrentTenant() tenant: any,
    @CurrentUser() user: any,
  ) {
    return this.ordersService.updateStatus(id, updateStatusDto, tenant.id, user.id);
  }

  @Patch(':id/accept')
  @UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.STAFF)
  @HttpCode(HttpStatus.OK)
  acceptOrder(
    @Param('id') id: string,
    @CurrentTenant() tenant: any,
    @CurrentUser() user: any,
  ) {
    return this.ordersService.updateStatus(
      id,
      { status: 'ACCEPTED' as any },
      tenant.id,
      user.id
    );
  }

  @Patch(':id/preparing')
  @UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.STAFF)
  @HttpCode(HttpStatus.OK)
  startPreparing(
    @Param('id') id: string,
    @CurrentTenant() tenant: any,
    @CurrentUser() user: any,
  ) {
    return this.ordersService.updateStatus(
      id,
      { status: 'PREPARING' as any },
      tenant.id,
      user.id
    );
  }

  @Patch(':id/ready')
  @UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.STAFF)
  @HttpCode(HttpStatus.OK)
  markReady(
    @Param('id') id: string,
    @CurrentTenant() tenant: any,
    @CurrentUser() user: any,
  ) {
    return this.ordersService.updateStatus(
      id,
      { status: 'READY' as any },
      tenant.id,
      user.id
    );
  }

  @Patch(':id/delivered')
  @UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.STAFF)
  @HttpCode(HttpStatus.OK)
  markDelivered(
    @Param('id') id: string,
    @CurrentTenant() tenant: any,
    @CurrentUser() user: any,
  ) {
    return this.ordersService.updateStatus(
      id,
      { status: 'DELIVERED' as any },
      tenant.id,
      user.id
    );
  }

  @Patch(':id/cancel')
  @UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @HttpCode(HttpStatus.OK)
  cancelOrder(
    @Param('id') id: string,
    @Body('reason') reason: string,
    @CurrentTenant() tenant: any,
    @CurrentUser() user: any,
  ) {
    return this.ordersService.cancel(id, reason, tenant.id, user.id);
  }
}
