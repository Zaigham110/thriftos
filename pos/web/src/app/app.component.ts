import { Component, computed, effect, HostListener, inject, signal } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { SwUpdate } from '@angular/service-worker';
import { Api, ROLE_LABEL, Role, Session } from './core';
import { Scanner } from './hardware/scanner';
import { Shelf } from './offline/shelf';
import { Ask } from './ui/ask';
import { AskHost } from './ui/ask';
import { Icon, IconName } from './ui/icon';
import { Numpad } from './ui/numpad';
import { PrintHost } from './ui/print-host';
import { Sheet } from './ui/sheet';

const NAV: { path: string; label: string; icon: IconName; exact?: boolean }[] = [
  { path: '/', label: 'Till', icon: 'till', exact: true },
  { path: '/bills', label: 'Bills', icon: 'bills' },
  { path: '/stock', label: 'Stock', icon: 'stock' },
  { path: '/customers', label: 'Khata', icon: 'people' },
  { path: '/manage', label: 'Manage', icon: 'manage' },
];
const LOCK = 'thriftos-pos-locked';

/**
 * The frame around every screen: a slim rail on tablets and laptops, a bottom bar on phones, the offline banner, the
 * print host, and the lock screen of a shared till.
 */
@Component({
  selector: 'pos-root',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, Icon, Sheet, Numpad, PrintHost, AskHost],
  template: `
    @if (api.session(); as s) {
      <div class="no-print flex h-dvh flex-col md:flex-row">
        <!-- Tablet and laptop: rail -->
        <aside class="hidden w-[84px] shrink-0 flex-col items-center bg-brand-950 py-3 text-brand-200 md:flex">
          <div class="mb-3 flex h-11 w-11 items-center justify-center rounded-2xl bg-brand-600 text-white" [title]="s.shop.name"><pos-icon name="store" size="h-6 w-6" /></div>
          <nav class="flex flex-1 flex-col gap-1" aria-label="Main">
            @for (item of nav; track item.path) {
              <a
                [routerLink]="item.path"
                routerLinkActive="!bg-white/15 !text-white"
                [routerLinkActiveOptions]="{ exact: !!item.exact }"
                class="relative flex h-[64px] w-[68px] flex-col items-center justify-center gap-1 rounded-2xl text-[11px] font-semibold transition hover:bg-white/10 hover:text-white"
              >
                <pos-icon [name]="item.icon" size="h-6 w-6" />
                {{ item.label }}
                @if (item.path === '/bills' && badge()) {
                  <span class="absolute right-2 top-2 h-2.5 w-2.5 rounded-full bg-amber-400"></span>
                }
              </a>
            }
          </nav>
          <button class="flex h-12 w-12 items-center justify-center rounded-full bg-white/10 text-base font-bold text-white transition hover:bg-white/20" (click)="menu.set(true)" [attr.aria-label]="'Signed in as ' + s.user.name">
            {{ s.user.name.slice(0, 1).toUpperCase() }}
          </button>
          <div class="mt-2 flex items-center gap-1 text-[10px] font-semibold" [class]="shelf.online() ? 'text-emerald-300' : 'text-amber-300'">
            <span class="h-2 w-2 rounded-full" [class]="shelf.online() ? 'bg-emerald-400' : 'bg-amber-400'"></span>{{ shelf.online() ? 'Online' : 'Offline' }}
          </div>
        </aside>

        <div class="flex min-h-0 min-w-0 flex-1 flex-col">
          @if (!shelf.online() || shelf.waiting().length) {
            <div class="flex shrink-0 items-center justify-center gap-2 px-3 py-1.5 text-center text-xs font-semibold" [class]="shelf.stuck() ? 'bg-red-600 text-white' : 'bg-amber-300 text-amber-950'" role="status">
              <pos-icon name="cloudOff" size="h-4 w-4" />
              {{ banner() }}
            </div>
          }
          <main class="min-h-0 flex-1 overflow-y-auto">
            <router-outlet />
          </main>

          <!-- Phone: bottom bar -->
          <nav class="flex shrink-0 border-t border-stone-200 bg-white pb-[env(safe-area-inset-bottom)] md:hidden" aria-label="Main">
            @for (item of nav; track item.path) {
              <a
                [routerLink]="item.path"
                routerLinkActive="!text-brand-700"
                [routerLinkActiveOptions]="{ exact: !!item.exact }"
                class="relative flex min-h-[58px] flex-1 flex-col items-center justify-center gap-0.5 text-[11px] font-semibold text-stone-500"
              >
                <pos-icon [name]="item.icon" size="h-6 w-6" />
                {{ item.label }}
                @if (item.path === '/bills' && badge()) {
                  <span class="absolute right-1/4 top-2 h-2.5 w-2.5 rounded-full bg-amber-500"></span>
                }
              </a>
            }
          </nav>
        </div>
      </div>

      @if (menu()) {
        <pos-sheet [heading]="s.user.name" (closed)="menu.set(false)">
          <p class="-mt-1 text-sm text-stone-500">{{ roles[s.user.role] }} · {{ s.shop.name }}</p>
          @if (s.branches.length > 1) {
            <label class="label mt-4" for="branch">Branch</label>
            <select id="branch" class="input" [value]="api.branch()?.id" (change)="branch($any($event.target).value)">
              @for (b of s.branches; track b.id) {
                <option [value]="b.id">{{ b.name }}</option>
              }
            </select>
          } @else {
            <p class="mt-3 text-sm"><span class="text-stone-500">Branch</span> <span class="font-semibold">{{ api.branch()?.name }}</span> · <span class="text-stone-500">Till</span> <span class="font-semibold">{{ api.till()?.name }}</span></p>
          }
          <div class="mt-5 grid grid-cols-1 gap-2">
            <button class="btn-soft justify-start" (click)="lock()"><pos-icon name="lock" /> Lock the till / change person</button>
            <button class="btn-soft justify-start" (click)="menu.set(false); api.signOut()"><pos-icon name="out" /> Sign out of this device</button>
          </div>
        </pos-sheet>
      }

      @if (locked()) {
        <div class="no-print fixed inset-0 z-50 flex flex-col items-center justify-center bg-brand-950 px-5 text-white" role="dialog" aria-modal="true" aria-label="Till is locked">
          <div class="w-full max-w-xs">
            <div class="text-center text-sm font-semibold uppercase tracking-widest text-brand-300">{{ s.shop.name }}</div>
            @if (!who()) {
              <h1 class="mt-1 text-center text-2xl">Who is at the till?</h1>
              <div class="mt-6 grid grid-cols-1 gap-2">
                @for (p of people(); track p.id) {
                  <button class="flex min-h-[60px] items-center gap-3 rounded-2xl bg-white/10 px-4 text-left transition hover:bg-white/20" (click)="who.set(p); pin.set(''); lockError.set('')">
                    <span class="flex h-10 w-10 items-center justify-center rounded-full bg-brand-600 font-bold">{{ p.name.slice(0, 1).toUpperCase() }}</span>
                    <span><span class="block font-semibold">{{ p.name }}</span><span class="text-xs text-brand-300">{{ roles[p.role] }}</span></span>
                  </button>
                } @empty {
                  <p class="rounded-2xl bg-white/10 p-4 text-center text-sm text-brand-100">{{ lockError() || 'Nobody has a till PIN yet. Sign in with the phone number and password, then set a PIN in Manage.' }}</p>
                }
              </div>
              <button class="mt-6 w-full text-center text-sm font-semibold text-brand-300 underline" (click)="api.signOut(); unlock()">Sign in with phone and password instead</button>
            } @else {
              <h1 class="mt-1 text-center text-2xl">{{ who()!.name }}</h1>
              <div class="my-5 flex justify-center gap-3" aria-label="PIN">
                @for (i of [0, 1, 2, 3, 4, 5]; track i) {
                  <span class="h-3.5 w-3.5 rounded-full" [class]="i < pin().length ? 'bg-white' : i < 4 ? 'bg-white/25' : 'bg-white/10'"></span>
                }
              </div>
              @if (lockError()) {
                <p class="mb-3 rounded-xl bg-red-600 px-3 py-2 text-center text-sm font-medium" role="alert">{{ lockError() }}</p>
              }
              <div class="rounded-3xl bg-white p-3 text-stone-900"><pos-numpad (key)="pinKey($event)" /></div>
              <div class="mt-3 grid grid-cols-2 gap-2">
                <button class="btn bg-white/10 text-white" (click)="who.set(null)">Back</button>
                <button class="btn bg-pay-600 text-white" [disabled]="pin().length < 4 || busy()" (click)="enter()">{{ busy() ? 'Checking…' : 'Unlock' }}</button>
              </div>
            }
          </div>
        </div>
      }
    } @else {
      <div class="no-print h-dvh overflow-y-auto"><router-outlet /></div>
    }

    <pos-ask />
    <pos-print-host />

    @if (api.toast(); as t) {
      <div class="no-print pointer-events-none fixed inset-x-0 bottom-24 z-[60] flex justify-center px-4 md:bottom-8" role="status">
        <div class="max-w-md rounded-2xl px-4 py-3 text-sm font-semibold text-white shadow-lift" [class]="t.bad ? 'bg-red-700' : 'bg-stone-900'">{{ t.text }}</div>
      </div>
    }
  `,
})
export class AppComponent {
  readonly api = inject(Api);
  readonly shelf = inject(Shelf);
  readonly nav = NAV;
  readonly roles = ROLE_LABEL;

  readonly menu = signal(false);
  readonly locked = signal(localStorage.getItem(LOCK) === '1');
  readonly people = signal<{ id: string; name: string; role: Role }[]>([]);
  readonly who = signal<{ id: string; name: string; role: Role } | null>(null);
  readonly pin = signal('');
  readonly lockError = signal('');
  readonly busy = signal(false);

  /** A dot on Bills: something there wants attention. */
  readonly badge = computed(() => this.shelf.waiting().length > 0 || (this.shelf.snap()?.review ?? 0) > 0);
  readonly banner = computed(() => {
    const n = this.shelf.waiting().length;
    const stuck = this.shelf.stuck();
    if (stuck) return `${stuck} ${stuck === 1 ? 'bill' : 'bills'} could not be saved. Open Bills to see why.`;
    if (!this.shelf.online()) return n ? `Working offline. ${n} waiting to be sent when the shop server is back.` : 'Working offline. Bills are kept on this device and sent when the shop server is back.';
    return `Sending ${n} saved ${n === 1 ? 'bill' : 'bills'}…`;
  });

  constructor() {
    // Signed in (or another person took over): load the till's copy of stock for this branch.
    effect(() => {
      if (this.api.session()) void this.shelf.start();
    });
    if (this.locked()) void this.loadPeople();
    const ask = inject(Ask);
    inject(Scanner).blocked = () => this.locked() || !!ask.question();

    // A newer version of the app has been fetched in the background: use it now, unless a bill is being made.
    const updates = inject(SwUpdate);
    if (updates.isEnabled) {
      updates.versionUpdates.subscribe((event) => {
        if (event.type !== 'VERSION_READY') return;
        // Never in the middle of a bill: the till loads the new version when the bill is done.
        if (localStorage.getItem('thriftos-pos-cart')) this.api.updateReady = true;
        else location.reload();
      });
      setInterval(() => void updates.checkForUpdate().catch(() => undefined), 30 * 60_000);
    }
  }

  branch(id: string) {
    this.api.setBranch(id);
    this.menu.set(false);
    void this.shelf.refresh();
    location.assign('/'); // every screen now belongs to the other branch
  }

  private async loadPeople() {
    try {
      this.people.set(await this.api.get('/auth/people'));
      this.lockError.set('');
    } catch (e) {
      this.lockError.set(this.api.unreachable(e) ? 'The shop server cannot be reached, so a PIN cannot be checked right now.' : this.api.why(e));
    }
  }

  lock() {
    this.menu.set(false);
    this.who.set(null);
    this.pin.set('');
    localStorage.setItem(LOCK, '1');
    this.locked.set(true);
    void this.loadPeople();
  }

  unlock() {
    localStorage.removeItem(LOCK);
    this.locked.set(false);
  }

  /** A keyboard till types the PIN: digits, Backspace, Enter. */
  @HostListener('document:keydown', ['$event'])
  lockKeys(e: KeyboardEvent) {
    if (!this.locked() || !this.who() || e.ctrlKey || e.metaKey || e.altKey) return;
    if (/^\d$/.test(e.key)) this.pinKey(e.key);
    else if (e.key === 'Backspace') this.pinKey('back');
    else if (e.key === 'Enter' && this.pin().length >= 4 && !this.busy()) void this.enter();
    else if (e.key === 'Escape') this.who.set(null);
    else return;
    e.preventDefault();
  }

  pinKey(key: string) {
    if (key === 'back') this.pin.set(this.pin().slice(0, -1));
    else if (/^\d$/.test(key)) this.pin.set((this.pin() + key).slice(0, 6));
    this.lockError.set('');
  }

  async enter() {
    this.busy.set(true);
    try {
      this.api.signIn(await this.api.post<Session>('/auth/pin', { userId: this.who()!.id, pin: this.pin() }));
      this.unlock();
      void this.shelf.refresh();
    } catch (e) {
      this.pin.set('');
      this.lockError.set(this.api.why(e));
    } finally {
      this.busy.set(false);
    }
  }
}
