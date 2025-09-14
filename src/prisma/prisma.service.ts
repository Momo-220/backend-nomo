import { Injectable, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit {
  async onModuleInit() {
    await this.$connect();
    console.log('✅ Base de données connectée');
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }

  // Méthode helper pour filtrer par tenant
  forTenant(tenantId: string) {
    return {
      user: this.user.findMany({ where: { tenant_id: tenantId } }),
      category: this.category.findMany({ where: { tenant_id: tenantId } }),
      item: this.item.findMany({ where: { tenant_id: tenantId } }),
      table: this.table.findMany({ where: { tenant_id: tenantId } }),
      order: this.order.findMany({ where: { tenant_id: tenantId } }),
      payment: this.payment.findMany({ where: { tenant_id: tenantId } }),
      event: this.event.findMany({ where: { tenant_id: tenantId } }),
    };
  }
}












