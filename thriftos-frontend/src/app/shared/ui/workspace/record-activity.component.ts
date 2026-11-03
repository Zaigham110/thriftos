import { HttpClient } from '@angular/common/http';
import { Component, effect, inject, input, signal } from '@angular/core';
import { I18nService } from '../../../core/i18n/i18n.service';
import { ToastService } from '../../floor/toast.service';
import { WsActivity, WsActivityPanelComponent, WsNote, WsPerson } from './activity-panel.component';

/** What the server returns for a record's activity (GET /api/records/:type/:id/activity). */
interface ActivityItem {
  id: string;
  at: string;
  kind: 'change' | 'note' | 'attachment';
  who: string;
  action?: string;
  text?: string;
  attachment?: { id: string; fileName: string; contentType: string; size: number };
}

/** "SALE_CREATED" → "sale created" when the dictionary has no words for an action yet. */
export function actionWords(action: string): string {
  return action.toLowerCase().replace(/_/g, ' ');
}

/** The activity panel for one record, wired to the server: history, notes with @mentions, files. */
@Component({
  selector: 'ws-record-activity',
  standalone: true,
  imports: [WsActivityPanelComponent],
  template: `<ws-activity-panel [items]="items()" [people]="people()" [posting]="posting()" [canAttach]="true" (note)="note($event)" (file)="upload($event)" (download)="download($event)" />`,
})
export class WsRecordActivityComponent {
  private readonly http = inject(HttpClient);
  private readonly i18n = inject(I18nService);
  private readonly toast = inject(ToastService);
  /** Record type as the server names it: sale, container, customer, stockItem, lot, payment, supplier. */
  readonly type = input.required<string>();
  readonly recordId = input.required<string>();
  protected readonly items = signal<WsActivity[]>([]);
  protected readonly people = signal<WsPerson[]>([]);
  protected readonly posting = signal(false);

  constructor() {
    effect(() => {
      this.type();
      this.recordId();
      this.load();
    });
    this.http.get<WsPerson[]>('/api/records/mentionable').subscribe({ next: (p) => this.people.set(p), error: () => undefined });
  }

  private base(): string {
    return `/api/records/${this.type()}/${this.recordId()}`;
  }

  private load(): void {
    this.http.get<ActivityItem[]>(`${this.base()}/activity`).subscribe({
      next: (list) => this.items.set(list.map((a) => this.toItem(a))),
      error: () => this.items.set([]),
    });
  }

  private toItem(a: ActivityItem): WsActivity {
    if (a.kind === 'attachment' && a.attachment) {
      return { id: a.id, at: a.at, who: a.who, kind: 'attachment', text: a.attachment.fileName, href: `/api/records/attachments/${a.attachment.id}` };
    }
    if (a.kind === 'note') return { id: a.id, at: a.at, who: a.who, kind: 'note', text: a.text ?? '' };
    const key = `ws.audit.${a.action}`;
    const words = this.i18n.t(key);
    return { id: a.id, at: a.at, who: a.who, kind: 'change', text: words === key ? actionWords(a.action ?? '') : words };
  }

  protected note(n: WsNote): void {
    this.posting.set(true);
    this.http.post(`${this.base()}/notes`, n).subscribe({
      next: () => { this.posting.set(false); this.load(); },
      error: () => { this.posting.set(false); this.toast.show(this.i18n.t('common.couldNotSave')); },
    });
  }

  protected upload(file: File): void {
    const form = new FormData();
    form.append('file', file);
    this.posting.set(true);
    this.http.post(`${this.base()}/attachments`, form).subscribe({
      next: () => { this.posting.set(false); this.load(); },
      error: (e: { status?: number }) => { this.posting.set(false); this.toast.show(this.i18n.t(e.status === 400 ? 'ws.activity.badFile' : 'common.couldNotSave')); },
    });
  }

  protected download(a: WsActivity): void {
    if (!a.href) return;
    this.http.get(a.href, { responseType: 'blob' }).subscribe((blob) => {
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = a.text;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 10_000);
    });
  }
}
