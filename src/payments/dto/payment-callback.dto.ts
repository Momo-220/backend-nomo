import { IsString, IsOptional, IsEnum, IsNumber } from 'class-validator';

export enum PaymentStatus {
  PENDING = 'PENDING',
  SUCCESS = 'SUCCESS',
  FAILED = 'FAILED',
  CANCELLED = 'CANCELLED',
}

export class PaymentCallbackDto {
  @IsString()
  transaction_id: string;

  @IsString()
  order_id: string;

  @IsEnum(PaymentStatus)
  status: PaymentStatus;

  @IsOptional()
  @IsNumber()
  amount?: number;

  @IsOptional()
  @IsString()
  currency?: string;

  @IsOptional()
  @IsString()
  payment_method?: string;

  @IsOptional()
  @IsString()
  provider_reference?: string;

  @IsOptional()
  @IsString()
  signature?: string;

  @IsOptional()
  @IsString()
  message?: string;
}












