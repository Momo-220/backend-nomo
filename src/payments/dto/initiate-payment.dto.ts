import { IsEnum, IsUUID, IsOptional, IsString, IsUrl } from 'class-validator';
import { PaymentMethod } from '../../common/types/order.types';

export class InitiatePaymentDto {
  @IsUUID()
  order_id: string;

  @IsEnum(PaymentMethod)
  payment_method: PaymentMethod;

  @IsOptional()
  @IsUrl()
  success_url?: string;

  @IsOptional()
  @IsUrl()
  cancel_url?: string;

  @IsOptional()
  @IsString()
  customer_phone?: string;

  @IsOptional()
  @IsString()
  customer_email?: string;
}
