import { HttpClient } from '@angular/common/http';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AuthService } from '../../core/auth';
import { API_BASE_URL } from '../../core/config/api.config';
import { I18nService } from '../../core/i18n/i18n.service';
import { TPipe } from '../../core/i18n/t.pipe';
import { ToastService } from '../../shared/floor/toast.service';
import { WsPageHeaderComponent, WsStateComponent } from '../../shared/ui/workspace';
import { BUILT_IN_ROLES, roleName } from './roles';

interface Permission { id: string; code: string; name: string; group: string }
interface Role { id: string; name: string; _count?: { userRoles: number }; rolePermissions?: { permissionId: string; permission?: Permission }[] }

/** Platform-only abilities a business never grants (creating or deleting businesses). */
const HIDDEN = ['tenant.create', 'tenant.read', 'tenant.delete'];
/** Groups in the order an owner thinks of the work; anything else comes after. */
const GROUP_ORDER = ['Procurement', 'Sorting', 'Grading', 'Repack', 'Inventory', 'Sales', 'Finance', 'Reports', 'Data', 'Configuration', 'User Management', 'Role Management', 'Super Admin'];
const groupKey = (g: string) => g.replace(/\s+/g, '');

/** "SORTING_STAGE1_VIEW" → object SORTING_STAGE1, verb VIEW; "sort.session.close" → sort_session, close. */
function parts(code: string): { obj: string; verb: string } {
  if (code.includes('.')) {
    const i = code.lastIndexOf('.');
    return { obj: code.slice(0, i).replace(/\./g, '_'), verb: code.slice(i + 1) };
  }
  const i = code.lastIndexOf('_');
  return { obj: code.slice(0, i), verb: code.slice(i + 1).toLowerCase() };
}

/**
 * Settings → Advanced → Roles (v2 review): the business's roles in plain words with how many people have each,
 * and per role what it may do, grouped by the work (receiving, sorting, stock, money…) in the person's language.
 * The owner's role can do everything and is not changed here; people get their role on Team.
 */
@Component({
  selector: 'app-roles',
  standalone: true,
  imports: [FormsModule, RouterLink, TPipe, WsPageHeaderComponent, WsStateComponent],
  template: `
    <div class="page">
      @if (roleId(); as id) {
        @if (role(); as r) {
          <ws-page-header [heading]="'ws.roles.canDo' | t: { role: name(r.name) }" [subtitle]="'ws.roles.canDoHint' | t" />
          @if (r.name === 'Admin') {
            <p class="note">{{ 'ws.roles.ownerAll' | t }}</p>
          } @else {
            <div class="bar">
              <span>{{ 'ws.roles.chosen' | t: { n: chosen().size } }}</span>
              <span class="btns">
                <a class="ws-btn" routerLink="/settings/admin/roles">{{ 'common.cancel' | t }}</a>
                <button type="button" class="ws-btn ws-btn-primary" (click)="save(r)" [disabled]="busy() || !canEdit()">{{ 'common.save' | t }}</button>
              </span>
            </div>
          }
          @for (g of groups(); track g.name) {
            <section class="group">
              <h2>
                <label><input type="checkbox" [checked]="allIn(g.perms)" [disabled]="locked(r)" (change)="setAll(g.perms, $any($event.target).checked)" /> {{ groupName(g.name) }}</label>
              </h2>
              <div class="perms">
                @for (p of g.perms; track p.id) {
                  <label><input type="checkbox" [checked]="chosen().has(p.id)" [disabled]="locked(r)" (change)="flip(p.id)" /> {{ permName(p) }}</label>
                }
              </div>
            </section>
          }
        } @else if (failed()) {
          <ws-state kind="error" [heading]="'common.couldNotLoad' | t" (retry)="load()" />
        } @else {
          <ws-state kind="loading" />
        }
      } @else {
        <ws-page-header [heading]="'ws.roles.title' | t" [subtitle]="'ws.roles.hint' | t" />
        @if (canCreate()) {
          <form class="add" (ngSubmit)="create()">
            <label>{{ 'ws.roles.newName' | t }}<input name="newName" [(ngModel)]="newName" maxlength="60" /></label>
            <button type="submit" class="ws-btn ws-btn-primary" [disabled]="newName.trim().length < 2 || busy()">{{ 'ws.roles.add' | t }}</button>
          </form>
        }
        @if (failed()) {
          <ws-state kind="error" [heading]="'common.couldNotLoad' | t" (retry)="load()" />
        } @else {
          <ul class="rows">
            @for (r of roles(); track r.id) {
              <li>
                <span class="what"><strong>{{ name(r.name) }}</strong><small>{{ ((r._count?.userRoles ?? 0) === 1 ? 'ws.roles.peopleOne' : 'ws.roles.people') | t: { n: r._count?.userRoles ?? 0 } }}</small></span>
                <span class="btns">
                  <a class="ws-btn" [routerLink]="['/settings/admin/roles', r.id]">{{ 'ws.roles.whatCan' | t }}</a>
                  @if (canDelete() && !builtIn(r.name) && !(r._count?.userRoles)) { <button type="button" class="ws-btn" (click)="remove(r)">{{ 'ws.names.remove' | t }}</button> }
                </span>
              </li>
            }
          </ul>
          <p class="note">{{ 'ws.roles.teamNote' | t }} <a routerLink="/settings/team">{{ 'settings.team' | t }}</a></p>
        }
      }
    </div>
  `,
  styles: [`
    .page { display:grid; gap:var(--ws-4); max-width:860px; margin-inline:auto; font-family:var(--ws-font); color:var(--ws-ink); }
    .rows { list-style:none; margin:0; padding:0; border:1px solid var(--ws-line); border-radius:var(--ws-r-lg); background:var(--ws-surface); overflow:hidden; }
    .rows li { display:flex; flex-wrap:wrap; align-items:center; justify-content:space-between; gap:var(--ws-2); padding:var(--ws-3) var(--ws-4); }
    .rows li + li { border-top:1px solid var(--ws-line); }
    .what { display:grid; gap:2px; }
    .what small, .note { color:var(--ws-ink-2); font-size:var(--ws-text-sm); }
    .note { margin:0; }
    .btns { display:flex; flex-wrap:wrap; gap:var(--ws-2); }
    form.add { display:flex; flex-wrap:wrap; align-items:flex-end; gap:var(--ws-3); padding:var(--ws-4); border:1px solid var(--ws-line); border-radius:var(--ws-r-lg); background:var(--ws-surface); }
    form.add label { display:grid; gap:4px; flex:1 1 200px; color:var(--ws-ink-2); font-size:var(--ws-text-sm); }
    input:not([type=checkbox]) { height:var(--ws-control-h); padding-inline:var(--ws-2); border:1px solid var(--ws-line); border-radius:var(--ws-r-md); background:var(--ws-surface); color:var(--ws-ink); font:inherit; }
    .bar { position:sticky; top:0; z-index:1; display:flex; flex-wrap:wrap; align-items:center; justify-content:space-between; gap:var(--ws-2); padding:var(--ws-2) var(--ws-3); border:1px solid var(--ws-line); border-radius:var(--ws-r-md); background:var(--ws-surface); }
    .group { padding:var(--ws-3) var(--ws-4); border:1px solid var(--ws-line); border-radius:var(--ws-r-lg); background:var(--ws-surface); }
    .group h2 { margin:0 0 var(--ws-2); font-size:var(--ws-text-md, 15px); }
    .perms { display:grid; grid-template-columns:repeat(auto-fill, minmax(240px, 1fr)); gap:var(--ws-2) var(--ws-4); }
    label { display:flex; align-items:center; gap:var(--ws-2); }
    input[type=checkbox] { width:18px; height:18px; accent-color:var(--ws-brand); }
  `],
})
export class RolesComponent implements OnInit {
  private readonly http = inject(HttpClient);
  private readonly i18n = inject(I18nService);
  private readonly toast = inject(ToastService);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  protected readonly roleId = signal<string | null>(inject(ActivatedRoute).snapshot.paramMap.get('id'));
  protected readonly roles = signal<Role[]>([]);
  protected readonly role = signal<Role | null>(null);
  protected readonly perms = signal<Permission[]>([]);
  protected readonly chosen = signal<Set<string>>(new Set());
  protected readonly failed = signal(false);
  protected readonly busy = signal(false);
  protected readonly canCreate = computed(() => this.auth.hasPermission('role.create'));
  protected readonly canEdit = computed(() => this.auth.hasPermission('role.update'));
  protected readonly canDelete = computed(() => this.auth.hasPermission('role.delete'));
  protected newName = '';

  /** Groups with their abilities, platform-only ones left out; "change business settings" sits with the settings. */
  protected readonly groups = computed(() => {
    const by = new Map<string, Permission[]>();
    for (const p of this.perms()) {
      if (HIDDEN.includes(p.code)) continue;
      const g = p.code === 'tenant.update' ? 'Configuration' : p.group;
      by.set(g, [...(by.get(g) ?? []), p]);
    }
    const rank = (g: string) => (GROUP_ORDER.includes(g) ? GROUP_ORDER.indexOf(g) : GROUP_ORDER.length);
    return [...by.entries()].sort((a, b) => rank(a[0]) - rank(b[0])).map(([name, perms]) => ({ name, perms }));
  });

  ngOnInit(): void {
    this.load();
  }

  protected name(n: string): string {
    return roleName(this.i18n, n);
  }
  protected builtIn(n: string): boolean {
    return BUILT_IN_ROLES.includes(n);
  }
  protected locked(r: Role): boolean {
    return r.name === 'Admin' || !this.canEdit();
  }
  protected groupName(g: string): string {
    const key = `ws.perm.group.${groupKey(g)}`;
    const t = this.i18n.t(key);
    return t === key ? g : t;
  }
  /** "Sorting: close" in the person's language; a code with its own sentence uses that. */
  protected permName(p: Permission): string {
    const own = `ws.perm.code.${p.code.replace(/\./g, '_')}`;
    const t = this.i18n.t(own);
    if (t !== own) return t;
    const { obj, verb } = parts(p.code);
    const o = this.i18n.t(`ws.perm.obj.${obj}`);
    const v = this.i18n.t(`ws.perm.verb.${verb}`);
    return o.startsWith('ws.perm') || v.startsWith('ws.perm') ? p.name : this.i18n.t('ws.perm.pattern', { obj: o, verb: v });
  }

  protected allIn(list: Permission[]): boolean {
    return list.every((p) => this.chosen().has(p.id));
  }
  protected setAll(list: Permission[], on: boolean): void {
    const next = new Set(this.chosen());
    for (const p of list) on ? next.add(p.id) : next.delete(p.id);
    this.chosen.set(next);
  }
  protected flip(id: string): void {
    const next = new Set(this.chosen());
    next.has(id) ? next.delete(id) : next.add(id);
    this.chosen.set(next);
  }

  protected save(r: Role): void {
    // Abilities not shown here (platform-only) stay as they were.
    const hidden = (r.rolePermissions ?? []).filter((rp) => HIDDEN.includes(rp.permission?.code ?? '')).map((rp) => rp.permissionId);
    this.busy.set(true);
    this.http.post(`${API_BASE_URL}/admin/roles/${r.id}/permissions/bulk`, { permissionIds: [...new Set([...this.chosen(), ...hidden])] }).subscribe({
      next: () => {
        this.busy.set(false);
        this.toast.show(this.i18n.t('ws.roles.saved', { role: this.name(r.name) }));
        void this.router.navigate(['/settings/admin/roles']);
      },
      error: () => {
        this.busy.set(false);
        this.toast.error(this.i18n.t('common.couldNotSave'));
      },
    });
  }

  protected create(): void {
    const name = this.newName.trim();
    this.busy.set(true);
    this.http.post<Role>(`${API_BASE_URL}/admin/roles`, { name }).subscribe({
      next: (r) => {
        this.busy.set(false);
        this.newName = '';
        void this.router.navigate(['/settings/admin/roles', r.id]);
      },
      error: (e: { status?: number }) => {
        this.busy.set(false);
        this.toast.error(this.i18n.t(e.status === 409 || e.status === 400 ? 'ws.names.taken' : 'common.couldNotSave'));
      },
    });
  }

  protected remove(r: Role): void {
    if (!confirm(this.i18n.t('ws.names.removeConfirm', { name: r.name }))) return;
    this.http.delete(`${API_BASE_URL}/admin/roles/${r.id}`).subscribe({
      next: () => {
        this.toast.show(this.i18n.t('ws.names.removed', { name: r.name }));
        this.load();
      },
      error: () => this.toast.error(this.i18n.t('common.couldNotSave')),
    });
  }

  protected load(): void {
    this.failed.set(false);
    const id = this.roleId();
    if (!id) {
      this.http.get<Role[]>(`${API_BASE_URL}/admin/roles`).subscribe({ next: (r) => this.roles.set(r), error: () => this.failed.set(true) });
      return;
    }
    this.http.get<Record<string, Permission[]> | Permission[]>(`${API_BASE_URL}/admin/permissions/grouped`).subscribe({
      next: (g) => this.perms.set(Array.isArray(g) ? g : Object.values(g).flat()),
      error: () => this.failed.set(true),
    });
    this.http.get<Role>(`${API_BASE_URL}/admin/roles/${id}`).subscribe({
      next: (r) => {
        this.role.set(r);
        this.chosen.set(new Set((r.rolePermissions ?? []).map((rp) => rp.permissionId)));
      },
      error: () => this.failed.set(true),
    });
  }
}
