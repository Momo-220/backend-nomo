import {
  Controller,
  Post,
  Body,
  Param,
  Headers,
  Logger,
  HttpCode,
  HttpStatus,
  BadRequestException,
} from '@nestjs/common';
import { Public } from '../auth/decorators/public.decorator';
import { PaymentsService } from './payments.service';
import { PaymentCallbackDto } from './dto/payment-callback.dto';

@Controller('payments/webhooks')
@Public() // Les webhooks sont publics mais vérifiés par signature
export class WebhooksController {
  private readonly logger = new Logger(WebhooksController.name);

  constructor(private paymentsService: PaymentsService) {}

  /**
   * Webhook MyNita pour les callbacks de paiement
   */
  @Post('mynita')
  @HttpCode(HttpStatus.OK)
  async handleMyNitaWebhook(
    @Body() body: any,
    @Headers('x-mynita-signature') signature: string,
  ) {
    this.logger.log('Webhook MyNita reçu');

    try {
      // Mapper les données MyNita vers notre format standard
      const callbackData: PaymentCallbackDto = {
        transaction_id: body.transaction_id || body.id,
        order_id: body.order_id || body.reference,
        status: this.mapMyNitaStatus(body.status),
        amount: body.amount,
        currency: body.currency,
        payment_method: 'MYNITA',
        provider_reference: body.mynita_reference || body.reference,
        message: body.message || body.description,
      };

      await this.paymentsService.handlePaymentCallback('mynita', callbackData, signature);

      return {
        success: true,
        message: 'Webhook MyNita traité avec succès',
      };

    } catch (error) {
      this.logger.error(`Erreur webhook MyNita: ${error.message}`);
      throw new BadRequestException(error.message);
    }
  }

  /**
   * Webhook Wave pour les callbacks de paiement
   */
  @Post('wave')
  @HttpCode(HttpStatus.OK)
  async handleWaveWebhook(
    @Body() body: any,
    @Headers('x-wave-signature') signature: string,
  ) {
    this.logger.log('Webhook Wave reçu');

    try {
      // Mapper les données Wave vers notre format standard
      const callbackData: PaymentCallbackDto = {
        transaction_id: body.id || body.transaction_id,
        order_id: body.metadata?.order_id || body.reference,
        status: this.mapWaveStatus(body.status),
        amount: body.amount,
        currency: body.currency,
        payment_method: 'WAVE',
        provider_reference: body.wave_reference || body.id,
        message: body.message || body.status_message,
      };

      await this.paymentsService.handlePaymentCallback('wave', callbackData, signature);

      return {
        success: true,
        message: 'Webhook Wave traité avec succès',
      };

    } catch (error) {
      this.logger.error(`Erreur webhook Wave: ${error.message}`);
      throw new BadRequestException(error.message);
    }
  }

  /**
   * Webhook générique pour tests (sans signature)
   */
  @Post('test/:provider')
  @HttpCode(HttpStatus.OK)
  async handleTestWebhook(
    @Param('provider') provider: string,
    @Body() body: any,
  ) {
    this.logger.log(`Webhook test ${provider} reçu`);

    try {
      const callbackData: PaymentCallbackDto = {
        transaction_id: body.transaction_id,
        order_id: body.order_id,
        status: body.status,
        amount: body.amount,
        currency: body.currency || 'XOF',
        payment_method: provider.toUpperCase(),
        provider_reference: body.provider_reference,
        message: body.message,
      };

      await this.paymentsService.handlePaymentCallback(provider, callbackData);

      return {
        success: true,
        message: `Webhook test ${provider} traité avec succès`,
      };

    } catch (error) {
      this.logger.error(`Erreur webhook test ${provider}: ${error.message}`);
      throw new BadRequestException(error.message);
    }
  }

  /**
   * Mapper le statut MyNita vers notre enum
   */
  private mapMyNitaStatus(mynitaStatus: string): any {
    switch (mynitaStatus?.toLowerCase()) {
      case 'success':
      case 'completed':
      case 'paid':
        return 'SUCCESS';
      case 'failed':
      case 'error':
        return 'FAILED';
      case 'cancelled':
      case 'canceled':
        return 'CANCELLED';
      case 'pending':
      case 'processing':
      default:
        return 'PENDING';
    }
  }

  /**
   * Mapper le statut Wave vers notre enum
   */
  private mapWaveStatus(waveStatus: string): any {
    switch (waveStatus?.toLowerCase()) {
      case 'success':
      case 'successful':
      case 'completed':
      case 'paid':
        return 'SUCCESS';
      case 'failed':
      case 'error':
      case 'declined':
        return 'FAILED';
      case 'cancelled':
      case 'canceled':
        return 'CANCELLED';
      case 'pending':
      case 'processing':
      case 'initiated':
      default:
        return 'PENDING';
    }
  }
}












