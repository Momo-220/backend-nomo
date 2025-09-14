import { IsString, IsOptional, IsArray, IsUUID, IsInt, Min, IsEnum, ValidateNested, IsPhoneNumber, MaxLength } from 'class-validator';
import { Type } from 'class-transformer';
import { PaymentMethod } from '../../common/types/order.types';

export class CreateOrderItemDto {
  @IsUUID()
  item_id: string;

  @IsInt()
  @Min(1)
  quantity: number;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}

export class CreateOrderDto {
  @IsOptional()
  @IsUUID()
  table_id?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  customer_name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  customer_phone?: string;

  @IsEnum(PaymentMethod)
  payment_method: PaymentMethod;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateOrderItemDto)
  items: CreateOrderItemDto[];
}












