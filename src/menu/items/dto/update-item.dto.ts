import { IsString, IsOptional, MaxLength, IsDecimal, IsInt, Min, IsUUID, IsBoolean } from 'class-validator';
import { Transform } from 'class-transformer';

export class UpdateItemDto {
  @IsOptional()
  @IsUUID()
  category_id?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsDecimal({ decimal_digits: '0,2' })
  @Transform(({ value }) => parseFloat(value))
  price?: number;

  @IsOptional()
  @IsString()
  image_url?: string;

  @IsOptional()
  @IsBoolean()
  is_available?: boolean;

  @IsOptional()
  @IsBoolean()
  out_of_stock?: boolean;

  @IsOptional()
  @IsInt()
  @Min(0)
  sort_order?: number;
}












