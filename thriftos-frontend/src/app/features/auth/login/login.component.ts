/**
 * ===============================
 * LOGIN COMPONENT - PHASE 0
 * ===============================
 * 
 * DESIGN SYSTEM COMPLIANCE:
 * ✓ Uses app-page hierarchy
 * ✓ Uses app-form + app-form-field
 * ✓ Uses app-button
 * ✓ Uses app-card
 * ✓ NO custom layout
 * ✓ NO spacing utilities
 * ✓ NO tenant selector
 */

import { Component, signal, OnInit, DestroyRef, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { filter, take } from 'rxjs/operators';

// Design System Primitives ONLY
import {
  AppAuthLayoutComponent,
  AppBrandPanelComponent,
  AppSectionComponent,
  AppCardComponent,
  AppFormComponent,
  AppFormFieldComponent,
  AppButtonComponent,
  AppInputComponent,
  AppPasswordInputComponent,
  AppLinkComponent,
 } from '../../../shared/ui';

import { AuthService } from '../../../core/auth';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    // Design System Primitives
    AppAuthLayoutComponent,
    AppBrandPanelComponent,
    AppSectionComponent,
    AppCardComponent,
    AppFormComponent,
    AppFormFieldComponent,
    AppButtonComponent,
    AppInputComponent,
    AppPasswordInputComponent,
    AppLinkComponent,
  ],
  templateUrl: './login.component.html',
  styles: []
})
export class LoginComponent implements OnInit {
  protected readonly loginForm: FormGroup;
  protected readonly isLoading = signal<boolean>(false);
  protected readonly authError = signal<string>('');

  private readonly destroyRef = inject(DestroyRef);
  private returnUrl = '/';

  constructor(
    private readonly fb: FormBuilder,
    private readonly authService: AuthService,
    private readonly router: Router,
    private readonly route: ActivatedRoute
  ) {
    this.loginForm = this.fb.group({
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(6)]],
    });
  }

  ngOnInit(): void {
    // Get return URL from route parameters
    this.returnUrl = this.route.snapshot.queryParams['returnUrl'] || '/';

    // Check if already authenticated
    this.authService.waitForAuth().pipe(
      filter((ready) => ready),
      take(1),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe(() => {
      if (this.authService.isAuthenticated()) {
        this.redirectAfterLogin();
      }
    });
  }

  onSubmit(): void {
    if (this.loginForm.invalid) {
      this.markFormAsTouched();
      return;
    }

    this.isLoading.set(true);
    this.authError.set('');

    const { email, password } = this.loginForm.value;

    this.authService.login({ email, password }).subscribe({
      next: () => {
        this.isLoading.set(false);
        this.redirectAfterLogin();
      },
      error: (error) => {
        this.isLoading.set(false);
        this.authError.set(error?.message || 'Invalid email or password');
      },
    });
  }

  getEmailError(): string | undefined {
    const control = this.loginForm.get('email');
    if (control?.hasError('required') && control?.touched) {
      return 'Email is required';
    }
    if (control?.hasError('email') && control?.touched) {
      return 'Please enter a valid email';
    }
    return undefined;
  }

  getPasswordError(): string | undefined {
    const control = this.loginForm.get('password');
    if (control?.hasError('required') && control?.touched) {
      return 'Password is required';
    }
    if (control?.hasError('minlength') && control?.touched) {
      return 'Password must be at least 6 characters';
    }
    return undefined;
  }

  private markFormAsTouched(): void {
    Object.keys(this.loginForm.controls).forEach((key) => {
      this.loginForm.get(key)?.markAsTouched();
    });
  }

  private redirectAfterLogin(): void {
    const user = this.authService.user();
    const isSuperAdmin = this.authService.isSuperAdmin();
    const isImpersonating = this.authService.isImpersonating();

    const normalizeLegacy = (url: string): string => {
      if (!url || url === '/') return '/';
      // Legacy (pre /app) routes
      const legacyPrefixes = ['/dashboard', '/procurement', '/sorting', '/packaging', '/inventory', '/reports', '/admin'];
      if (!legacyPrefixes.some((p) => url.startsWith(p))) return url;

      if (url === '/dashboard') return '/app/dashboard';
      if (url.startsWith('/procurement')) return `/app${url}`;
      if (url.startsWith('/sorting')) return `/app${url}`;
      if (url.startsWith('/packaging')) return `/app${url}`;
      if (url.startsWith('/inventory')) return `/app${url}`;
      if (url.startsWith('/reports')) return `/app${url}`;
      // Tenant admin legacy routes now live under /app/admin
      if (url === '/admin') return '/app/admin';
      if (url.startsWith('/admin/')) return `/app${url}`;

      return url;
    };

    const requested = normalizeLegacy(this.returnUrl);

    if (isSuperAdmin && !isImpersonating) {
      // SuperAdmin is restricted to /admin/**
      if (requested.startsWith('/admin')) {
        void this.router.navigateByUrl(requested);
        return;
      }
      void this.router.navigate(['/admin']);
      return;
    }

    // Tenant user OR impersonating super admin: requires tenant context
    const effectiveTenantId = user?.tenantId ?? user?.impersonatedTenantId ?? null;
    if (!effectiveTenantId) {
      void this.router.navigate(['/auth/no-tenant']);
      return;
    }

    if (requested.startsWith('/app')) {
      void this.router.navigateByUrl(requested);
      return;
    }

    void this.router.navigate(['/app/dashboard']);
  }
}
