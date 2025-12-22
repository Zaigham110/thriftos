import { Request } from 'express';
import { AuthService } from './auth.service';
import { LoginDto, LoginResponseDto } from './dto/login.dto';
import { RefreshTokenDto, RefreshResponseDto } from './dto/refresh.dto';
import { CurrentUserData } from '../common/decorators/current-user.decorator';
export declare class AuthController {
    private readonly authService;
    constructor(authService: AuthService);
    login(dto: LoginDto, req: Request): Promise<LoginResponseDto>;
    logout(user: CurrentUserData, body: {
        refreshToken?: string;
    }, req: Request): Promise<void>;
    refresh(dto: RefreshTokenDto, req: Request): Promise<RefreshResponseDto>;
    exitImpersonation(user: CurrentUserData, req: Request): Promise<void>;
}
