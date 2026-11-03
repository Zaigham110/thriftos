import { IsEmail, IsNotEmpty, IsString, Matches, MaxLength, MinLength } from 'class-validator';

export class LoginDto {
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(6)
  password: string;
}

/** Munshi sign-in: phone (any local format) and a 4–6 digit PIN. */
export class PinLoginDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(30)
  phone: string;

  @Matches(/^\d{4,6}$/, { message: 'PIN is 4 to 6 digits' })
  pin: string;
}

export class LoginResponseDto {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  user: {
    id: string;
    email: string | null;
    /** Set for a munshi who signs in with phone + PIN. */
    phone?: string | null;
    name: string;
    tenantId: string | null;
    isSuperAdmin: boolean;
    role?: 'SUPERADMIN' | 'TENANT_USER';
    tenants?: Array<{ id: string; name: string }>;
  };
}

