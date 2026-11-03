/**
 * ===============================
 * APPLICATION CONFIGURATION - PHASE 0
 * ===============================
 */

import {
  ApplicationConfig,
  ErrorHandler,
  importProvidersFrom,
  isDevMode,
  inject,
  provideAppInitializer,
  provideBrowserGlobalErrorListeners,
  provideZoneChangeDetection,
} from '@angular/core';
import { provideRouter, withComponentInputBinding } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideServiceWorker } from '@angular/service-worker';
import { basePathInterceptor } from './core/http/base-path.interceptor';
import { ReportErrorsHandler } from './core/monitoring/report-errors.handler';
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
import { I18nService } from './core/i18n/i18n.service';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(routes, withComponentInputBinding()),
    provideHttpClient(withInterceptors([basePathInterceptor, authInterceptor])),
    { provide: ErrorHandler, useClass: ReportErrorsHandler },
    // Dictionaries are loaded before the first screen, so no English flashes before Urdu.
    provideAppInitializer(() => inject(I18nService).init()),
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
