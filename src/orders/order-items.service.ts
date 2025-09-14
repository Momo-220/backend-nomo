import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateOrderItemDto } from './dto/create-order.dto';

@Injectable()
export class OrderItemsService {
  constructor(private prisma: PrismaService) {}

  async validateAndCalculateItems(items: CreateOrderItemDto[], tenantId: string) {
    const validatedItems = [];
    let totalAmount = 0;

    for (const orderItem of items) {
      // Vérifier que l'item existe et est disponible
      const item = await this.prisma.item.findFirst({
        where: {
          id: orderItem.item_id,
          tenant_id: tenantId,
          is_available: true,
        },
        select: {
          id: true,
          name: true,
          description: true,
          price: true,
          out_of_stock: true,
          image_url: true,
        },
      });

      if (!item) {
        throw new BadRequestException(`Item ${orderItem.item_id} non trouvé ou indisponible`);
      }

      if (item.out_of_stock) {
        throw new BadRequestException(`Item "${item.name}" est en rupture de stock`);
      }

      const unitPrice = parseFloat(item.price.toString());
      const totalPrice = unitPrice * orderItem.quantity;
      totalAmount += totalPrice;

      validatedItems.push({
        item_id: item.id,
        quantity: orderItem.quantity,
        unit_price: unitPrice,
        total_price: totalPrice,
        notes: orderItem.notes || null,
        item: {
          id: item.id,
          name: item.name,
          description: item.description,
          image_url: item.image_url,
        },
      });
    }

    return {
      items: validatedItems,
      totalAmount,
    };
  }

  async createOrderItems(orderId: string, validatedItems: any[]) {
    const orderItems = validatedItems.map(item => ({
      order_id: orderId,
      item_id: item.item_id,
      quantity: item.quantity,
      unit_price: item.unit_price,
      total_price: item.total_price,
      notes: item.notes,
    }));

    return this.prisma.orderItem.createMany({
      data: orderItems,
    });
  }

  async getOrderItems(orderId: string) {
    return this.prisma.orderItem.findMany({
      where: { order_id: orderId },
      select: {
        id: true,
        quantity: true,
        unit_price: true,
        total_price: true,
        notes: true,
        item: {
          select: {
            id: true,
            name: true,
            description: true,
            image_url: true,
            category: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
      orderBy: { created_at: 'asc' },
    });
  }

  async getOrderItemsStats(tenantId: string, dateFrom?: Date, dateTo?: Date) {
    const whereCondition: any = {
      order: { tenant_id: tenantId },
    };

    if (dateFrom || dateTo) {
      whereCondition.created_at = {};
      if (dateFrom) whereCondition.created_at.gte = dateFrom;
      if (dateTo) whereCondition.created_at.lte = dateTo;
    }

    const [
      totalItems,
      topItems,
    ] = await Promise.all([
      this.prisma.orderItem.aggregate({
        where: whereCondition,
        _sum: { quantity: true },
        _count: { id: true },
      }),
      this.prisma.orderItem.groupBy({
        by: ['item_id'],
        where: whereCondition,
        _sum: { quantity: true },
        _count: { id: true },
        orderBy: { _sum: { quantity: 'desc' } },
        take: 10,
      }),
    ]);

    // Récupérer les détails des top items
    const topItemsWithDetails = await Promise.all(
      topItems.map(async (topItem) => {
        const item = await this.prisma.item.findUnique({
          where: { id: topItem.item_id },
          select: {
            id: true,
            name: true,
            price: true,
            category: {
              select: { name: true },
            },
          },
        });

        return {
          ...item,
          total_quantity: topItem._sum.quantity,
          orders_count: topItem._count.id,
        };
      })
    );

    return {
      totalItemsSold: totalItems._sum.quantity || 0,
      totalOrders: totalItems._count || 0,
      topItems: topItemsWithDetails,
    };
  }
}












