/**
 * Login Component - ThriftOS Enterprise ERP
 * 
 * High-density modern authentication screen.
 * Complies with ThriftOS Design System & Brand Guidelines (#714b67 deep plum purple).
 */

import { Component, signal, OnInit, DestroyRef, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { filter, take } from 'rxjs/operators';
import {
  LucideAngularModule,
  Mail,
  Lock,
  Eye,
  EyeOff,
  ArrowRight,
  Loader2,
  ShieldCheck,
  CheckCircle2,
  Layers,
  Building2,
  Sparkles,
  AlertCircle,
  Truck,
  BarChart3,
} from 'lucide-angular';

import { AuthService } from '../../../core/auth';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    LucideAngularModule,
  ],
  templateUrl: './login.component.html',
  styleUrl: './login.component.scss',
})
export class LoginComponent implements OnInit {
  protected readonly loginForm: FormGroup;
  protected readonly isLoading = signal<boolean>(false);
  protected readonly authError = signal<string>('');
  protected readonly showPassword = signal<boolean>(false);

  readonly icons = {
    Mail,
    Lock,
    Eye,
    EyeOff,
    ArrowRight,
    Loader2,
    ShieldCheck,
    CheckCircle2,
    Layers,
    Building2,
    Sparkles,
    AlertCircle,
    Truck,
    BarChart3,
  };

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
      rememberMe: [true],
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

  togglePasswordVisibility(): void {
    this.showPassword.update((val) => !val);
  }

  fillDemoCredentials(role: 'admin' | 'sorter' | 'sales'): void {
    const creds = {
      admin: { email: 'admin@thriftos.com', password: 'password123' },
      sorter: { email: 'sorter@thriftos.com', password: 'password123' },
      sales: { email: 'sales@thriftos.com', password: 'password123' },
    };
    const chosen = creds[role] || creds.admin;
    this.loginForm.patchValue(chosen);
    this.authError.set('');
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
        this.authError.set(error?.message || 'Invalid email or password. Please check your credentials.');
      },
    });
  }

  getEmailError(): string | undefined {
    const control = this.loginForm.get('email');
    if (control?.hasError('required') && control?.touched) {
      return 'Email address is required';
    }
    if (control?.hasError('email') && control?.touched) {
      return 'Please enter a valid email address';
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
      const legacyPrefixes = ['/dashboard', '/procurement', '/sorting', '/packaging', '/inventory', '/reports', '/admin'];
      if (!legacyPrefixes.some((p) => url.startsWith(p))) return url;

      if (url === '/dashboard') return '/app/dashboard';
      if (url.startsWith('/procurement')) return `/app${url}`;
      if (url.startsWith('/sorting')) return `/app${url}`;
      if (url.startsWith('/packaging')) return `/app${url}`;
      if (url.startsWith('/inventory')) return `/app${url}`;
      if (url.startsWith('/reports')) return `/app${url}`;
      if (url === '/admin') return '/app/admin';
      if (url.startsWith('/admin/')) return `/app${url}`;

      return url;
    };

    const requested = normalizeLegacy(this.returnUrl);

    if (isSuperAdmin && !isImpersonating) {
      if (requested.startsWith('/admin')) {
        void this.router.navigateByUrl(requested);
        return;
      }
      void this.router.navigate(['/admin']);
      return;
    }

    const effectiveTenantId = user?.tenantId ?? user?.impersonatedTenantId ?? null;
    if (!effectiveTenantId) {
      void this.router.navigate(['/auth/no-tenant']);
      return;
    }

    if (requested.startsWith('/app')) {
      void this.router.navigateByUrl(requested);
      return;
    }

    void this.router.navigate([this.isOperationalUser() ? '/app/lite/home' : '/app/dashboard']);
  }

  private isOperationalUser(): boolean {
    const operationalPrefixes = ['rag.', 'sorting.', 'repack.', 'inventory.', 'sales.'];
    return this.authService.permissions().some((permission) =>
      operationalPrefixes.some((prefix) => permission.startsWith(prefix)),
    );
  }
}
