import { IsString, IsEmail, IsOptional, MaxLength, MinLength, IsObject } from 'class-validator';

export class CreateTenantDto {
  @IsString()
  @MaxLength(255)
  name: string;

  @IsString()
  @MinLength(3)
  @MaxLength(100)
  slug: string;

  @IsEmail()
  @MaxLength(255)
  email: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  phone?: string;

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  website?: string;

  @IsOptional()
  @IsString()
  logo_url?: string;

  @IsOptional()
  @IsString()
  banner_url?: string;

  @IsOptional()
  @IsObject()
  payment_info?: any;
}












