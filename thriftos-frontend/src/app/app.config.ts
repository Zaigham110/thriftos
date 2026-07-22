/**
 * ===============================
 * APPLICATION CONFIGURATION - PHASE 0
 * ===============================
 */

import {
  ApplicationConfig,
  importProvidersFrom,
  provideBrowserGlobalErrorListeners,
  provideZoneChangeDetection,
} from '@angular/core';
import { provideRouter, withComponentInputBinding } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import {
  LucideAngularModule,
  Users,
  UserCheck,
  UserX,
  Shield,
  Search,
  Plus,
  RefreshCw,
  Pencil,
  KeyRound,
  Ban,
  CheckCircle2,
  X,
  Filter,
} from 'lucide-angular';

import { routes } from './app.routes';
import { authInterceptor } from './core/auth/auth.interceptor';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(routes, withComponentInputBinding()),
    provideHttpClient(withInterceptors([authInterceptor])),
    importProvidersFrom(
      LucideAngularModule.pick({
        Users,
        UserCheck,
        UserX,
        Shield,
        Search,
        Plus,
        RefreshCw,
        Pencil,
        KeyRound,
        Ban,
        CheckCircle2,
        X,
        Filter,
      })
    ),
  ],
};
