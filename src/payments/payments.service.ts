import { Injectable, Logger, NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { OrdersService } from '../orders/orders.service';
import { WebSocketService } from '../websocket/websocket.service';
import { MyNitaService, MyNitaPaymentRequest } from './providers/mynita.service';
import { WaveService, WavePaymentRequest } from './providers/wave.service';
import { InitiatePaymentDto } from './dto/initiate-payment.dto';
import { PaymentCallbackDto, PaymentStatus } from './dto/payment-callback.dto';
import { PaymentMethod, OrderStatus } from '../common/types/order.types';

export interface PaymentInitiationResult {
  success: boolean;
  payment_url: string;
  transaction_id: string;
  order_id: string;
  payment_method: PaymentMethod;
  expires_at: Date;
}

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);
  private readonly frontendUrl: string;

  constructor(
    private prisma: PrismaService,
    private ordersService: OrdersService,
    private websocketService: WebSocketService,
    private mynitaService: MyNitaService,
    private waveService: WaveService,
    private configService: ConfigService,
  ) {
    this.frontendUrl = this.configService.get<string>('FRONTEND_URL', 'https://nomo-app.vercel.app');
  }

  /**
   * Initier un paiement pour une commande
   */
  async initiatePayment(
    orderId: string,
    paymentDto: InitiatePaymentDto,
    tenantId: string,
  ): Promise<PaymentInitiationResult> {
    // Vérifier que la commande existe et appartient au tenant
    const order = await this.prisma.order.findFirst({
      where: {
        id: orderId,
        tenant_id: tenantId,
        status: OrderStatus.PENDING,
      },
      include: {
        tenant: true,
        table: true,
        order_items: {
          include: {
            item: true,
          },
        },
      },
    });

    if (!order) {
      throw new NotFoundException('Commande non trouvée ou déjà traitée');
    }

    // Vérifier que la commande n'a pas déjà un paiement en cours
    const existingPayment = await this.prisma.payment.findFirst({
      where: {
        order_id: orderId,
        status: {
          in: ['PENDING', 'SUCCESS'],
        },
      },
    });

    if (existingPayment) {
      throw new ConflictException('Un paiement est déjà en cours ou terminé pour cette commande');
    }

    try {
      // Préparer les URLs de callback
      const baseUrl = this.configService.get<string>('APP_URL', 'http://localhost:3000');
      const successUrl = paymentDto.success_url || `${this.frontendUrl}/payment/success?order_id=${orderId}`;
      const cancelUrl = paymentDto.cancel_url || `${this.frontendUrl}/payment/cancel?order_id=${orderId}`;
      const webhookUrl = `${baseUrl}/api/v1/payments/webhooks/${paymentDto.payment_method.toLowerCase()}`;

      // Préparer les données communes de paiement
      const commonPaymentData = {
        order_id: orderId,
        amount: Number(order.total_amount), // Convertir Decimal en number
        currency: 'XOF', // Franc CFA pour l'Afrique de l'Ouest
        description: `Commande #${order.order_number} - ${order.tenant.name}`,
        customer_phone: paymentDto.customer_phone,
        customer_email: paymentDto.customer_email,
        success_url: successUrl,
        cancel_url: cancelUrl,
        webhook_url: webhookUrl,
      };

      let paymentResult;

      // Initier le paiement selon le provider choisi
      switch (paymentDto.payment_method) {
        case PaymentMethod.MYNITA:
          paymentResult = await this.mynitaService.initiatePayment(commonPaymentData as MyNitaPaymentRequest);
          break;

        case PaymentMethod.WAVE:
          paymentResult = await this.waveService.initiatePayment(commonPaymentData as WavePaymentRequest);
          break;

        default:
          throw new BadRequestException('Méthode de paiement non supportée');
      }

      if (!paymentResult.success) {
        throw new BadRequestException('Échec de l\'initiation du paiement');
      }

      // Enregistrer le paiement en base
      const payment = await this.prisma.payment.create({
        data: {
          order_id: orderId,
          tenant_id: tenantId,
          method: paymentDto.payment_method,
          amount: Number(order.total_amount), // Convertir Decimal en number
          currency: 'XOF',
          status: 'PENDING',
          transaction_id: paymentResult.transaction_id,
          provider_data: {
            payment_url: paymentResult.payment_url,
            success_url: successUrl,
            cancel_url: cancelUrl,
            webhook_url: webhookUrl,
          },
          expires_at: new Date(Date.now() + 30 * 60 * 1000), // 30 minutes
        },
      });

      this.logger.log(`Paiement initié: ${payment.id} pour commande ${orderId}`);

      // Notifier via WebSocket
              this.websocketService.emitPaymentInitiated(tenantId, {
          order_id: orderId,
          payment_id: payment.id,
          payment_method: paymentDto.payment_method,
          amount: Number(order.total_amount), // Convertir Decimal en number
        });

      return {
        success: true,
        payment_url: paymentResult.payment_url,
        transaction_id: paymentResult.transaction_id,
        order_id: orderId,
        payment_method: paymentDto.payment_method,
        expires_at: payment.expires_at,
      };

    } catch (error) {
      this.logger.error(`Erreur initiation paiement: ${error.message}`);
      throw error;
    }
  }

  /**
   * Traiter un callback de paiement (webhook)
   */
  async handlePaymentCallback(
    provider: string,
    callbackData: PaymentCallbackDto,
    signature?: string,
  ): Promise<void> {
    this.logger.log(`Callback paiement reçu de ${provider}: ${callbackData.transaction_id}`);

    try {
      // Vérifier la signature selon le provider
      let signatureValid = false;
      switch (provider.toLowerCase()) {
        case 'mynita':
          signatureValid = signature ? this.mynitaService.verifyWebhookSignature(callbackData, signature) : true;
          break;
        case 'wave':
          signatureValid = signature ? this.waveService.verifyWebhookSignature(callbackData, signature) : true;
          break;
        default:
          throw new BadRequestException('Provider de paiement non reconnu');
      }

      if (signature && !signatureValid) {
        this.logger.warn(`Signature invalide pour callback ${provider}: ${callbackData.transaction_id}`);
        throw new BadRequestException('Signature invalide');
      }

      // Récupérer le paiement
      const payment = await this.prisma.payment.findFirst({
        where: {
          transaction_id: callbackData.transaction_id,
        },
        include: {
          order: {
            include: {
              tenant: true,
            },
          },
        },
      });

      if (!payment) {
        throw new NotFoundException('Paiement non trouvé');
      }

      // Mettre à jour le statut du paiement
      const updatedPayment = await this.prisma.payment.update({
        where: { id: payment.id },
        data: {
          status: this.mapProviderStatusToPaymentStatus(callbackData.status),
          provider_reference: callbackData.provider_reference,
          provider_data: {
            ...payment.provider_data as any,
            callback_data: callbackData,
            processed_at: new Date(),
          },
        },
      });

      // Si le paiement est réussi, valider la commande
      if (callbackData.status === PaymentStatus.SUCCESS) {
        await this.validateOrderPayment(payment.order_id, payment.tenant_id);
        
        this.logger.log(`Paiement réussi: ${payment.id} - Commande ${payment.order_id} validée`);

        // Notifier le succès
        this.websocketService.emitPaymentSuccess(payment.tenant_id, {
          order_id: payment.order_id,
          payment_id: payment.id,
          transaction_id: callbackData.transaction_id,
          amount: payment.amount,
        });

      } else if (callbackData.status === PaymentStatus.FAILED || callbackData.status === PaymentStatus.CANCELLED) {
        this.logger.log(`Paiement échoué/annulé: ${payment.id} - Commande ${payment.order_id}`);

        // Notifier l'échec
        this.websocketService.emitPaymentFailed(payment.tenant_id, {
          order_id: payment.order_id,
          payment_id: payment.id,
          transaction_id: callbackData.transaction_id,
          reason: callbackData.message || 'Paiement échoué',
        });
      }

    } catch (error) {
      this.logger.error(`Erreur traitement callback paiement: ${error.message}`);
      throw error;
    }
  }

  /**
   * Valider une commande après paiement réussi
   */
  private async validateOrderPayment(orderId: string, tenantId: string): Promise<void> {
    try {
      // Mettre à jour le statut de la commande
      await this.ordersService.updateStatus(
        orderId,
        { status: OrderStatus.PREPARING },
        tenantId,
      );

      this.logger.log(`Commande ${orderId} confirmée après paiement réussi`);

    } catch (error) {
      this.logger.error(`Erreur validation commande ${orderId}: ${error.message}`);
      throw error;
    }
  }

  /**
   * Obtenir les détails d'un paiement
   */
  async getPayment(paymentId: string, tenantId: string) {
    const payment = await this.prisma.payment.findFirst({
      where: {
        id: paymentId,
        tenant_id: tenantId,
      },
      include: {
        order: {
          include: {
            table: true,
            order_items: {
              include: {
                item: true,
              },
            },
          },
        },
      },
    });

    if (!payment) {
      throw new NotFoundException('Paiement non trouvé');
    }

    return payment;
  }

  /**
   * Lister les paiements d'un tenant
   */
  async getPayments(tenantId: string, filters: any = {}) {
    const where: any = { tenant_id: tenantId };

    if (filters.status) {
      where.status = filters.status;
    }

    if (filters.method) {
      where.method = filters.method;
    }

    if (filters.from_date) {
      where.created_at = { ...where.created_at, gte: new Date(filters.from_date) };
    }

    if (filters.to_date) {
      where.created_at = { ...where.created_at, lte: new Date(filters.to_date) };
    }

    const payments = await this.prisma.payment.findMany({
      where,
      include: {
        order: {
          select: {
            order_number: true,
            total_amount: true,
            table: {
              select: {
                number: true,
                name: true,
              },
            },
          },
        },
      },
      orderBy: { created_at: 'desc' },
      take: filters.limit || 50,
      skip: filters.offset || 0,
    });

    return payments;
  }

  /**
   * Statistiques des paiements
   */
  async getPaymentStats(tenantId: string) {
    const [totalPayments, successfulPayments, pendingPayments, failedPayments] = await Promise.all([
      this.prisma.payment.count({
        where: { tenant_id: tenantId },
      }),
      this.prisma.payment.count({
        where: { tenant_id: tenantId, status: 'SUCCESS' },
      }),
      this.prisma.payment.count({
        where: { tenant_id: tenantId, status: 'PENDING' },
      }),
      this.prisma.payment.count({
        where: { tenant_id: tenantId, status: { in: ['FAILED', 'CANCELLED'] } },
      }),
    ]);

    const totalRevenue = await this.prisma.payment.aggregate({
      where: {
        tenant_id: tenantId,
        status: 'SUCCESS',
      },
      _sum: {
        amount: true,
      },
    });

    const paymentsByMethod = await this.prisma.payment.groupBy({
      by: ['method'],
      where: { tenant_id: tenantId },
      _count: true,
    });

    return {
      total_payments: totalPayments,
      successful_payments: successfulPayments,
      pending_payments: pendingPayments,
      failed_payments: failedPayments,
      success_rate: totalPayments > 0 ? (successfulPayments / totalPayments) * 100 : 0,
      total_revenue: totalRevenue._sum.amount || 0,
      payments_by_method: paymentsByMethod,
    };
  }

  /**
   * Mapper le statut du provider vers notre enum
   */
  private mapProviderStatusToPaymentStatus(providerStatus: PaymentStatus): string {
    switch (providerStatus) {
      case PaymentStatus.SUCCESS:
        return 'SUCCESS';
      case PaymentStatus.FAILED:
        return 'FAILED';
      case PaymentStatus.CANCELLED:
        return 'CANCELLED';
      case PaymentStatus.PENDING:
      default:
        return 'PENDING';
    }
  }

  /**
   * Vérifier le statut de configuration des providers
   */
  getProvidersStatus() {
    return {
      mynita: this.mynitaService.getConfigStatus(),
      wave: this.waveService.getConfigStatus(),
    };
  }
}
