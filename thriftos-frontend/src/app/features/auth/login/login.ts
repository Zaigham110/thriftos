/**
 * Login Component - Authentication form with backend integration
 * Phase 1: Authentication & Shell
 */

import { ChangeDetectionStrategy, Component, signal, OnInit, DestroyRef, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { filter, take } from 'rxjs/operators';
import { ButtonComponent } from '../../../shared/ui/button/button';
import { InputComponent } from '../../../shared/ui/input/input';
import { CheckboxComponent } from '../../../shared/ui/checkbox/checkbox';
import { AlertComponent } from '../../../shared/ui/alert/alert';
import { AuthService } from '../../../core/auth';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    ButtonComponent,
    InputComponent,
    CheckboxComponent,
    AlertComponent,
  ],
  templateUrl: './login.html',
  styleUrl: './login.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LoginComponent implements OnInit {
  protected readonly loginForm: FormGroup;
  protected readonly isLoading = signal<boolean>(false);
  protected readonly showPassword = signal<boolean>(false);
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly isCheckingAuth = signal<boolean>(true);

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
      rememberMe: [false],
    });
  }

  ngOnInit(): void {
    // Get return URL from route parameters
    this.returnUrl = this.route.snapshot.queryParams['returnUrl'] || '/';

    // Wait for auth initialization before checking auth state
    this.authService.waitForAuth().pipe(
      filter((ready) => ready),
      take(1),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe(() => {
      this.isCheckingAuth.set(false);
      // If already authenticated, redirect
      if (this.authService.isAuthenticated()) {
        this.redirectAfterLogin();
      }
    });
  }

  togglePasswordVisibility(): void {
    this.showPassword.update((v) => !v);
  }

  onSubmit(): void {
    if (this.loginForm.invalid) {
      return;
    }

    this.isLoading.set(true);
    this.errorMessage.set(null);

    const { email, password } = this.loginForm.value;

    this.authService.login({ email, password }).subscribe({
      next: () => {
        this.isLoading.set(false);
        this.redirectAfterLogin();
      },
      error: (error) => {
        this.isLoading.set(false);
        this.errorMessage.set(error.message || 'Login failed. Please try again.');
      },
    });
  }

  private redirectAfterLogin(): void {
    if (this.authService.isSuperAdmin() && !this.authService.isImpersonating()) {
      // Super Admin goes to tenant management
      this.router.navigate(['/admin/super/tenants']);
    } else if (this.returnUrl && this.returnUrl !== '/') {
      // Go to return URL if specified
      this.router.navigateByUrl(this.returnUrl);
    } else {
      // Default to dashboard
      this.router.navigate(['/app/dashboard']);
    }
  }

  dismissError(): void {
    this.errorMessage.set(null);
  }
}
