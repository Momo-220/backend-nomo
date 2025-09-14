import { Injectable } from '@nestjs/common';
import { Server } from 'socket.io';

@Injectable()
export class WebSocketService {
  private server: Server;

  setServer(server: Server) {
    this.server = server;
  }

  // Émettre un événement à tous les clients d'un tenant
  emitToTenant(tenantId: string, event: string, data: any) {
    if (this.server) {
      this.server.to(`tenant_${tenantId}`).emit(event, data);
    }
  }

  // Émettre un événement à tous les clients d'un rôle spécifique dans un tenant
  emitToTenantRole(tenantId: string, role: string, event: string, data: any) {
    if (this.server) {
      this.server.to(`tenant_${tenantId}_${role}`).emit(event, data);
    }
  }

  // Émettre un événement à un utilisateur spécifique
  emitToUser(userId: string, event: string, data: any) {
    if (this.server) {
      this.server.to(`user_${userId}`).emit(event, data);
    }
  }

  // Émettre une nouvelle commande à la cuisine
  emitNewOrder(tenantId: string, orderData: any) {
    this.emitToTenantRole(tenantId, 'kitchen', 'new_order', {
      type: 'NEW_ORDER',
      order: orderData,
      timestamp: new Date().toISOString(),
    });

    // Aussi notifier les managers et admins
    this.emitToTenantRole(tenantId, 'MANAGER', 'new_order', {
      type: 'NEW_ORDER',
      order: orderData,
      timestamp: new Date().toISOString(),
    });

    this.emitToTenantRole(tenantId, 'ADMIN', 'new_order', {
      type: 'NEW_ORDER',
      order: orderData,
      timestamp: new Date().toISOString(),
    });
  }

  // Émettre un changement de statut de commande
  emitOrderStatusUpdate(tenantId: string, orderData: any) {
    this.emitToTenant(tenantId, 'order_status_update', {
      type: 'ORDER_STATUS_UPDATE',
      order: orderData,
      timestamp: new Date().toISOString(),
    });
  }

  // Émettre une notification de commande prête
  emitOrderReady(tenantId: string, orderData: any) {
    this.emitToTenant(tenantId, 'order_ready', {
      type: 'ORDER_READY',
      order: orderData,
      timestamp: new Date().toISOString(),
    });
  }

  // Émettre les statistiques en temps réel
  emitStatsUpdate(tenantId: string, stats: any) {
    this.emitToTenantRole(tenantId, 'ADMIN', 'stats_update', {
      type: 'STATS_UPDATE',
      stats,
      timestamp: new Date().toISOString(),
    });

    this.emitToTenantRole(tenantId, 'MANAGER', 'stats_update', {
      type: 'STATS_UPDATE',
      stats,
      timestamp: new Date().toISOString(),
    });
  }

  // Émettre une notification de paiement initié
  emitPaymentInitiated(tenantId: string, paymentData: any) {
    this.emitToTenant(tenantId, 'payment_initiated', {
      type: 'PAYMENT_INITIATED',
      payment: paymentData,
      timestamp: new Date().toISOString(),
    });
  }

  // Émettre une notification de paiement réussi
  emitPaymentSuccess(tenantId: string, paymentData: any) {
    this.emitToTenant(tenantId, 'payment_success', {
      type: 'PAYMENT_SUCCESS',
      payment: paymentData,
      timestamp: new Date().toISOString(),
    });
  }

  // Émettre une notification de paiement échoué
  emitPaymentFailed(tenantId: string, paymentData: any) {
    this.emitToTenant(tenantId, 'payment_failed', {
      type: 'PAYMENT_FAILED',
      payment: paymentData,
      timestamp: new Date().toISOString(),
    });
  }
}
