import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  ConnectedSocket,
  MessageBody,
  OnGatewayInit,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Injectable, UseGuards } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { WebSocketService } from './websocket.service';
import { PrismaService } from '../prisma/prisma.service';

interface AuthenticatedSocket extends Socket {
  user?: {
    id: string;
    tenant_id: string;
    role: string;
    email: string;
  };
}

@Injectable()
@WebSocketGateway({
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  },
  namespace: '/orders'
})
export class OrdersGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  constructor(
    private jwtService: JwtService,
    private configService: ConfigService,
    private webSocketService: WebSocketService,
    private prisma: PrismaService,
  ) {}

  afterInit(server: Server) {
    this.webSocketService.setServer(server);
    console.log('🔌 WebSocket Gateway initialisé pour les commandes');
  }

  async handleConnection(client: AuthenticatedSocket) {
    try {
      // Authentifier le client via JWT
      const token = client.handshake.auth?.token || client.handshake.headers?.authorization?.replace('Bearer ', '');
      
      if (!token) {
        console.log('❌ Client WebSocket sans token, déconnexion');
        client.disconnect();
        return;
      }

      const payload = this.jwtService.verify(token, {
        secret: this.configService.get<string>('JWT_SECRET'),
      });

      // Vérifier l'utilisateur en base
      const user = await this.prisma.user.findUnique({
        where: { id: payload.sub },
        select: {
          id: true,
          email: true,
          role: true,
          tenant_id: true,
          is_active: true,
          tenant: {
            select: {
              id: true,
              is_active: true,
            },
          },
        },
      });

      if (!user || !user.is_active || !user.tenant.is_active) {
        console.log('❌ Utilisateur WebSocket invalide, déconnexion');
        client.disconnect();
        return;
      }

      // Attacher les infos utilisateur au socket
      client.user = {
        id: user.id,
        tenant_id: user.tenant_id,
        role: user.role,
        email: user.email,
      };

      // Joindre les rooms appropriées
      await client.join(`tenant_${user.tenant_id}`);
      await client.join(`tenant_${user.tenant_id}_${user.role}`);
      await client.join(`user_${user.id}`);

      // Room spéciale pour la cuisine
      if (user.role === 'STAFF') {
        await client.join(`tenant_${user.tenant_id}_kitchen`);
      }

      console.log(`✅ Client WebSocket connecté: ${user.email} (${user.role}) - Tenant: ${user.tenant_id}`);

      // Envoyer les commandes actives au client
      const activeOrders = await this.prisma.order.findMany({
        where: {
          tenant_id: user.tenant_id,
          status: { in: ['PENDING', 'ACCEPTED', 'PREPARING', 'READY'] },
        },
        select: {
          id: true,
          order_number: true,
          customer_name: true,
          status: true,
          total_amount: true,
          created_at: true,
          table: {
            select: {
              number: true,
              name: true,
            },
          },
          _count: {
            select: {
              order_items: true,
            },
          },
        },
        orderBy: { created_at: 'asc' },
      });

      client.emit('active_orders', activeOrders);

    } catch (error) {
      console.log('❌ Erreur authentification WebSocket:', error.message);
      client.disconnect();
    }
  }

  handleDisconnect(client: AuthenticatedSocket) {
    if (client.user) {
      console.log(`👋 Client WebSocket déconnecté: ${client.user.email}`);
    }
  }

  @SubscribeMessage('join_kitchen')
  handleJoinKitchen(@ConnectedSocket() client: AuthenticatedSocket) {
    if (client.user) {
      client.join(`tenant_${client.user.tenant_id}_kitchen`);
      console.log(`🍳 ${client.user.email} a rejoint la cuisine`);
    }
  }

  @SubscribeMessage('leave_kitchen')
  handleLeaveKitchen(@ConnectedSocket() client: AuthenticatedSocket) {
    if (client.user) {
      client.leave(`tenant_${client.user.tenant_id}_kitchen`);
      console.log(`🚪 ${client.user.email} a quitté la cuisine`);
    }
  }

  @SubscribeMessage('get_active_orders')
  async handleGetActiveOrders(@ConnectedSocket() client: AuthenticatedSocket) {
    if (!client.user) return;

    const activeOrders = await this.prisma.order.findMany({
      where: {
        tenant_id: client.user.tenant_id,
        status: { in: ['PENDING', 'ACCEPTED', 'PREPARING', 'READY'] },
      },
      select: {
        id: true,
        order_number: true,
        customer_name: true,
        status: true,
        total_amount: true,
        created_at: true,
        table: {
          select: {
            number: true,
            name: true,
          },
        },
        _count: {
          select: {
            order_items: true,
          },
        },
      },
      orderBy: { created_at: 'asc' },
    });

    client.emit('active_orders', activeOrders);
  }

  @SubscribeMessage('ping')
  handlePing(@ConnectedSocket() client: AuthenticatedSocket) {
    client.emit('pong', { timestamp: new Date().toISOString() });
  }
}












