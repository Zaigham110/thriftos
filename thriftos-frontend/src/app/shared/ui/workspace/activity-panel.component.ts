import { Component, ElementRef, computed, inject, input, output, signal, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { LucideAngularModule, Paperclip } from 'lucide-angular';
import { I18nService } from '../../../core/i18n/i18n.service';
import { TPipe } from '../../../core/i18n/t.pipe';

export interface WsActivity {
  id: string;
  at: string | Date;
  who: string;
  text: string;
  kind?: 'change' | 'note' | 'system' | 'attachment';
  /** For attachments: where to download it. */
  href?: string;
}

export interface WsPerson {
  id: string;
  name: string;
}

export interface WsNote {
  text: string;
  mentions: string[];
}

/**
 * The record's history on the right of a record page: who changed what and when, notes, attached files.
 * Typing @ in the note box suggests team members; the people mentioned are notified.
 */
@Component({
  selector: 'ws-activity-panel',
  standalone: true,
  imports: [FormsModule, LucideAngularModule, TPipe],
  template: `
    <section class="panel" [attr.aria-label]="'ws.activity.title' | t">
      <h2>{{ 'ws.activity.title' | t }}</h2>
      <form class="note" (ngSubmit)="post()">
        <label class="ws-visually-hidden" for="ws-note">{{ 'ws.activity.placeholder' | t }}</label>
        <div class="box">
          <textarea #area id="ws-note" name="note" rows="2" [(ngModel)]="draft" (input)="onType()" (keydown)="onKey($event)" [placeholder]="'ws.activity.placeholder' | t" maxlength="2000"
            role="combobox" [attr.aria-expanded]="!!suggestions().length" aria-autocomplete="list" aria-controls="ws-mention-list"></textarea>
          @if (suggestions().length) {
            <ul id="ws-mention-list" class="mentions" role="listbox" [attr.aria-label]="'ws.activity.mention' | t">
              @for (p of suggestions(); track p.id; let i = $index) {
                <li role="option" [attr.aria-selected]="i === pick()" [class.on]="i === pick()" (mousedown)="$event.preventDefault(); mention(p)">{{ p.name }}</li>
              }
            </ul>
          }
        </div>
        <div class="actions">
          @if (canAttach()) {
            <label class="attach">
              <lucide-icon [img]="icons.Paperclip" [size]="15" aria-hidden="true" />{{ 'ws.activity.attach' | t }}
              <input type="file" (change)="onFile($event)" accept="image/jpeg,image/png,image/webp,application/pdf,text/csv,.xlsx,.xls,.docx" />
            </label>
          }
          <button type="submit" [disabled]="!draft.trim() || posting()">{{ 'ws.activity.post' | t }}</button>
        </div>
      </form>
      <ol>
        @for (a of items(); track a.id) {
          <li [class]="a.kind ?? 'change'">
            <span class="dot" aria-hidden="true"></span>
            <div>
              <p><strong>{{ a.who }}</strong>
                @if (a.href) { <a [href]="a.href" (click)="download.emit(a); $event.preventDefault()"><lucide-icon [img]="icons.Paperclip" [size]="13" aria-hidden="true" />{{ a.text }}</a> }
                @else { {{ a.text }} }
              </p>
              <time [attr.datetime]="iso(a.at)">{{ when(a.at) }}</time>
            </div>
          </li>
        } @empty { <li class="empty">{{ 'ws.activity.empty' | t }}</li> }
      </ol>
    </section>
  `,
  styles: [`
    .panel { display:grid; gap:var(--ws-3); padding:var(--ws-4); border:1px solid var(--ws-line); border-radius:var(--ws-r-lg); background:var(--ws-surface); }
    h2 { margin:0; color:var(--ws-ink); font-size:var(--ws-text-lg); font-weight:600; }
    .note { display:grid; gap:var(--ws-2); }
    .box { position:relative; }
    textarea { width:100%; box-sizing:border-box; padding:var(--ws-2) var(--ws-3); border:1px solid var(--ws-line); border-radius:var(--ws-r-md); background:var(--ws-surface-2); color:var(--ws-ink); font:inherit; resize:vertical; }
    textarea:focus { outline:none; border-color:var(--ws-brand); box-shadow:var(--ws-focus); }
    .mentions { position:absolute; inset-inline-start:0; inset-block-start:100%; z-index:5; min-width:200px; margin:4px 0 0; padding:var(--ws-1); list-style:none; border:1px solid var(--ws-line); border-radius:var(--ws-r-md); background:var(--ws-surface); box-shadow:var(--ws-shadow-pop); }
    .mentions li { padding:6px var(--ws-2); border-radius:var(--ws-r-sm); color:var(--ws-ink); cursor:pointer; }
    .mentions li.on { background:var(--ws-brand-soft); color:var(--ws-brand); }
    .actions { display:flex; align-items:center; justify-content:flex-end; gap:var(--ws-2); }
    .attach { position:relative; display:inline-flex; align-items:center; gap:4px; margin-inline-end:auto; color:var(--ws-ink-2); font-size:var(--ws-text-sm); cursor:pointer; }
    .attach input { position:absolute; inset:0; opacity:0; cursor:pointer; }
    .attach:focus-within { box-shadow:var(--ws-focus); border-radius:var(--ws-r-sm); }
    .actions button { height:32px; padding-inline:var(--ws-3); border:0; border-radius:var(--ws-r-md); background:var(--ws-brand); color:var(--ws-brand-ink); font:inherit; font-weight:600; cursor:pointer; }
    .actions button:disabled { opacity:.55; cursor:default; }
    ol { display:grid; gap:var(--ws-3); margin:0; padding:0; list-style:none; }
    li { display:grid; grid-template-columns:12px 1fr; gap:var(--ws-3); }
    .dot { width:8px; height:8px; margin-block-start:6px; border-radius:50%; background:var(--ws-line-strong); }
    li.note .dot { background:var(--ws-brand); }
    li.attachment .dot { background:var(--ws-series-1); }
    p { margin:0; color:var(--ws-ink-2); font-size:var(--ws-text-sm); overflow-wrap:anywhere; }
    p a { display:inline-flex; align-items:center; gap:3px; color:var(--ws-brand); }
    strong { color:var(--ws-ink); font-weight:600; }
    time { color:var(--ws-ink-3); font-size:var(--ws-text-xs); }
    .empty { display:block; color:var(--ws-ink-3); font-size:var(--ws-text-sm); }
  `],
})
export class WsActivityPanelComponent {
  private readonly i18n = inject(I18nService);
  readonly items = input<WsActivity[]>([]);
  readonly posting = input(false);
  /** Team members who can be @mentioned. */
  readonly people = input<WsPerson[]>([]);
  readonly canAttach = input(false);
  readonly note = output<WsNote>();
  readonly file = output<File>();
  readonly download = output<WsActivity>();
  protected readonly icons = { Paperclip };
  protected draft = '';
  private readonly area = viewChild<ElementRef<HTMLTextAreaElement>>('area');
  private readonly chosen = new Map<string, string>();
  private readonly mentionQuery = signal<string | null>(null);
  protected readonly pick = signal(0);
  protected readonly suggestions = computed(() => {
    const q = this.mentionQuery();
    if (q === null) return [];
    return this.people().filter((p) => p.name.toLowerCase().includes(q.toLowerCase())).slice(0, 6);
  });

  /** The "@word" being typed just before the cursor, if any. */
  protected onType(): void {
    const el = this.area()?.nativeElement;
    const before = el ? this.draft.slice(0, el.selectionStart ?? this.draft.length) : this.draft;
    const m = /(^|\s)@([^\s@]{0,30})$/.exec(before);
    this.mentionQuery.set(m ? m[2] : null);
    this.pick.set(0);
  }

  protected onKey(e: KeyboardEvent): void {
    const list = this.suggestions();
    if (!list.length) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); this.pick.set((this.pick() + 1) % list.length); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); this.pick.set((this.pick() - 1 + list.length) % list.length); }
    else if (e.key === 'Enter' || e.key === 'Tab') { e.preventDefault(); this.mention(list[this.pick()]); }
    else if (e.key === 'Escape') { this.mentionQuery.set(null); }
  }

  protected mention(p: WsPerson): void {
    const el = this.area()?.nativeElement;
    const cut = el?.selectionStart ?? this.draft.length;
    const before = this.draft.slice(0, cut).replace(/@([^\s@]{0,30})$/, `@${p.name} `);
    this.draft = before + this.draft.slice(cut);
    this.chosen.set(p.name, p.id);
    this.mentionQuery.set(null);
    queueMicrotask(() => el?.focus());
  }

  protected post(): void {
    const text = this.draft.trim();
    if (!text) return;
    const mentions = [...this.chosen].filter(([name]) => text.includes(`@${name}`)).map(([, id]) => id);
    this.note.emit({ text, mentions });
    this.draft = '';
    this.chosen.clear();
  }

  protected onFile(e: Event): void {
    const input = e.target as HTMLInputElement;
    const f = input.files?.[0];
    if (f) this.file.emit(f);
    input.value = '';
  }

  protected iso(at: string | Date): string {
    return new Date(at).toISOString();
  }
  protected when(at: string | Date): string {
    return new Date(at).toLocaleString(this.i18n.lang() === 'ur' ? 'ur-PK' : 'en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', numberingSystem: 'latn' });
  }
}
