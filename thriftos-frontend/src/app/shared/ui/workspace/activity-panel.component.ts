import { Component, inject, input, output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { I18nService } from '../../../core/i18n/i18n.service';
import { TPipe } from '../../../core/i18n/t.pipe';

export interface WsActivity {
  id: string;
  at: string | Date;
  who: string;
  text: string;
  kind?: 'change' | 'note' | 'system';
}

/** The record's history on the right of a record page: who changed what and when, plus notes. */
@Component({
  selector: 'ws-activity-panel',
  standalone: true,
  imports: [FormsModule, TPipe],
  template: `
    <section class="panel" [attr.aria-label]="'ws.activity.title' | t">
      <h2>{{ 'ws.activity.title' | t }}</h2>
      <form class="note" (ngSubmit)="post()">
        <label class="ws-visually-hidden" for="ws-note">{{ 'ws.activity.placeholder' | t }}</label>
        <textarea id="ws-note" name="note" rows="2" [(ngModel)]="draft" [placeholder]="'ws.activity.placeholder' | t" maxlength="2000"></textarea>
        <button type="submit" [disabled]="!draft.trim() || posting()">{{ 'ws.activity.post' | t }}</button>
      </form>
      <ol>
        @for (a of items(); track a.id) {
          <li [class]="a.kind ?? 'change'">
            <span class="dot" aria-hidden="true"></span>
            <div><p><strong>{{ a.who }}</strong> {{ a.text }}</p><time [attr.datetime]="iso(a.at)">{{ when(a.at) }}</time></div>
          </li>
        } @empty { <li class="empty">{{ 'ws.activity.empty' | t }}</li> }
      </ol>
    </section>
  `,
  styles: [`
    .panel { display:grid; gap:var(--ws-3); padding:var(--ws-4); border:1px solid var(--ws-line); border-radius:var(--ws-r-lg); background:var(--ws-surface); }
    h2 { margin:0; color:var(--ws-ink); font-size:var(--ws-text-lg); font-weight:600; }
    .note { display:grid; gap:var(--ws-2); }
    textarea { width:100%; box-sizing:border-box; padding:var(--ws-2) var(--ws-3); border:1px solid var(--ws-line); border-radius:var(--ws-r-md); background:var(--ws-surface-2); color:var(--ws-ink); font:inherit; resize:vertical; }
    textarea:focus { outline:none; border-color:var(--ws-brand); box-shadow:var(--ws-focus); }
    .note button { justify-self:end; height:32px; padding-inline:var(--ws-3); border:0; border-radius:var(--ws-r-md); background:var(--ws-brand); color:var(--ws-brand-ink); font:inherit; font-weight:600; cursor:pointer; }
    .note button:disabled { opacity:.55; cursor:default; }
    ol { display:grid; gap:var(--ws-3); margin:0; padding:0; list-style:none; }
    li { display:grid; grid-template-columns:12px 1fr; gap:var(--ws-3); }
    .dot { width:8px; height:8px; margin-block-start:6px; border-radius:50%; background:var(--ws-line-strong); }
    li.note .dot { background:var(--ws-brand); }
    p { margin:0; color:var(--ws-ink-2); font-size:var(--ws-text-sm); }
    strong { color:var(--ws-ink); font-weight:600; }
    time { color:var(--ws-ink-3); font-size:var(--ws-text-xs); }
    .empty { display:block; color:var(--ws-ink-3); font-size:var(--ws-text-sm); }
  `],
})
export class WsActivityPanelComponent {
  private readonly i18n = inject(I18nService);
  readonly items = input<WsActivity[]>([]);
  readonly posting = input(false);
  readonly note = output<string>();
  protected draft = '';

  protected post(): void {
    const text = this.draft.trim();
    if (!text) return;
    this.note.emit(text);
    this.draft = '';
  }
  protected iso(at: string | Date): string {
    return new Date(at).toISOString();
  }
  protected when(at: string | Date): string {
    return new Date(at).toLocaleString(this.i18n.lang() === 'ur' ? 'ur-PK' : 'en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', numberingSystem: 'latn' });
  }
}
