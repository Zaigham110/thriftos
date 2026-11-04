import { HelpLinkComponent } from '../help/help-link.component';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { LucideAngularModule, ChevronRight } from 'lucide-angular';
import { I18nService } from '../../core/i18n/i18n.service';
import { I18N } from '../../core/i18n/t.pipe';
import { TenantService } from '../../core/tenant/tenant.service';
import { FloorDataService, GradeQueueItem, Lot } from '../../shared/floor/floor-data.service';

/** Chhantai: pick a lot (with kg). Tenants that grade also see category outputs waiting to be graded. */
@Component({
  selector: 'app-sort-home',
  standalone: true,
  imports: [HelpLinkComponent, RouterLink, LucideAngularModule, I18N],
  template: `
    <section class="floor">
      <header class="floor-head"><h1>{{ 'sort.title' | t }}</h1></header>
      <section class="card">
        <h2>{{ 'sort.pickLot' | t }}</h2>
        <ul class="list">
          @for (lot of lots(); track lot.id) {
            <li><a class="row" [routerLink]="['/sort', lot.id]">
              <span><strong class="ltr">{{ lot.ragCode }}</strong><small>{{ lot.vendor?.name || lot.container?.containerNumber || '' }}@if (lot.originCountry) { · {{ lot.originCountry }} }</small></span>
              <span class="amount">{{ lot.weightKg | kg }}@if (lot.status === 'IN_SORTING') { <small class="warn">{{ 'sort.inProgress' | t }}</small> }</span>
            </a></li>
          } @empty { <li class="empty">{{ 'sort.noLots' | t }}<app-help-link topic="sorting" /></li> }
        </ul>
      </section>
      @if (grades() && toGrade().length) {
        <section class="card">
          <h2>{{ 'sort.gradeIt' | t }}</h2>
          <ul class="list">
            @for (o of toGrade(); track o.id) {
              <li><a class="row" [routerLink]="['/sort/grade', o.id]">
                <span><strong>{{ o.category.name }}</strong><small class="ltr">{{ o.rag?.ragCode }}</small></span>
                <span class="amount">{{ o.weightKg | kg }} <lucide-icon [img]="icons.ChevronRight" [size]="18" /></span>
              </a></li>
            }
          </ul>
        </section>
      }
    </section>
  `,
})
export class SortHomeComponent implements OnInit {
  private readonly data = inject(FloorDataService);
  private readonly tenant = inject(TenantService);
  protected readonly i18n = inject(I18nService);
  protected readonly icons = { ChevronRight };
  protected readonly lots = signal<Lot[]>([]);
  protected readonly toGrade = signal<GradeQueueItem[]>([]);
  protected readonly grades = computed(() => (this.tenant.tenant()?.sortingStages ?? 2) >= 2);

  ngOnInit(): void {
    this.data.lotsToSort().subscribe((l) => this.lots.set(l));
    this.data.toGrade().subscribe((o) => this.toGrade.set(o));
  }
}
