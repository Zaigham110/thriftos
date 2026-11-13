import { Component, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Api, Branch, Role, ROLE_LABEL, Session, Shop } from '../core';
import { Shelf } from '../offline/shelf';
import { Ask } from '../ui/ask';
import { Icon } from '../ui/icon';
import { Sheet } from '../ui/sheet';

const BACK = `<a routerLink="/manage" class="inline-flex min-h-[44px] items-center gap-1 text-sm font-semibold text-brand-700"><pos-icon name="back" size="h-4 w-4" /> Manage</a>`;

/** The business: what prints on the bill, tax, and how much discount a cashier may give. */
@Component({
  imports: [FormsModule, RouterLink, Icon],
  template: `
    <div class="screen max-w-2xl">
      ${BACK}
      <h1>Shop and tax</h1>
      <form class="mt-4 grid grid-cols-1 gap-4" (ngSubmit)="save()">
        <section class="card grid grid-cols-1 gap-3 p-4">
          <h2>On the bill</h2>
          <div><label class="label" for="sn">Shop name</label><input id="sn" class="input" name="name" [(ngModel)]="f.name" /></div>
          <div class="grid grid-cols-2 gap-3">
            <div><label class="label" for="sp">Phone</label><input id="sp" class="input" name="phone" inputmode="tel" [(ngModel)]="f.phone" /></div>
            <div><label class="label" for="sc">City</label><input id="sc" class="input" name="city" [(ngModel)]="f.city" /></div>
          </div>
          <div><label class="label" for="sa">Address</label><input id="sa" class="input" name="address" [(ngModel)]="f.address" /><p class="hint">A branch with its own address prints that instead.</p></div>
          <div><label class="label" for="sf">Last line of the bill</label><input id="sf" class="input" name="footer" [(ngModel)]="f.billFooter" placeholder="No return without the bill. Thank you." /></div>
        </section>
        <section class="card grid grid-cols-1 gap-3 p-4">
          <h2>Sales tax</h2>
          <div class="grid grid-cols-2 gap-3">
            <div><label class="label" for="tr">Tax rate %</label><input id="tr" class="input num" name="taxRate" inputmode="decimal" [(ngModel)]="f.taxRate" /><p class="hint">0 means no tax on bills.</p></div>
            <div><label class="label" for="tn">Name on the bill</label><input id="tn" class="input" name="taxName" [(ngModel)]="f.taxName" /></div>
          </div>
          <div class="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Prices">
            <button type="button" class="chip justify-center" [class.chip-on]="f.taxInclusive" (click)="f.taxInclusive = true" role="radio" [attr.aria-checked]="f.taxInclusive">Prices include tax</button>
            <button type="button" class="chip justify-center" [class.chip-on]="!f.taxInclusive" (click)="f.taxInclusive = false" role="radio" [attr.aria-checked]="!f.taxInclusive">Tax is added on top</button>
          </div>
          <div class="grid grid-cols-2 gap-3">
            <div><label class="label" for="nt">NTN</label><input id="nt" class="input" name="ntn" [(ngModel)]="f.ntn" /></div>
            <div><label class="label" for="st">STRN</label><input id="st" class="input" name="strn" [(ngModel)]="f.strn" /></div>
          </div>
        </section>
        <section class="card grid grid-cols-1 gap-3 p-4">
          <h2>Rules</h2>
          <div><label class="label" for="md">Most discount a cashier can give, %</label><input id="md" class="input num" name="max" inputmode="numeric" [(ngModel)]="f.cashierMaxDiscountPct" /><p class="hint">Managers and you can give more.</p></div>
          <label class="flex min-h-[44px] items-center gap-2 text-sm"><input type="checkbox" class="h-5 w-5 accent-brand-600" name="msc" [(ngModel)]="f.managerSeesCost" /> Managers can see cost and profit</label>
        </section>
        <button class="btn-big" [disabled]="busy()">{{ busy() ? 'Saving…' : 'Save' }}</button>
      </form>
    </div>
  `,
})
export class ShopSettingsPage {
  private readonly api = inject(Api);
  private readonly shelf = inject(Shelf);
  readonly busy = signal(false);
  f = { ...(this.api.shop() as Shop), taxRate: String(+(this.api.shop()?.taxRate ?? 0)) };

  async save() {
    this.busy.set(true);
    try {
      await this.api.patch('/shop', this.f);
      await this.api.reloadSession();
      void this.shelf.refresh();
      this.api.say('Saved.');
    } catch (e) {
      this.api.say(this.api.why(e), true);
    } finally {
      this.busy.set(false);
    }
  }
}

interface Staff {
  id: string;
  name: string;
  phone: string;
  role: Role;
  active: boolean;
  branchId: string | null;
}

/** People who can sign in: role, branch, password, PIN. */
@Component({
  imports: [FormsModule, RouterLink, Icon, Sheet],
  template: `
    <div class="screen max-w-2xl">
      ${BACK}
      <div class="flex items-center justify-between gap-3"><h1>Staff</h1><button class="btn-primary" (click)="start(null)"><pos-icon name="plus" /> Add a person</button></div>
      <div class="card mt-4 divide-y divide-stone-100">
        @for (s of staff(); track s.id) {
          <button class="row" (click)="start(s)">
            <span class="flex h-11 w-11 shrink-0 items-center justify-center rounded-full font-bold" [class]="s.active ? 'bg-brand-100 text-brand-800' : 'bg-stone-100 text-stone-400'">{{ s.name.slice(0, 1).toUpperCase() }}</span>
            <span class="min-w-0 flex-1"><span class="block truncate font-semibold" [class.text-stone-400]="!s.active">{{ s.name }}</span><span class="block text-xs text-stone-500">{{ s.phone }} · {{ branchName(s.branchId) }}</span></span>
            <span class="tag" [class]="s.active ? 'bg-stone-100 text-stone-700' : 'bg-red-50 text-red-800'">{{ s.active ? roles[s.role] : 'Stopped' }}</span>
          </button>
        }
      </div>
    </div>
    @if (open()) {
      <pos-sheet [heading]="editing() ? editing()!.name : 'Add a person'" (closed)="open.set(false)">
        <form class="grid grid-cols-1 gap-3" (ngSubmit)="save()">
          <div><label class="label" for="fn">Name</label><input id="fn" class="input" name="name" [(ngModel)]="f.name" /></div>
          @if (!editing()) { <div><label class="label" for="fp">Phone (they sign in with it)</label><input id="fp" class="input" name="phone" inputmode="tel" [(ngModel)]="f.phone" placeholder="0300 1234567" autocomplete="off" /></div> }
          @if (editing()?.role !== 'OWNER') {
            <div class="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Role">
              <button type="button" class="chip justify-center" [class.chip-on]="f.role === 'CASHIER'" (click)="f.role = 'CASHIER'" role="radio" [attr.aria-checked]="f.role === 'CASHIER'">Cashier</button>
              <button type="button" class="chip justify-center" [class.chip-on]="f.role === 'MANAGER'" (click)="f.role = 'MANAGER'" role="radio" [attr.aria-checked]="f.role === 'MANAGER'">Manager</button>
            </div>
            <p class="hint -mt-1">{{ f.role === 'MANAGER' ? 'A manager also does returns, cancels bills, sees reports and expenses, changes prices and sends stock.' : 'A cashier sells, takes khata payments and runs the drawer. Never sees cost.' }}</p>
            @if (branches().length > 1) { <div><label class="label" for="fb">Branch</label><select id="fb" class="input" name="branch" [(ngModel)]="f.branchId">@for (b of branches(); track b.id) { <option [value]="b.id">{{ b.name }}</option> }</select></div> }
          }
          <div class="grid grid-cols-2 gap-3">
            <div><label class="label" for="fw">{{ editing() ? 'New password' : 'Password' }}</label><input id="fw" class="input" name="password" type="password" [(ngModel)]="f.password" autocomplete="new-password" [placeholder]="editing() ? 'Leave empty to keep' : ''" /></div>
            <div><label class="label" for="fi">Till PIN (4 to 6 digits)</label><input id="fi" class="input num" name="pin" inputmode="numeric" maxlength="6" [(ngModel)]="f.pin" autocomplete="off" [placeholder]="editing() ? 'Leave empty to keep' : 'Optional'" /></div>
          </div>
          <button class="btn-big" [disabled]="busy()">{{ busy() ? 'Saving…' : 'Save' }}</button>
          @if (editing() && editing()!.role !== 'OWNER') {
            <button type="button" [class]="editing()!.active ? 'btn-danger' : 'btn-soft'" (click)="toggle()">{{ editing()!.active ? 'Stop this person signing in' : 'Let this person sign in again' }}</button>
          }
        </form>
      </pos-sheet>
    }
  `,
})
export class StaffPage implements OnInit {
  private readonly api = inject(Api);
  readonly roles = ROLE_LABEL;
  readonly staff = signal<Staff[]>([]);
  readonly branches = signal<Branch[]>(this.api.session()?.branches ?? []);
  readonly open = signal(false);
  readonly editing = signal<Staff | null>(null);
  readonly busy = signal(false);
  f = { name: '', phone: '', role: 'CASHIER' as Role, branchId: '', password: '', pin: '' };

  ngOnInit() {
    void this.load();
  }
  branchName(id: string | null) {
    return id ? (this.branches().find((b) => b.id === id)?.name ?? '') : 'Every branch';
  }
  async load() {
    try {
      this.staff.set(await this.api.get<Staff[]>('/shop/staff'));
    } catch (e) {
      this.api.say(this.api.why(e), true);
    }
  }
  start(s: Staff | null) {
    this.editing.set(s);
    this.f = { name: s?.name ?? '', phone: '', role: s?.role ?? 'CASHIER', branchId: s?.branchId ?? this.api.branch()?.id ?? '', password: '', pin: '' };
    this.open.set(true);
  }
  async save() {
    this.busy.set(true);
    try {
      const s = this.editing();
      if (s) await this.api.patch(`/shop/staff/${s.id}`, this.f);
      else await this.api.post('/shop/staff', this.f);
      this.open.set(false);
      await this.load();
    } catch (e) {
      this.api.say(this.api.why(e), true);
    } finally {
      this.busy.set(false);
    }
  }
  async toggle() {
    const s = this.editing()!;
    try {
      await this.api.patch(`/shop/staff/${s.id}`, { active: !s.active });
      this.open.set(false);
      await this.load();
    } catch (e) {
      this.api.say(this.api.why(e), true);
    }
  }
}

/** Branches and the tills (counters) in each. */
@Component({
  imports: [FormsModule, RouterLink, Icon, Sheet],
  template: `
    <div class="screen max-w-2xl">
      ${BACK}
      <div class="flex items-center justify-between gap-3"><h1>Branches and tills</h1><button class="btn-primary" (click)="start(null)"><pos-icon name="plus" /> Add a branch</button></div>
      @for (b of list(); track b.id) {
        <section class="card mt-4 p-4" [class.opacity-60]="b.active === false">
          <div class="flex items-start justify-between gap-3">
            <div><h2>{{ b.name }}{{ b.active === false ? ' (closed)' : '' }}</h2><p class="text-sm text-stone-500">{{ [b.address, b.city, b.phone].filter(truthy).join(' · ') || 'No address yet' }}</p></div>
            <button class="btn-soft min-h-[40px]" (click)="start(b)">Change</button>
          </div>
          <div class="mt-3 flex flex-wrap gap-2">
            @for (t of b.tills; track t.id) { <span class="chip min-h-[36px]"><span class="num font-bold">{{ t.code }}</span> {{ t.name }}</span> }
            <button class="chip min-h-[36px] border-dashed" (click)="addTill(b)"><pos-icon name="plus" size="h-4 w-4" /> Add a till</button>
          </div>
        </section>
      }
      <p class="hint mt-4">Each till numbers its own bills (T1-000001), so it can keep selling when the connection is down. Choose which till a device is in Manage, Printer and scanner.</p>
    </div>
    @if (open()) {
      <pos-sheet [heading]="editing() ? editing()!.name : 'Add a branch'" (closed)="open.set(false)">
        <form class="grid grid-cols-1 gap-3" (ngSubmit)="save()">
          <div><label class="label" for="bn">Branch name</label><input id="bn" class="input" name="name" [(ngModel)]="f.name" placeholder="Saddar shop" /></div>
          <div><label class="label" for="ba">Address</label><input id="ba" class="input" name="address" [(ngModel)]="f.address" /></div>
          <div class="grid grid-cols-2 gap-3">
            <div><label class="label" for="bc">City</label><input id="bc" class="input" name="city" [(ngModel)]="f.city" /></div>
            <div><label class="label" for="bp">Phone</label><input id="bp" class="input" name="phone" inputmode="tel" [(ngModel)]="f.phone" /></div>
          </div>
          <button class="btn-big" [disabled]="busy()">{{ busy() ? 'Saving…' : 'Save' }}</button>
          @if (editing() && editing()!.active !== false && list().length > 1) { <button type="button" class="btn-danger" (click)="close()">Close this branch</button> }
        </form>
      </pos-sheet>
    }
  `,
})
export class BranchesPage implements OnInit {
  private readonly api = inject(Api);
  private readonly ask = inject(Ask);
  readonly list = signal<Branch[]>([]);
  readonly open = signal(false);
  readonly editing = signal<Branch | null>(null);
  readonly busy = signal(false);
  readonly truthy = Boolean;
  f = { name: '', address: '', city: '', phone: '' };

  ngOnInit() {
    void this.load();
  }
  async load() {
    try {
      this.list.set(await this.api.get<Branch[]>('/shop/branches'));
      await this.api.reloadSession();
    } catch (e) {
      this.api.say(this.api.why(e), true);
    }
  }
  start(b: Branch | null) {
    this.editing.set(b);
    this.f = { name: b?.name ?? '', address: b?.address ?? '', city: b?.city ?? '', phone: b?.phone ?? '' };
    this.open.set(true);
  }
  private async run(work: () => Promise<unknown>) {
    this.busy.set(true);
    try {
      await work();
      this.open.set(false);
      await this.load();
    } catch (e) {
      this.api.say(this.api.why(e), true);
    } finally {
      this.busy.set(false);
    }
  }
  save() {
    const b = this.editing();
    return this.run(() => (b ? this.api.patch(`/shop/branches/${b.id}`, this.f) : this.api.post('/shop/branches', this.f)));
  }
  async close() {
    const b = this.editing()!;
    if (await this.ask.confirm(`Close ${b.name}?`, 'Its bills and history stay, but nobody can sell there any more.', 'Close the branch', true)) void this.run(() => this.api.patch(`/shop/branches/${b.id}`, { active: false }));
  }
  async addTill(b: Branch) {
    const answer = await this.ask.fields(`New till in ${b.name}`, 'Each till numbers its own bills.', [{ key: 'name', label: 'Name of the till', value: `Counter ${b.tills.length + 1}` }], 'Add the till');
    if (answer) void this.run(() => this.api.post(`/shop/branches/${b.id}/tills`, { name: answer['name'] }));
  }
}

/** A person's own till PIN. */
@Component({
  imports: [FormsModule, RouterLink, Icon],
  template: `
    <div class="screen max-w-md">
      ${BACK}
      <h1>My PIN</h1>
      <p class="mt-1 text-sm text-stone-600">With a PIN you can unlock this till, or take it over from someone else, without typing your phone number and password. {{ api.session()?.user?.hasPin ? 'You already have a PIN; this changes it.' : '' }}</p>
      <form class="card mt-4 grid grid-cols-1 gap-3 p-4" (ngSubmit)="save()">
        <input type="text" name="username" autocomplete="username" [value]="api.session()?.user?.phone ?? ''" hidden />
        <div><label class="label" for="pp">Your password</label><input id="pp" class="input" name="password" type="password" [(ngModel)]="password" autocomplete="current-password" /></div>
        <div><label class="label" for="pn">New PIN (4 to 6 digits)</label><input id="pn" class="input num text-xl tracking-[0.4em]" name="pin" type="password" inputmode="numeric" maxlength="6" [(ngModel)]="pin" autocomplete="off" /></div>
        <button class="btn-big" [disabled]="busy()">Save PIN</button>
      </form>
    </div>
  `,
})
export class MyPinPage {
  readonly api = inject(Api);
  readonly busy = signal(false);
  password = '';
  pin = '';

  async save() {
    this.busy.set(true);
    try {
      const fresh = await this.api.patch<Omit<Session, 'token'>>('/auth/me', { password: this.password, pin: this.pin });
      this.api.signIn({ token: this.api.session()!.token, ...fresh });
      this.password = this.pin = '';
      this.api.say('PIN saved.');
    } catch (e) {
      this.api.say(this.api.why(e), true);
    } finally {
      this.busy.set(false);
    }
  }
}
