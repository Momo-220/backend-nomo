import { IsString, IsOptional, MaxLength, IsDecimal, IsInt, Min, IsUUID } from 'class-validator';
import { Transform } from 'class-transformer';

export class CreateItemDto {
  @IsUUID()
  category_id: string;

  @IsString()
  @MaxLength(255)
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsDecimal({ decimal_digits: '0,2' })
  @Transform(({ value }) => parseFloat(value))
  price: number;

  @IsOptional()
  @IsString()
  image_url?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  sort_order?: number = 0;
}












