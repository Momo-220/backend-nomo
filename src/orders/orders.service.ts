import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { OrderItemsService } from './order-items.service';
import { WebSocketService } from '../websocket/websocket.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { UpdateOrderStatusDto } from './dto/update-order-status.dto';
import { OrderFiltersDto } from './dto/order-filters.dto';
import { OrderStatus, PaymentMethod } from '../common/types/order.types';

@Injectable()
export class OrdersService {
  constructor(
    private prisma: PrismaService,
    private orderItemsService: OrderItemsService,
    private webSocketService: WebSocketService,
  ) {}

  async createPublicOrder(createOrderDto: CreateOrderDto, tenantSlug: string) {
    // Récupérer le tenant par slug
    const tenant = await this.prisma.tenant.findUnique({
      where: { 
        slug: tenantSlug,
        is_active: true,
      },
      select: { id: true },
    });

    if (!tenant) {
      throw new BadRequestException('Restaurant non trouvé');
    }

    return this.create(createOrderDto, tenant.id);
  }

  async create(createOrderDto: CreateOrderDto, tenantId: string, userId?: string) {
    // Valider la table si fournie
    if (createOrderDto.table_id) {
      const table = await this.prisma.table.findFirst({
        where: {
          id: createOrderDto.table_id,
          tenant_id: tenantId,
          is_active: true,
        },
      });

      if (!table) {
        throw new BadRequestException('Table non trouvée ou inactive');
      }
    }

    // Valider et calculer les items
    const { items: validatedItems, totalAmount } = await this.orderItemsService.validateAndCalculateItems(
      createOrderDto.items,
      tenantId
    );

    if (validatedItems.length === 0) {
      throw new BadRequestException('La commande doit contenir au moins un item');
    }

    // Générer un numéro de commande unique
    const orderNumber = await this.generateOrderNumber(tenantId);

    // Créer la commande
    const order = await this.prisma.order.create({
      data: {
        tenant_id: tenantId,
        user_id: userId || null,
        table_id: createOrderDto.table_id || null,
        order_number: orderNumber,
        customer_name: createOrderDto.customer_name || null,
        customer_phone: createOrderDto.customer_phone || null,
        payment_method: createOrderDto.payment_method,
        total_amount: totalAmount,
        notes: createOrderDto.notes || null,
        status: OrderStatus.PENDING,
      },
      select: {
        id: true,
        order_number: true,
        customer_name: true,
        customer_phone: true,
        status: true,
        payment_method: true,
        total_amount: true,
        notes: true,
        created_at: true,
        table: {
          select: {
            id: true,
            number: true,
            name: true,
          },
        },
      },
    });

    // Créer les items de commande
    await this.orderItemsService.createOrderItems(order.id, validatedItems);

    // Log de l'événement
    await this.prisma.event.create({
      data: {
        tenant_id: tenantId,
        user_id: userId || null,
        order_id: order.id,
        event_type: 'ORDER_CREATED',
        description: `Nouvelle commande créée: ${order.order_number}`,
        metadata: {
          order_number: order.order_number,
          total_amount: totalAmount,
          items_count: validatedItems.length,
          payment_method: createOrderDto.payment_method,
        },
      },
    });

    // Récupérer la commande complète avec les items
    const completeOrder = await this.findOne(order.id, tenantId);

    // Émettre la notification WebSocket pour nouvelle commande
    this.webSocketService.emitNewOrder(tenantId, completeOrder);

    return completeOrder;
  }

  async findAllByTenant(tenantId: string, filters: OrderFiltersDto) {
    const { page = 1, limit = 20, ...filterConditions } = filters;
    const skip = (page - 1) * limit;

    const whereCondition: any = { tenant_id: tenantId };

    // Appliquer les filtres
    if (filterConditions.status) {
      whereCondition.status = filterConditions.status;
    }

    if (filterConditions.payment_method) {
      whereCondition.payment_method = filterConditions.payment_method;
    }

    if (filterConditions.table_id) {
      whereCondition.table_id = filterConditions.table_id;
    }

    if (filterConditions.date_from || filterConditions.date_to) {
      whereCondition.created_at = {};
      if (filterConditions.date_from) {
        whereCondition.created_at.gte = new Date(filterConditions.date_from);
      }
      if (filterConditions.date_to) {
        whereCondition.created_at.lte = new Date(filterConditions.date_to);
      }
    }

    const [orders, total] = await Promise.all([
      this.prisma.order.findMany({
        where: whereCondition,
        select: {
          id: true,
          order_number: true,
          customer_name: true,
          customer_phone: true,
          status: true,
          payment_method: true,
          total_amount: true,
          created_at: true,
          updated_at: true,
          table: {
            select: {
              id: true,
              number: true,
              name: true,
            },
          },
          user: {
            select: {
              id: true,
              first_name: true,
              last_name: true,
            },
          },
          _count: {
            select: {
              order_items: true,
            },
          },
        },
        orderBy: { created_at: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.order.count({ where: whereCondition }),
    ]);

    return {
      orders: orders.map(order => ({
        ...order,
        items_count: order._count.order_items,
      })),
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    };
  }

  async findOne(id: string, tenantId: string) {
    const order = await this.prisma.order.findFirst({
      where: {
        id,
        tenant_id: tenantId,
      },
      select: {
        id: true,
        order_number: true,
        customer_name: true,
        customer_phone: true,
        status: true,
        payment_method: true,
        total_amount: true,
        notes: true,
        created_at: true,
        updated_at: true,
        table: {
          select: {
            id: true,
            number: true,
            name: true,
          },
        },
        user: {
          select: {
            id: true,
            first_name: true,
            last_name: true,
          },
        },
      },
    });

    if (!order) {
      throw new NotFoundException('Commande non trouvée');
    }

    // Récupérer les items de la commande
    const orderItems = await this.orderItemsService.getOrderItems(order.id);

    return {
      ...order,
      order_items: orderItems,
    };
  }

  async updateStatus(id: string, updateStatusDto: UpdateOrderStatusDto, tenantId: string, userId?: string) {
    const order = await this.findOne(id, tenantId);

    // Vérifier les transitions de statut valides
    this.validateStatusTransition(order.status as OrderStatus, updateStatusDto.status);

    const updatedOrder = await this.prisma.order.update({
      where: { id },
      data: {
        status: updateStatusDto.status,
        updated_at: new Date(),
      },
      select: {
        id: true,
        order_number: true,
        status: true,
        updated_at: true,
      },
    });

    // Log de l'événement
    await this.prisma.event.create({
      data: {
        tenant_id: tenantId,
        user_id: userId || null,
        order_id: order.id,
        event_type: 'ORDER_UPDATED',
        description: `Statut commande ${order.order_number}: ${order.status} → ${updateStatusDto.status}`,
        metadata: {
          order_number: order.order_number,
          old_status: order.status,
          new_status: updateStatusDto.status,
          reason: updateStatusDto.reason,
        },
      },
    });

    // Émettre la notification WebSocket pour changement de statut
    this.webSocketService.emitOrderStatusUpdate(tenantId, {
      ...updatedOrder,
      old_status: order.status,
    });

    // Si la commande est prête, émettre une notification spéciale
    if (updateStatusDto.status === OrderStatus.READY) {
      this.webSocketService.emitOrderReady(tenantId, updatedOrder);
    }

    return updatedOrder;
  }

  async cancel(id: string, reason: string, tenantId: string, userId?: string) {
    const order = await this.findOne(id, tenantId);

    if (order.status === OrderStatus.DELIVERED) {
      throw new BadRequestException('Impossible d\'annuler une commande déjà livrée');
    }

    if (order.status === OrderStatus.CANCELLED) {
      throw new BadRequestException('Commande déjà annulée');
    }

    return this.updateStatus(id, { 
      status: OrderStatus.CANCELLED, 
      reason 
    }, tenantId, userId);
  }

  async getOrderStats(tenantId: string, dateFrom?: Date, dateTo?: Date) {
    const whereCondition: any = { tenant_id: tenantId };

    if (dateFrom || dateTo) {
      whereCondition.created_at = {};
      if (dateFrom) whereCondition.created_at.gte = dateFrom;
      if (dateTo) whereCondition.created_at.lte = dateTo;
    }

    const [
      totalOrders,
      ordersByStatus,
      totalRevenue,
      averageOrderValue,
      ordersByPaymentMethod,
    ] = await Promise.all([
      this.prisma.order.count({ where: whereCondition }),
      this.prisma.order.groupBy({
        by: ['status'],
        where: whereCondition,
        _count: { status: true },
      }),
      this.prisma.order.aggregate({
        where: { ...whereCondition, status: OrderStatus.DELIVERED },
        _sum: { total_amount: true },
      }),
      this.prisma.order.aggregate({
        where: whereCondition,
        _avg: { total_amount: true },
      }),
      this.prisma.order.groupBy({
        by: ['payment_method'],
        where: whereCondition,
        _count: { payment_method: true },
        _sum: { total_amount: true },
      }),
    ]);

    const itemStats = await this.orderItemsService.getOrderItemsStats(tenantId, dateFrom, dateTo);

    return {
      totalOrders,
      totalRevenue: totalRevenue._sum.total_amount || 0,
      averageOrderValue: averageOrderValue._avg.total_amount || 0,
      ordersByStatus: ordersByStatus.reduce((acc, item) => {
        acc[item.status] = item._count.status;
        return acc;
      }, {} as Record<string, number>),
      ordersByPaymentMethod: ordersByPaymentMethod.map(item => ({
        method: item.payment_method,
        count: item._count.payment_method,
        total_amount: item._sum.total_amount || 0,
      })),
      items: itemStats,
    };
  }

  async getActiveOrders(tenantId: string) {
    const activeStatuses = [OrderStatus.PENDING, OrderStatus.ACCEPTED, OrderStatus.PREPARING, OrderStatus.READY];

    return this.prisma.order.findMany({
      where: {
        tenant_id: tenantId,
        status: { in: activeStatuses },
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
  }

  private async generateOrderNumber(tenantId: string): Promise<string> {
    const today = new Date();
    const datePrefix = today.toISOString().slice(0, 10).replace(/-/g, '');
    
    const lastOrder = await this.prisma.order.findFirst({
      where: {
        tenant_id: tenantId,
        order_number: { startsWith: datePrefix },
      },
      orderBy: { order_number: 'desc' },
    });

    let sequence = 1;
    if (lastOrder) {
      const lastSequence = parseInt(lastOrder.order_number.slice(-4));
      sequence = lastSequence + 1;
    }

    return `${datePrefix}${sequence.toString().padStart(4, '0')}`;
  }

  private validateStatusTransition(currentStatus: OrderStatus, newStatus: OrderStatus) {
    const validTransitions: Record<OrderStatus, OrderStatus[]> = {
      [OrderStatus.PENDING]: [OrderStatus.ACCEPTED, OrderStatus.CANCELLED],
      [OrderStatus.ACCEPTED]: [OrderStatus.PREPARING, OrderStatus.CANCELLED],
      [OrderStatus.PREPARING]: [OrderStatus.READY, OrderStatus.CANCELLED],
      [OrderStatus.READY]: [OrderStatus.DELIVERED, OrderStatus.CANCELLED],
      [OrderStatus.DELIVERED]: [], // Aucune transition possible depuis DELIVERED
      [OrderStatus.CANCELLED]: [], // Aucune transition possible depuis CANCELLED
    };

    const allowedTransitions = validTransitions[currentStatus];
    
    if (!allowedTransitions.includes(newStatus)) {
      throw new BadRequestException(
        `Transition invalide: ${currentStatus} → ${newStatus}. ` +
        `Transitions autorisées: ${allowedTransitions.join(', ')}`
      );
    }
  }
}
