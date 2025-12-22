/**
 * Auth Models - Type definitions for authentication
 * Phase 1: Authentication & Shell
 */

export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  user: {
    id: string;
    email: string;
    name: string;
    tenantId: string | null;
    isSuperAdmin: boolean;
  };
}

export interface RefreshResponse {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface User {
  id: string;
  email: string;
  name: string;
  tenantId: string | null;
  isSuperAdmin: boolean;
  impersonatedTenantId: string | null;
}

export interface MeResponse {
  user: User;
  permissions: string[];
}

export interface AuthState {
  user: User | null;
  permissions: string[];
  isAuthenticated: boolean;
  isLoading: boolean;
  isImpersonating: boolean;
  authReady: boolean;
  impersonationReady: boolean;
}

export interface ImpersonationResponse {
  accessToken: string;
  refreshToken?: string;
  expiresIn: number;
}
