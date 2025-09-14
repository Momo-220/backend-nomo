import { Module } from '@nestjs/common';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';
import { OrderItemsService } from './order-items.service';
import { WebsocketModule } from '../websocket/websocket.module';

@Module({
  imports: [WebsocketModule],
  controllers: [OrdersController],
  providers: [OrdersService, OrderItemsService],
  exports: [OrdersService, OrderItemsService],
})
export class OrdersModule {}
