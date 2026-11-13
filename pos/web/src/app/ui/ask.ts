import { Component, inject, Injectable, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Sheet } from './sheet';

export interface AskField {
  key: string;
  label: string;
  value?: string;
  placeholder?: string;
  numeric?: boolean;
  optional?: boolean;
}
interface Question {
  title: string;
  text: string;
  fields: AskField[];
  yes: string;
  no: string;
  danger: boolean;
}

/**
 * A question to the person in the app's own sheet (never the browser's pop-up box, which looks foreign on a till and
 * is blocked in some installed apps). `confirm` resolves true or false; `fields` resolves what was typed, or null.
 */
@Injectable({ providedIn: 'root' })
export class Ask {
  readonly question = signal<Question | null>(null);
  values: Record<string, string> = {};
  private done: ((answer: Record<string, string> | null) => void) | undefined;

  private open(q: Question): Promise<Record<string, string> | null> {
    this.done?.(null); // a question still open is answered "no"
    this.values = Object.fromEntries(q.fields.map((f) => [f.key, f.value ?? '']));
    this.question.set(q);
    return new Promise((resolve) => (this.done = resolve));
  }

  confirm(title: string, text: string, yes = 'Yes', danger = false): Promise<boolean> {
    return this.open({ title, text, fields: [], yes, no: 'No', danger }).then((a) => a !== null);
  }

  fields(title: string, text: string, fields: AskField[], yes = 'Save', danger = false): Promise<Record<string, string> | null> {
    return this.open({ title, text, fields, yes, no: 'Go back', danger });
  }

  answer(ok: boolean) {
    const q = this.question();
    if (!q) return;
    const values = Object.fromEntries(Object.entries(this.values).map(([k, v]) => [k, String(v ?? '').trim()]));
    if (ok && q.fields.some((f) => !f.optional && !values[f.key])) return; // a needed box is still empty
    this.question.set(null);
    this.done?.(ok ? values : null);
    this.done = undefined;
  }
}

@Component({
  selector: 'pos-ask',
  imports: [FormsModule, Sheet],
  template: `
    @if (ask.question(); as q) {
      <pos-sheet [heading]="q.title" (closed)="ask.answer(false)">
        <form class="grid grid-cols-1 gap-3" (ngSubmit)="ask.answer(true)">
          @if (q.text) {
            <p class="-mt-1 text-sm text-stone-600">{{ q.text }}</p>
          }
          @for (f of q.fields; track f.key; let first = $first) {
            <div>
              <label class="label" [for]="'ask-' + f.key">{{ f.label }}</label>
              <input [id]="'ask-' + f.key" class="input" [class.num]="f.numeric" [name]="f.key" [(ngModel)]="ask.values[f.key]" [attr.inputmode]="f.numeric ? 'decimal' : null" [placeholder]="f.placeholder ?? ''" autocomplete="off" [attr.autofocus]="first ? '' : null" />
            </div>
          }
          <div class="mt-1 flex gap-2">
            <button type="button" class="btn-soft flex-1" (click)="ask.answer(false)">{{ q.no }}</button>
            <button class="flex-1" [class]="q.danger ? 'btn bg-red-600 text-white hover:bg-red-700' : 'btn-primary'">{{ q.yes }}</button>
          </div>
        </form>
      </pos-sheet>
    }
  `,
})
export class AskHost {
  readonly ask = inject(Ask);
}
