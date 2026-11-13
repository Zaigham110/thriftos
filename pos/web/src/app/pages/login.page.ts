import { Component, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { Api, Session } from '../core';

/** Sign in. On a fresh install the same screen sets the shop up and makes its owner. */
@Component({
  imports: [FormsModule],
  template: `
    <div class="flex min-h-screen items-center justify-center px-4 py-10">
      <div class="w-full max-w-sm">
        <div class="mb-6 text-center">
          <div class="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-brand-600 text-white">
            <svg class="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 7h12l-1 13H7L6 7zm3 0V6a3 3 0 016 0v1" /></svg>
          </div>
          <h1>ThriftOS Shop</h1>
          <p class="mt-1 text-sm text-stone-600">{{ setup() ? 'Set up your shop. It takes a minute.' : 'Sign in to start selling.' }}</p>
        </div>

        @if (ready()) {
          <form class="card space-y-4 p-5" (ngSubmit)="submit()">
            @if (setup()) {
              <div>
                <label class="label" for="shop">Shop name</label>
                <input id="shop" class="input" name="shopName" [(ngModel)]="form.shopName" placeholder="Lunda Bazaar" autocomplete="organization" />
              </div>
              <div>
                <label class="label" for="city">City <span class="font-normal text-stone-400">(optional)</span></label>
                <input id="city" class="input" name="city" [(ngModel)]="form.city" placeholder="Lahore" />
              </div>
              <div>
                <label class="label" for="owner">Your name</label>
                <input id="owner" class="input" name="ownerName" [(ngModel)]="form.ownerName" autocomplete="name" />
              </div>
            }
            <div>
              <label class="label" for="phone">{{ setup() ? 'Your phone' : 'Phone' }}</label>
              <input id="phone" class="input" name="phone" [(ngModel)]="form.phone" inputmode="tel" placeholder="0300 1234567" autocomplete="username" />
              @if (setup()) {
                <p class="hint">You sign in with this number.</p>
              }
            </div>
            <div>
              <label class="label" for="password">Password</label>
              <input id="password" class="input" name="password" type="password" [(ngModel)]="form.password" [autocomplete]="setup() ? 'new-password' : 'current-password'" />
              @if (setup()) {
                <p class="hint">6 letters or numbers at least.</p>
              }
            </div>
            @if (error()) {
              <p class="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800" role="alert">{{ error() }}</p>
            }
            <button class="btn-big" [disabled]="busy()">{{ busy() ? 'Please wait…' : setup() ? 'Create my shop' : 'Sign in' }}</button>
          </form>
        } @else if (error()) {
          <div class="card p-5 text-center">
            <p class="text-sm text-red-800" role="alert">{{ error() }}</p>
            <button class="btn-soft mt-4" (click)="ngOnInit()">Try again</button>
          </div>
        }
      </div>
    </div>
  `,
})
export class LoginPage implements OnInit {
  private readonly api = inject(Api);
  private readonly router = inject(Router);

  readonly ready = signal(false);
  readonly setup = signal(false);
  readonly busy = signal(false);
  readonly error = signal('');
  form = { shopName: '', city: '', ownerName: '', phone: '', password: '' };

  async ngOnInit() {
    if (this.api.session()) return void this.router.navigateByUrl('/');
    this.error.set('');
    try {
      this.setup.set((await this.api.get<{ needsSetup: boolean }>('/auth/status')).needsSetup);
      this.ready.set(true);
    } catch (e) {
      this.error.set(this.api.why(e));
    }
  }

  async submit() {
    this.busy.set(true);
    this.error.set('');
    try {
      const session = await this.api.post<Session>(this.setup() ? '/auth/setup' : '/auth/login', this.form);
      this.api.signIn(session);
      await this.router.navigateByUrl(this.setup() ? '/shipments/new' : '/');
    } catch (e) {
      this.error.set(this.api.why(e));
    } finally {
      this.busy.set(false);
    }
  }
}
