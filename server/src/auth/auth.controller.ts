import { Controller, Post, Body, HttpCode, HttpStatus, Req, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Request } from 'express';
import { AuthService } from './auth.service';
import { LoginDto, LoginResponseDto, PinLoginDto } from './dto/login.dto';
import { RefreshTokenDto, RefreshResponseDto } from './dto/refresh.dto';
import { Public } from '../common/decorators/public.decorator';
import { CurrentUser, CurrentUserData } from '../common/decorators/current-user.decorator';
import { PermissionGuard } from '../common/guards/permission.guard';
import { SkipPermissionCheck } from '../common/decorators/permissions.decorator';

/**
 * AuthController - Handles authentication (login, logout, refresh, impersonation).
 * 
 * Security Notes:
 * - @Public() routes (login, refresh): Skip auth entirely - required for unauthenticated access
 * - logout/exit-impersonation: Protected by global JwtAuthGuard, use @SkipPermissionCheck
 *   because any authenticated user can manage their own session
 * - TenantGuard NOT applied: These routes operate on user's own session,
 *   SuperAdmins may not have a tenant context, and impersonating users need to exit
 */
@ApiTags('Auth')
@Controller('auth')
@UseGuards(PermissionGuard)
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  // 5 attempts per minute (THROTTLE_LOGIN_LIMIT raises it for the browser tests only).
  @Throttle({ short: { limit: () => Number(process.env.THROTTLE_LOGIN_LIMIT || 5), ttl: 60000 } })
  @ApiOperation({ summary: 'User login', description: 'Authenticate with email and password' })
  @ApiResponse({ status: 200, description: 'Login successful, returns JWT tokens' })
  @ApiResponse({ status: 401, description: 'Invalid credentials' })
  @ApiResponse({ status: 429, description: 'Too many login attempts' })
  async login(@Body() dto: LoginDto, @Req() req: Request): Promise<LoginResponseDto> {
    const ipAddress = req.ip || req.socket.remoteAddress;
    const userAgent = req.headers['user-agent'];
    return this.authService.login(dto, ipAddress, userAgent);
  }

  /** Munshi sign-in with phone + PIN; 5 wrong PINs lock it for 15 minutes. */
  @Public()
  @Post('login/pin')
  @HttpCode(HttpStatus.OK)
  @Throttle({ short: { limit: () => Number(process.env.THROTTLE_LOGIN_LIMIT || 10), ttl: 60000 } })
  async loginWithPin(@Body() dto: PinLoginDto, @Req() req: Request): Promise<LoginResponseDto> {
    return this.authService.loginWithPin(dto, req.ip || req.socket.remoteAddress, req.headers['user-agent']);
  }

  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  @SkipPermissionCheck()
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'User logout', description: 'Invalidate refresh token and end session' })
  @ApiResponse({ status: 204, description: 'Logout successful' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async logout(
    @CurrentUser() user: CurrentUserData,
    @Body() body: { refreshToken?: string },
    @Req() req: Request,
  ): Promise<void> {
    const ipAddress = req.ip || req.socket.remoteAddress;
    const userAgent = req.headers['user-agent'];
    await this.authService.logout(user.userId, body.refreshToken, ipAddress, userAgent);
  }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Refresh tokens', description: 'Get new access token using refresh token' })
  @ApiResponse({ status: 200, description: 'New tokens issued' })
  @ApiResponse({ status: 401, description: 'Invalid or expired refresh token' })
  async refresh(@Body() dto: RefreshTokenDto, @Req() req: Request): Promise<RefreshResponseDto> {
    const ipAddress = req.ip || req.socket.remoteAddress;
    const userAgent = req.headers['user-agent'];
    return this.authService.refreshTokens(dto.refreshToken, ipAddress, userAgent);
  }

  @Post('exit-impersonation')
  @HttpCode(HttpStatus.NO_CONTENT)
  @SkipPermissionCheck()
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Exit impersonation', description: 'Super Admin exits tenant impersonation mode' })
  @ApiResponse({ status: 204, description: 'Impersonation ended' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async exitImpersonation(
    @CurrentUser() user: CurrentUserData,
    @Req() req: Request,
  ): Promise<void> {
    const ipAddress = req.ip || req.socket.remoteAddress;
    const userAgent = req.headers['user-agent'];
    await this.authService.exitImpersonation(user, ipAddress, userAgent);
  }
}

