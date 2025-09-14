import { Module } from '@nestjs/common';
import { CategoriesController } from './categories/categories.controller';
import { CategoriesService } from './categories/categories.service';
import { ItemsController } from './items/items.controller';
import { ItemsService } from './items/items.service';
import { MenuController } from './menu.controller';
import { MenuService } from './menu.service';

@Module({
  controllers: [CategoriesController, ItemsController, MenuController],
  providers: [CategoriesService, ItemsService, MenuService],
  exports: [CategoriesService, ItemsService, MenuService],
})
export class MenuModule {}
