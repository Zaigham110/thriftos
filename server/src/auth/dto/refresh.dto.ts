import { IsNotEmpty, IsString } from 'class-validator';

export class RefreshTokenDto {
  @IsString()
  @IsNotEmpty()
  refreshToken: string;
}

export class RefreshResponseDto {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

