import { IsString, IsEmail, MinLength, MaxLength, IsEnum } from 'class-validator';
import { UserRole } from '../../common/types/user.types';

export class CreateUserDto {
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

  @IsEnum(UserRole)
  role: UserRole;
}
