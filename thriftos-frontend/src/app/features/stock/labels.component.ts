import { HttpClient } from '@angular/common/http';
import { Component, OnInit, ViewEncapsulation, computed, inject, input, signal } from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { ArrowLeft, LucideAngularModule, Printer } from 'lucide-angular';
import { API_BASE_URL } from '../../core/config/api.config';
import { I18N } from '../../core/i18n/t.pipe';

interface Label { id: string; code: string; qrSvg: string; category: string | null; grade: string | null; weightKg: string; pieces: number; origin: string | null; business: string }
type Layout = 'a4' | 'thermal';

/**
 * Bale stickers: an A4 sheet of 3×8 labels (70 × 37 mm) or one 50 × 30 mm thermal sticker per bale.
 * Each shows the code, QR, kind, kg, origin and business name. `/stock/label/:id` or `/stock/labels?ids=a,b`.
 */
@Component({
  selector: 'app-labels',
  standalone: true,
  imports: [RouterLink, LucideAngularModule, I18N],
  encapsulation: ViewEncapsulation.None,
  template: `
    <section class="floor no-print">
      <header class="floor-head">
        <a class="icon-btn back" routerLink="/stock" [attr.aria-label]="'common.back' | t"><lucide-icon [img]="icons.ArrowLeft" [size]="22" /></a>
        <h1>{{ 'stock.printLabel' | t }}<span class="sub">{{ labels().length | num }} {{ (labels().length === 1 ? 'unit.bale' : 'unit.bales') | t }}</span></h1>
      </header>
      <div class="chips">
        <button type="button" class="chip" [class.on]="layout() === 'thermal'" (click)="layout.set('thermal')">{{ 'stock.printThermal' | t }}</button>
        <button type="button" class="chip" [class.on]="layout() === 'a4'" (click)="layout.set('a4')">{{ 'stock.printSheet' | t }}</button>
      </div>
      <footer class="action-bar">
        <button type="button" class="btn primary" [disabled]="!labels().length" (click)="print()"><lucide-icon [img]="icons.Printer" [size]="20" /> {{ 'bill.print' | t }}</button>
      </footer>
    </section>
    <div class="labels" [class.a4]="layout() === 'a4'" [class.thermal]="layout() === 'thermal'">
      @for (l of labels(); track l.id) {
        <article class="label">
          <div class="qr" [innerHTML]="svg(l)"></div>
          <div class="text">
            <strong class="code">{{ l.code }}</strong>
            <span class="kind">{{ kind(l) }}</span>
            <span class="kg">{{ l.weightKg | kg }}@if (l.pieces) { · {{ l.pieces | num }} {{ 'unit.pcs' | t }} }</span>
            @if (l.origin) { <span class="origin">{{ l.origin }}</span> }
            <span class="biz">{{ l.business }}</span>
          </div>
        </article>
      }
    </div>
  `,
  styles: [`
    app-labels .labels { display:grid; gap:12px; max-width:640px; margin:12px auto 0; }
    app-labels .label { display:flex; gap:3mm; align-items:center; box-sizing:border-box; padding:2.5mm; border:1px dashed #b9b1b6; background:#fff; color:#000; font-family:'Inter','Noto Naskh Arabic',sans-serif; direction:ltr; overflow:hidden; }
    app-labels .qr svg { display:block; width:100%; height:100%; }
    app-labels .text { display:grid; min-width:0; line-height:1.15; }
    app-labels .code { font-size:4.6mm; font-weight:800; white-space:nowrap; }
    app-labels .kind { font-size:3.4mm; font-weight:700; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
    app-labels .kg { font-size:3.4mm; font-weight:700; }
    app-labels .origin, app-labels .biz { font-size:2.6mm; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
    app-labels .thermal .label { width:50mm; height:30mm; }
    app-labels .thermal .qr { flex:none; width:24mm; height:24mm; }
    app-labels .a4 { grid-template-columns:repeat(3, 70mm); gap:0; justify-content:center; }
    app-labels .a4 .label { width:70mm; height:37mm; }
    app-labels .a4 .qr { flex:none; width:30mm; height:30mm; }
    @media screen and (max-width: 640px) { app-labels .a4 { grid-template-columns:repeat(auto-fill, 70mm); overflow-x:auto; } }
    @media print {
      body * { visibility:hidden; }
      app-labels .labels, app-labels .labels * { visibility:visible; }
      app-labels .labels { position:absolute; inset:0 auto auto 0; margin:0; gap:0; }
      app-labels .label { border:0; break-inside:avoid; }
      app-labels .thermal .label { break-after:page; }
    }
  `],
})
export class LabelsComponent implements OnInit {
  /** One bale from /stock/label/:id; several from ?ids= */
  readonly id = input<string>();
  private readonly route = inject(ActivatedRoute);
  private readonly http = inject(HttpClient);
  private readonly sanitizer = inject(DomSanitizer);
  protected readonly icons = { ArrowLeft, Printer };
  protected readonly labels = signal<Label[]>([]);
  protected readonly layout = signal<Layout>('thermal');
  private readonly svgCache = computed(() => new Map(this.labels().map((l) => [l.id, this.sanitizer.bypassSecurityTrustHtml(l.qrSvg)])));

  ngOnInit(): void {
    const ids = this.id() ?? this.route.snapshot.queryParamMap.get('ids') ?? '';
    if (ids.includes(',') || this.route.snapshot.queryParamMap.has('ids')) this.layout.set('a4');
    this.http.get<Label[]>(`${API_BASE_URL}/stock/bales/labels?ids=${encodeURIComponent(ids)}`).subscribe({ next: (l) => this.labels.set(l), error: () => undefined });
  }

  /** The QR SVG comes from our own server (qrcode library output), not from user input. */
  protected svg(l: Label): SafeHtml | undefined {
    return this.svgCache().get(l.id);
  }

  protected kind(l: Label): string {
    return [l.category, l.grade].filter((x) => !!x).join(' · ');
  }

  protected print(): void {
    // Standard 3×8 label sheets (70 × 37 mm) fill the page edge to edge: 8 × 37 = 296 of 297 mm.
    const page = this.layout() === 'a4' ? 'A4 portrait; margin: 0.5mm 0' : '50mm 30mm; margin: 0';
    const style = document.createElement('style');
    style.textContent = `@page { size: ${page}; }`;
    document.head.appendChild(style);
    window.print();
    setTimeout(() => style.remove(), 1000);
  }
}
