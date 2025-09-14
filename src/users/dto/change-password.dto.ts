import { IsString, MinLength, MaxLength } from 'class-validator';

export class ChangePasswordDto {
  @IsString()
  @MinLength(1)
  current_password: string;

  @IsString()
  @MinLength(8)
  @MaxLength(100)
  new_password: string;
}












