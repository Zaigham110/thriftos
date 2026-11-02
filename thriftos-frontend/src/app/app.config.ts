/**
 * ===============================
 * APPLICATION CONFIGURATION - PHASE 0
 * ===============================
 */

import {
  ApplicationConfig,
  importProvidersFrom,
  isDevMode,
  provideBrowserGlobalErrorListeners,
  provideZoneChangeDetection,
} from '@angular/core';
import { provideRouter, withComponentInputBinding } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideServiceWorker } from '@angular/service-worker';
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
    // Installable, works offline: app shell and reference data are cached by the service worker.
    provideServiceWorker('ngsw-worker.js', {
      enabled: !isDevMode(),
      registrationStrategy: 'registerWhenStable:30000',
    }),
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
