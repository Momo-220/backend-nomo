import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import * as crypto from 'crypto';

export interface WavePaymentRequest {
  order_id: string;
  amount: number;
  currency: string;
  description: string;
  customer_phone?: string;
  customer_email?: string;
  success_url: string;
  cancel_url: string;
  webhook_url: string;
}

export interface WavePaymentResponse {
  success: boolean;
  transaction_id: string;
  payment_url: string;
  message?: string;
}

@Injectable()
export class WaveService {
  private readonly logger = new Logger(WaveService.name);
  private readonly apiUrl: string;
  private readonly apiKey: string;
  private readonly secretKey: string;
  private readonly merchantId: string;

  constructor(private configService: ConfigService) {
    this.apiUrl = this.configService.get<string>('WAVE_API_URL', 'https://api.wave.com/v1');
    this.apiKey = this.configService.get<string>('WAVE_API_KEY');
    this.secretKey = this.configService.get<string>('WAVE_SECRET_KEY');
    this.merchantId = this.configService.get<string>('WAVE_MERCHANT_ID');

    if (!this.apiKey || !this.secretKey || !this.merchantId) {
      this.logger.warn('Configuration Wave manquante. Paiements Wave désactivés.');
    }
  }

  /**
   * Initier un paiement Wave
   */
  async initiatePayment(paymentRequest: WavePaymentRequest): Promise<WavePaymentResponse> {
    if (!this.isConfigured()) {
      throw new BadRequestException('Configuration Wave manquante');
    }

    try {
      this.logger.log(`Initiation paiement Wave pour commande ${paymentRequest.order_id}`);

      // Préparer les données de paiement Wave
      const paymentData = {
        merchant_id: this.merchantId,
        reference: paymentRequest.order_id,
        amount: paymentRequest.amount,
        currency: paymentRequest.currency,
        description: paymentRequest.description,
        customer: {
          phone: paymentRequest.customer_phone,
          email: paymentRequest.customer_email,
        },
        callback_urls: {
          success: paymentRequest.success_url,
          cancel: paymentRequest.cancel_url,
          webhook: paymentRequest.webhook_url,
        },
        metadata: {
          order_id: paymentRequest.order_id,
          timestamp: Date.now(),
        },
      };

      // Générer la signature Wave
      const signature = this.generateSignature(paymentData);

      // Appel API Wave
      const response = await axios.post(
        `${this.apiUrl}/payments/initialize`,
        paymentData,
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'X-Wave-Signature': signature,
            'Content-Type': 'application/json',
          },
          timeout: 30000,
        }
      );

      if (response.data.success || response.data.status === 'success') {
        this.logger.log(`Paiement Wave initié avec succès: ${response.data.transaction_id || response.data.id}`);
        return {
          success: true,
          transaction_id: response.data.transaction_id || response.data.id,
          payment_url: response.data.payment_url || response.data.checkout_url,
        };
      } else {
        throw new BadRequestException(`Erreur Wave: ${response.data.message || response.data.error}`);
      }

    } catch (error) {
      this.logger.error(`Erreur initiation paiement Wave: ${error.message}`);
      
      if (error.response?.data?.message || error.response?.data?.error) {
        throw new BadRequestException(`Wave: ${error.response.data.message || error.response.data.error}`);
      }
      
      throw new BadRequestException('Erreur lors de l\'initiation du paiement Wave');
    }
  }

  /**
   * Vérifier la signature d'un webhook Wave
   */
  verifyWebhookSignature(payload: any, receivedSignature: string): boolean {
    if (!this.isConfigured()) {
      return false;
    }

    try {
      const expectedSignature = this.generateSignature(payload);
      return crypto.timingSafeEqual(
        Buffer.from(expectedSignature),
        Buffer.from(receivedSignature)
      );
    } catch (error) {
      this.logger.error(`Erreur vérification signature Wave: ${error.message}`);
      return false;
    }
  }

  /**
   * Vérifier le statut d'un paiement Wave
   */
  async checkPaymentStatus(transactionId: string): Promise<any> {
    if (!this.isConfigured()) {
      throw new BadRequestException('Configuration Wave manquante');
    }

    try {
      const response = await axios.get(
        `${this.apiUrl}/payments/${transactionId}`,
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
          },
          timeout: 15000,
        }
      );

      return response.data;
    } catch (error) {
      this.logger.error(`Erreur vérification statut Wave: ${error.message}`);
      throw new BadRequestException('Erreur lors de la vérification du statut');
    }
  }

  /**
   * Générer une signature sécurisée pour Wave
   */
  private generateSignature(data: any): string {
    // Convertir les données en JSON puis en chaîne
    const dataString = JSON.stringify(data);
    
    // Générer le hash HMAC-SHA256
    return crypto
      .createHmac('sha256', this.secretKey)
      .update(dataString)
      .digest('hex');
  }

  /**
   * Vérifier si Wave est configuré
   */
  private isConfigured(): boolean {
    return !!(this.apiKey && this.secretKey && this.merchantId);
  }

  /**
   * Obtenir les informations de configuration (pour debug)
   */
  getConfigStatus() {
    return {
      configured: this.isConfigured(),
      api_url: this.apiUrl,
      merchant_id: this.merchantId ? '***' + this.merchantId.slice(-4) : null,
    };
  }
}












