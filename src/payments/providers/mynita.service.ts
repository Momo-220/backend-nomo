import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import * as crypto from 'crypto';

export interface MyNitaPaymentRequest {
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

export interface MyNitaPaymentResponse {
  success: boolean;
  transaction_id: string;
  payment_url: string;
  message?: string;
}

@Injectable()
export class MyNitaService {
  private readonly logger = new Logger(MyNitaService.name);
  private readonly apiUrl: string;
  private readonly apiKey: string;
  private readonly secretKey: string;
  private readonly merchantId: string;

  constructor(private configService: ConfigService) {
    this.apiUrl = this.configService.get<string>('MYNITA_API_URL', 'https://api.mynita.com/v1');
    this.apiKey = this.configService.get<string>('MYNITA_API_KEY');
    this.secretKey = this.configService.get<string>('MYNITA_SECRET_KEY');
    this.merchantId = this.configService.get<string>('MYNITA_MERCHANT_ID');

    if (!this.apiKey || !this.secretKey || !this.merchantId) {
      this.logger.warn('Configuration MyNita manquante. Paiements MyNita désactivés.');
    }
  }

  /**
   * Initier un paiement MyNita
   */
  async initiatePayment(paymentRequest: MyNitaPaymentRequest): Promise<MyNitaPaymentResponse> {
    if (!this.isConfigured()) {
      throw new BadRequestException('Configuration MyNita manquante');
    }

    try {
      this.logger.log(`Initiation paiement MyNita pour commande ${paymentRequest.order_id}`);

      // Préparer les données de paiement
      const paymentData = {
        merchant_id: this.merchantId,
        order_id: paymentRequest.order_id,
        amount: paymentRequest.amount,
        currency: paymentRequest.currency,
        description: paymentRequest.description,
        customer_phone: paymentRequest.customer_phone,
        customer_email: paymentRequest.customer_email,
        success_url: paymentRequest.success_url,
        cancel_url: paymentRequest.cancel_url,
        webhook_url: paymentRequest.webhook_url,
        timestamp: Date.now(),
      };

      // Générer la signature
      const signature = this.generateSignature(paymentData);
      paymentData['signature'] = signature;

      // Appel API MyNita
      const response = await axios.post(
        `${this.apiUrl}/payments/initiate`,
        paymentData,
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json',
          },
          timeout: 30000,
        }
      );

      if (response.data.success) {
        this.logger.log(`Paiement MyNita initié avec succès: ${response.data.transaction_id}`);
        return {
          success: true,
          transaction_id: response.data.transaction_id,
          payment_url: response.data.payment_url,
        };
      } else {
        throw new BadRequestException(`Erreur MyNita: ${response.data.message}`);
      }

    } catch (error) {
      this.logger.error(`Erreur initiation paiement MyNita: ${error.message}`);
      
      if (error.response?.data?.message) {
        throw new BadRequestException(`MyNita: ${error.response.data.message}`);
      }
      
      throw new BadRequestException('Erreur lors de l\'initiation du paiement MyNita');
    }
  }

  /**
   * Vérifier la signature d'un webhook MyNita
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
      this.logger.error(`Erreur vérification signature MyNita: ${error.message}`);
      return false;
    }
  }

  /**
   * Vérifier le statut d'un paiement MyNita
   */
  async checkPaymentStatus(transactionId: string): Promise<any> {
    if (!this.isConfigured()) {
      throw new BadRequestException('Configuration MyNita manquante');
    }

    try {
      const response = await axios.get(
        `${this.apiUrl}/payments/${transactionId}/status`,
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
          },
          timeout: 15000,
        }
      );

      return response.data;
    } catch (error) {
      this.logger.error(`Erreur vérification statut MyNita: ${error.message}`);
      throw new BadRequestException('Erreur lors de la vérification du statut');
    }
  }

  /**
   * Générer une signature sécurisée pour MyNita
   */
  private generateSignature(data: any): string {
    // Trier les clés et créer une chaîne de requête
    const sortedKeys = Object.keys(data).sort();
    const queryString = sortedKeys
      .filter(key => key !== 'signature' && data[key] !== null && data[key] !== undefined)
      .map(key => `${key}=${data[key]}`)
      .join('&');

    // Générer le hash HMAC-SHA256
    return crypto
      .createHmac('sha256', this.secretKey)
      .update(queryString)
      .digest('hex');
  }

  /**
   * Vérifier si MyNita est configuré
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












