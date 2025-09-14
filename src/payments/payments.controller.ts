import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
  BadRequestException,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { TenantGuard } from '../common/guards/tenant.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentTenant } from '../common/decorators/tenant.decorator';
import { UserRole } from '../common/types/user.types';
import { PaymentsService } from './payments.service';
import { InitiatePaymentDto } from './dto/initiate-payment.dto';

@Controller('payments')
@UseGuards(JwtAuthGuard, TenantGuard)
export class PaymentsController {
  constructor(private paymentsService: PaymentsService) {}

  /**
   * Initier un paiement pour une commande
   */
  @Post('initiate/:orderId')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.STAFF)
  async initiatePayment(
    @Param('orderId') orderId: string,
    @Body() initiatePaymentDto: InitiatePaymentDto,
    @CurrentTenant() tenant: any,
  ) {
    try {
      const result = await this.paymentsService.initiatePayment(
        orderId,
        initiatePaymentDto,
        tenant.id,
      );

      return {
        success: true,
        message: 'Paiement initié avec succès',
        data: result,
      };
    } catch (error) {
      throw new BadRequestException(error.message);
    }
  }

  /**
   * Obtenir les détails d'un paiement
   */
  @Get(':paymentId')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.STAFF)
  async getPayment(
    @Param('paymentId') paymentId: string,
    @CurrentTenant() tenant: any,
  ) {
    const payment = await this.paymentsService.getPayment(paymentId, tenant.id);

    return {
      success: true,
      data: payment,
    };
  }

  /**
   * Lister les paiements avec filtres
   */
  @Get()
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  async getPayments(
    @Query() query: any,
    @CurrentTenant() tenant: any,
  ) {
    const filters = {
      status: query.status,
      method: query.method,
      from_date: query.from_date,
      to_date: query.to_date,
      limit: query.limit ? parseInt(query.limit) : 50,
      offset: query.offset ? parseInt(query.offset) : 0,
    };

    const payments = await this.paymentsService.getPayments(tenant.id, filters);

    return {
      success: true,
      data: payments,
      filters: filters,
    };
  }

  /**
   * Statistiques des paiements
   */
  @Get('stats/overview')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  async getPaymentStats(@CurrentTenant() tenant: any) {
    const stats = await this.paymentsService.getPaymentStats(tenant.id);

    return {
      success: true,
      data: stats,
    };
  }

  /**
   * Statut de configuration des providers de paiement
   */
  @Get('providers/status')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  async getProvidersStatus() {
    const status = this.paymentsService.getProvidersStatus();

    return {
      success: true,
      data: status,
    };
  }
}
