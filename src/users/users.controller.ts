import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { TenantGuard } from '../common/guards/tenant.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser, CurrentTenant } from '../common/decorators/tenant.decorator';
import { UserRole } from '../common/types/user.types';

@Controller('users')
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post()
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  create(
    @Body() createUserDto: CreateUserDto,
    @CurrentTenant() tenant: any,
    @CurrentUser() user: any,
  ) {
    const createData = {
      ...createUserDto,
      tenant_id: tenant.id,
    };
    return this.usersService.create(createData, user.tenant_id);
  }

  @Get()
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  findAll(@CurrentTenant() tenant: any) {
    return this.usersService.findAllByTenant(tenant.id);
  }

  @Get('stats')
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  getStats(@CurrentTenant() tenant: any) {
    return this.usersService.getUserStats(tenant.id);
  }

  @Get(':id')
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  findOne(@Param('id') id: string, @CurrentTenant() tenant: any) {
    return this.usersService.findOne(id, tenant.id);
  }

  @Patch(':id')
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  update(
    @Param('id') id: string,
    @Body() updateUserDto: UpdateUserDto,
    @CurrentTenant() tenant: any,
  ) {
    return this.usersService.update(id, updateUserDto, tenant.id);
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN)
  remove(@Param('id') id: string, @CurrentTenant() tenant: any) {
    return this.usersService.remove(id, tenant.id);
  }

  @Post('change-password')
  @HttpCode(HttpStatus.OK)
  changePassword(
    @Body() changePasswordDto: ChangePasswordDto,
    @CurrentUser() user: any,
    @CurrentTenant() tenant: any,
  ) {
    return this.usersService.changePassword(user.id, changePasswordDto, tenant.id);
  }
}
