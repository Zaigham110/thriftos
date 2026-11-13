import { afterRenderEffect, Component, ElementRef, inject, viewChildren } from '@angular/core';
import JsBarcode from 'jsbarcode';
import { Printer } from '../hardware/printer';

/** What goes to the browser's print window: a bill, stickers, or a report. Hidden on screen. */
@Component({
  selector: 'pos-print-host',
  template: `
    @if (printer.job(); as job) {
      <div class="print-only font-mono text-black" [style.width.mm]="job.widthMm">
        @if (job.kind === 'receipt') {
          <div class="px-[3mm] py-[2mm] text-[11px] leading-snug">
            <div class="text-center text-[15px] font-bold">{{ job.model.title }}</div>
            @for (h of job.model.header; track $index) {
              <div class="text-center">{{ h }}</div>
            }
            <hr class="my-1 border-dashed border-black" />
            @for (m of job.model.meta; track m[0]) {
              <div class="flex justify-between gap-2"><span>{{ m[0] }}</span><span class="text-right">{{ m[1] }}</span></div>
            }
            <hr class="my-1 border-dashed border-black" />
            @for (l of job.model.lines; track $index) {
              <div class="flex justify-between gap-2 font-bold"><span>{{ l.name }}</span><span>{{ l.total }}</span></div>
              <div class="pl-2">{{ l.detail }}</div>
            }
            <hr class="my-1 border-dashed border-black" />
            @for (t of job.model.totals; track t.label) {
              <div class="flex justify-between gap-2" [class]="t.big ? 'text-[15px] font-bold' : ''"><span>{{ t.label }}</span><span>{{ t.value }}</span></div>
            }
            @if (job.model.payments.length) {
              <hr class="my-1 border-dashed border-black" />
              @for (p of job.model.payments; track p[0]) {
                <div class="flex justify-between gap-2"><span>{{ p[0] }}</span><span>{{ p[1] }}</span></div>
              }
            }
            @for (n of job.model.notes; track $index) {
              <div class="mt-1">{{ n }}</div>
            }
            <div class="mt-2 flex justify-center"><svg #code [attr.data-code]="job.model.barcode"></svg></div>
            @for (f of job.model.footer; track $index) {
              <div class="mt-1 text-center">{{ f }}</div>
            }
          </div>
        } @else if (job.kind === 'labels') {
          @for (l of job.labels; track l.code) {
            <div class="flex flex-col justify-between overflow-hidden px-[2mm] py-[1.5mm] font-sans" style="break-after: page" [style.height.mm]="job.heightMm">
              <div>
                <div class="truncate text-[11px] font-bold leading-tight">{{ l.item }}</div>
                <div class="truncate text-[8px] leading-tight">{{ l.detail }}</div>
              </div>
              <svg #code class="w-full" [attr.data-code]="l.code" [attr.data-small]="1"></svg>
              <div class="text-[11px] font-bold leading-none">{{ l.price }}</div>
            </div>
          }
        } @else {
          <div class="px-[3mm] py-[2mm] text-[11px] leading-snug">
            <div class="text-center text-[13px] font-bold">{{ job.title }}</div>
            @for (s of job.sub; track $index) {
              <div class="text-center">{{ s }}</div>
            }
            <hr class="my-1 border-dashed border-black" />
            @for (r of job.rows; track $index) {
              @if (r) {
                <div class="flex justify-between gap-2"><span>{{ r[0] }}</span><span>{{ r[1] }}</span></div>
              } @else {
                <hr class="my-1 border-dashed border-black" />
              }
            }
          </div>
        }
      </div>
    }
  `,
})
export class PrintHost {
  readonly printer = inject(Printer);
  private readonly codes = viewChildren<ElementRef<SVGElement>>('code');

  constructor() {
    afterRenderEffect(() => {
      for (const ref of this.codes()) {
        const el = ref.nativeElement;
        const small = el.hasAttribute('data-small');
        try {
          JsBarcode(el, el.getAttribute('data-code') ?? '', { format: 'CODE128', height: small ? 34 : 44, width: small ? 1.3 : 1.5, margin: 0, fontSize: small ? 10 : 12, textMargin: 1 });
        } catch {
          /* a code the barcode cannot hold: the number is still printed as text */
        }
      }
    });
  }
}
