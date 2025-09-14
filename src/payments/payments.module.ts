import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';
import { MyNitaService } from './providers/mynita.service';
import { WaveService } from './providers/wave.service';
import { WebhooksController } from './webhooks.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { OrdersModule } from '../orders/orders.module';
import { WebsocketModule } from '../websocket/websocket.module';

@Module({
  imports: [
    ConfigModule,
    PrismaModule,
    OrdersModule,
    WebsocketModule,
  ],
  controllers: [
    PaymentsController,
    WebhooksController,
  ],
  providers: [
    PaymentsService,
    MyNitaService,
    WaveService,
  ],
  exports: [
    PaymentsService,
    MyNitaService,
    WaveService,
  ],
})
export class PaymentsModule {}