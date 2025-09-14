import { IsString, IsEmail, MinLength, MaxLength, IsEnum, IsOptional } from 'class-validator';
import { UserRole } from '../../common/types/user.types';

export class RegisterDto {
  @IsString()
  @MaxLength(255)
  tenant_id: string;

  @IsEmail()
  @MaxLength(255)
  email: string;

  @IsString()
  @MinLength(8)
  @MaxLength(100)
  password: string;

  @IsString()
  @MaxLength(100)
  first_name: string;

  @IsString()
  @MaxLength(100)
  last_name: string;

  @IsOptional()
  @IsEnum(UserRole)
  role?: UserRole = UserRole.STAFF;
}
