import { Component, DestroyRef, ElementRef, OnInit, computed, effect, inject, input, signal, untracked, viewChild } from '@angular/core';
import { NavService } from '../../core/nav/nav.service';
import { WsPageHeaderComponent } from '../../shared/ui/workspace/page-header.component';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { ArrowLeft, CheckCircle2, LucideAngularModule, Minus, Plus, Printer, Trash2, X } from 'lucide-angular';
import { I18nService } from '../../core/i18n/i18n.service';
import { I18N } from '../../core/i18n/t.pipe';
import { OfflineQueueService } from '../../core/offline/offline-queue.service';
import { TenantService } from '../../core/tenant/tenant.service';
import { CategoryRow, FloorDataService, Named, ReadyRow, SessionOutput, SortEntry, SortLot, SortSummary, WasteType, countUse, usageOrder } from '../../shared/floor/floor-data.service';
import { NumberFieldComponent } from '../../shared/floor/number-field.component';
import { Tile, TilesComponent } from '../../shared/floor/tiles.component';
import { ToastService } from '../../shared/floor/toast.service';

type Stage = 1 | 2;
type Mode = 'bales' | 'kg';
const WASTE_TILE = '__waste__';
const BALE_KG_KEY = 'thriftos.baleKg';
const GRADE_KEY = 'thriftos.sortGrade';

/** One tile while sorting: a category (stage 1, v2 6.6) or a grade (stage 2). */
interface Kind {
  id: string;
  name: string;
  categoryId: string;
  gradeId: string | null;
  baleKg: number | null;
}

/**
 * The sheet: sorting an entry for the tile just tapped (bales or loose kg, grade optional), or making bales from
 * this lot's sorted kg ("Make bales" on a ready row).
 */
interface Entry {
  purpose: 'sort' | 'bale';
  kind: Kind;
  /** For "Make bales": the sorted kg it takes from. */
  ready: ReadyRow | null;
  mode: Mode;
  /** Grade given now; null = no grade. */
  gradeId: string | null;
  bales: number;
  baleKg: number | null;
  kg: number | null;
  /** A lot bought by the piece is sorted in pieces. */
  pieces?: number | null;
  /** Making bales: each bale by kg or by a number of pieces (chosen each time, owner 2026-11-11). */
  baleBy?: 'kg' | 'pieces';
  piecesPerBale?: number | null;
}

const kindKey = (categoryId: string, gradeId: string | null) => `${categoryId}:${gradeId ?? ''}`;

/**
 * Journey 2 — sorting a lot (gaari). Since v2 6.6 one step sorts, grades and bales: big tiles are category + grade
 * (CCR 1, Baby 2…); tap one, then enter bales (count × kg per bale, pre-filled) or loose kg. Bales go straight into
 * stock with QR stickers; loose kg can be baled at once. The lot stays open for days; Today shows what came out today.
 * "Close lot" when the gaari is finished: what is left is kat — into stock, to sell or throw away.
 * Stage 2 (grading a category output separately) is kept for lots sorted before.
 * Every entry goes through the offline queue; Undo takes the last one back for 10 s.
 */
@Component({
  selector: 'app-sort-work',
  standalone: true,
  imports: [RouterLink, LucideAngularModule, I18N, NumberFieldComponent, TilesComponent, WsPageHeaderComponent],
  template: `
    <section class="floor" [class.wide]="desktop">
      @if (desktop) {
        <!-- Laptop: the shared header (breadcrumb lined up with the heading) and the way to the lot's page. -->
        <ws-page-header [attr.inert]="sheetOpen() ? '' : null" [heading]="title()" [subtitle]="stage() === 1 && lotMeta() ? lotMeta() : ((stage() === 1 ? 'sort.title' : 'sort.grading') | t) + (stage() === 2 && gradeLot() ? ' · ' + gradeLot()!.code : '')">
          @if (stage() === 1 || gradeLot()) {
            <a actions class="ws-btn" [routerLink]="['/sort/records', stage() === 1 ? id() : gradeLot()!.id]" [state]="nav.trailState()">{{ 'ws.sortRecord.openLot' | t }}</a>
          }
        </ws-page-header>
      } @else {
        <header class="floor-head" [attr.inert]="sheetOpen() ? '' : null">
          <a class="icon-btn back" routerLink="/sort" [attr.aria-label]="'common.back' | t"><lucide-icon [img]="icons.ArrowLeft" [size]="22" /></a>
          <h1>{{ title() }}<span class="sub">{{ stage() === 1 && lotMeta() ? lotMeta() : ((stage() === 1 ? 'sort.title' : 'sort.grading') | t) + (stage() === 2 && gradeLot() ? ' · ' + gradeLot()!.code : '') }}</span></h1>
        </header>
      }

      @if (blocked(); as why) {
        <section class="card" role="status">
          <h2>{{ 'sort.cannotGrade' | t }}</h2>
          <p class="hint">{{ ('sort.cannotGradeWhy.' + why) | t: { kg: (inputKg() | kg) } }}</p>
          <a class="btn primary block" [routerLink]="gradeLot() ? ['/sort/records', gradeLot()!.id] : '/sort'">{{ (gradeLot() ? 'ws.sortRecord.openLot' : 'common.back') | t }}</a>
        </section>
      } @else if (result(); as r) {
        <section class="card">
          <h2><lucide-icon [img]="icons.CheckCircle2" [size]="22" class="good" /> {{ (stage() === 1 ? 'sort.closed' : 'sort.gradingDone') | t }} · {{ 'sort.yield' | t }}</h2>
          <p class="hint">{{ (stage() === 1 ? 'sort.closedSummary' : 'sort.gradedSummary') | t: { kg: (inputKg() | kg), out: (outputKgAtClose() | kg), bales: (totalBales() | num) } }}</p>
          <ul class="list">
            @for (o of r; track o.id) {
              <li class="row"><span><strong>{{ o.name }}</strong><small>{{ 'unit.percent' | t: { n: pct(o.weightKg) } }}@if (o.bales) { · {{ o.bales | num }} {{ (o.bales === 1 ? 'unit.bale' : 'unit.bales') | t }} }</small></span>
                <span class="amount">{{ o.weightKg | kg }}@if (o.costPerKg) { <small>{{ 'sort.costPerKg' | t: { rs: (o.costPerKg | rs) } }}</small> }</span></li>
            }
            <li class="row"><span><strong>{{ 'sort.kat' | t }}</strong><small>{{ 'unit.percent' | t: { n: pct(wasteAtClose()) } }}</small></span><span class="amount">{{ wasteAtClose() | kg }}</span></li>
          </ul>
          @if (!closedOnline()) { <p class="hint">{{ 'sync.savedOnPhone' | t }}</p> }
        </section>
        @if (kat(); as k) {
          <section class="card kat">
            @if (+k.leftKg > 0) {
              <h2>{{ 'sort.katInStock' | t: { kg: (k.leftKg | kg) } }}</h2>
              <p class="hint">{{ 'sort.katHint' | t }}</p>
              <button type="button" class="btn" [disabled]="throwing()" (click)="throwAway(k.id)">{{ 'sort.katThrowAway' | t }}</button>
            } @else {
              <p class="hint">{{ 'sort.katDone' | t }}</p>
            }
          </section>
        }
        <a class="btn primary block" [routerLink]="doneLink()">{{ (doneLink() === '/sort' ? 'common.done' : 'ws.sortRecord.openLot') | t }}</a>
      } @else {
        <div class="work" [attr.inert]="sheetOpen() ? '' : null">
        @if (stage() === 1) {
          <section class="overview card" aria-live="polite">
            <div class="stats">
              @if (byPieces()) {
                <!-- Bought by the piece: counted in pieces (the kg is shown under them). -->
                <div><small>{{ 'sort.lotKg' | t }}</small><strong>{{ 'ws.lf.piecesN' | t: { n: (lotPieces() | num) } }}</strong><span>{{ inputKg() | kg }}@if (lot()?.costPerPiece; as c) { · {{ 'sort.costPerPiece' | t: { rs: (c | rs) } }} }</span></div>
                <div><small>{{ 'sort.sortedLabel' | t }}</small><strong>{{ 'ws.lf.piecesN' | t: { n: (sortedPieces() | num) } }}</strong><span>{{ 'unit.percent' | t: { n: donePct() } }}@if (today(); as td) { · {{ 'sort.nToday' | t: { n: ('ws.lf.piecesN' | t: { n: (td.pieces | num) }) } }} }</span></div>
                <div [class.warn]="leftPieces() < 0"><small>{{ 'sort.leftLabel' | t }}</small><strong>{{ 'ws.lf.piecesN' | t: { n: (leftPieces() | num) } }}</strong><span>{{ 'sort.leftHint' | t }}</span></div>
              } @else {
              <div><small>{{ 'sort.lotKg' | t }}</small><strong>{{ inputKg() | kg }}</strong>@if (lot()?.costPerKg; as c) { <span>{{ 'sort.costPerKg' | t: { rs: (c | rs) } }}</span> }</div>
              <div><small>{{ 'sort.sortedLabel' | t }}</small><strong>{{ sortedKg() | kg }}</strong><span>{{ 'unit.percent' | t: { n: donePct() } }}@if (today(); as td) { · {{ 'sort.nToday' | t: { n: (td.kg | kg) } }} }</span></div>
              <div [class.warn]="leftKg() < 0"><small>{{ 'sort.leftLabel' | t }}</small><strong>{{ leftKg() | kg }}</strong><span>{{ 'sort.leftHint' | t }}</span></div>
              }
              <div><small>{{ 'sort.balesLabel' | t }}</small><strong>{{ totalBales() | num }}</strong>@if (today(); as td) { <span>{{ 'sort.nToday' | t: { n: (td.bales | num) } }}</span> }</div>
            </div>
            <div class="bar big" role="progressbar" [attr.aria-valuenow]="donePct()" aria-valuemin="0" aria-valuemax="100" [attr.aria-label]="'sort.sortedLabel' | t"><i [style.width.%]="donePct()"></i></div>
          </section>
        } @else {
          <div class="totals" aria-live="polite">
            <div><small>{{ 'sort.gradedLabel' | t }}</small><strong>{{ sortedKg() | kg }}</strong></div>
            <div [class.warn]="leftKg() < 0"><small>{{ 'sort.leftLabel' | t }}</small><strong>{{ leftKg() | kg }}</strong></div>
          </div>
          <div class="bar" role="progressbar" [attr.aria-valuenow]="donePct()" aria-valuemin="0" aria-valuemax="100"><i [style.width.%]="donePct()"></i></div>
        }

        <div class="main">
          <h2 class="section-title">{{ (stage() === 1 ? 'sort.whatSorted' : 'sort.tapTile') | t }}</h2>
          @if (stage() === 1) { <p class="hint">{{ 'sort.whatSortedHint' | t }}</p> }
          <tos-tiles [items]="tiles()" [limit]="80" [columns]="desktop ? 'auto' : 2" searchPlaceholder="sort.searchCategory" (pick)="startLine($event)" />
        </div>

        <div class="side">
        @if (lastBales(); as lb) {
          <a class="card printed" [routerLink]="['/stock/labels']" [queryParams]="{ ids: lb.ids.join(',') }">
            <lucide-icon [img]="icons.Printer" [size]="20" /><span>{{ 'sort.printStickers' | t: { n: (lb.ids.length | num), name: lb.name } }}</span>
          </a>
        }

        @if (stage() === 1) {
          <section class="card entries" [attr.aria-label]="'sort.cameOut' | t">
            <div class="head"><h2>{{ 'sort.cameOut' | t }}</h2>@if (entries().length) { <span class="count">{{ entries().length | num }}</span> }</div>
            @if (!entries().length) {
              <p class="hint">{{ 'sort.noEntries' | t }}</p>
            } @else {
              <ul class="elist">
                @for (e of shownEntries(); track e.id) {
                  <li [class.removing]="removing() === e.id">
                    <div class="what">
                      <strong>{{ e.categoryName }}@if (e.gradeName) { · {{ e.gradeName }} }</strong>
                      <small>{{ when(e.at) }} · @if (e.bales) { {{ 'sort.entryBales' | t: { n: (e.bales | num), kg: (e.kg | kg) } }} } @else if (byPieces() && e.pieces) { {{ 'ws.lf.piecesN' | t: { n: (e.pieces | num) } }} · {{ e.kg | kg }} } @else { {{ 'sort.entryLoose' | t: { kg: (e.kg | kg) } }} }</small>
                    </div>
                    @if (removing() === e.id) {
                      <div class="confirm-row">
                        <span>{{ 'sort.removeAsk' | t }}</span>
                        <button type="button" class="btn sm" (click)="removing.set(null)">{{ 'common.cancel' | t }}</button>
                        <button type="button" class="btn sm danger" [disabled]="busyRemove()" (click)="removeEntry(e)">{{ 'sort.removeYes' | t }}</button>
                      </div>
                    } @else {
                      <div class="acts">
                        @if (e.baleIds.length) {
                          <a class="icon-btn sm" [routerLink]="['/stock/labels']" [queryParams]="{ ids: e.baleIds.join(',') }" [attr.aria-label]="'sort.printThese' | t" [title]="'sort.printThese' | t"><lucide-icon [img]="icons.Printer" [size]="18" /></a>
                        }
                        @if (e.removable) {
                          <button type="button" class="icon-btn sm" (click)="removing.set(e.id)" [attr.aria-label]="'sort.removeEntry' | t" [title]="'sort.removeEntry' | t"><lucide-icon [img]="icons.Trash2" [size]="18" /></button>
                        }
                      </div>
                    }
                  </li>
                }
              </ul>
              @if (entries().length > shownEntries().length) {
                <button type="button" class="link" (click)="showAll.set(true)">{{ 'sort.showAll' | t: { n: (entries().length | num) } }}</button>
              }
            }
          </section>
        }

        @if (stage() === 1 && (ready().length || madeBales().length)) {
          <section class="card ready">
            <h2>{{ 'sort.readyTitle' | t }}</h2>
            @if (ready().length) {
              <ul class="list">
                @for (r of ready(); track readyKey(r)) {
                  <li class="row">
                    <span><strong>{{ rowName(r) }}</strong><small>{{ 'sort.readyKg' | t: { kg: (r.availableKg | kg) } }}@if (r.availablePieces) { · {{ 'ws.lf.piecesN' | t: { n: (r.availablePieces | num) } }} }</small></span>
                    <button type="button" class="btn" (click)="startBales(r)">{{ 'sort.makeBales' | t }}</button>
                  </li>
                }
              </ul>
            } @else {
              <p class="hint">{{ 'sort.nothingReady' | t }}</p>
            }
            @if (madeBales().length) {
              <p class="made"><strong>{{ 'sort.balesMade' | t }}</strong>
                @for (b of madeBales(); track $index) { <span>{{ rowName(b) }} · {{ b.bales | num }}</span> }
              </p>
            }
          </section>
        }

        @if (confirmClose()) {
          <section class="card confirm" role="alertdialog" [attr.aria-label]="closeWord() | t">
            <h2>{{ (stage() === 1 ? 'sort.closeTitle' : 'sort.finishTitle') | t }}</h2>
            @if (stage() === 1) {
              <ul class="list sumlist">
                @for (k of closePreview(); track k.name) {
                  <li class="row"><span>{{ k.name }}</span><span class="amount">{{ k.kg | kg }} · {{ 'unit.percent' | t: { n: pct(k.kg) } }}</span></li>
                }
                <li class="row kat"><span>{{ 'sort.kat' | t }}</span><span class="amount">{{ leftText() }}@if (!byPieces()) { · {{ 'unit.percent' | t: { n: pct(leftKg()) } }} }</span></li>
              </ul>
            }
            <p><strong>{{ (stage() === 1 ? 'sort.closeConfirmKat' : 'sort.finishConfirm') | t: { kg: leftText() } }}</strong></p>
            <div class="row2">
              <button type="button" class="btn" (click)="confirmClose.set(false)">{{ 'common.cancel' | t }}</button>
              <button type="button" class="btn primary" (click)="close()">{{ closeWord() | t }}</button>
            </div>
          </section>
        }

        <footer class="action-bar">
          <div class="summary"><small>{{ 'sort.leftLabel' | t }}</small><strong>{{ leftKg() | kg }}</strong></div>
          <button type="button" class="btn primary" [disabled]="(byPieces() ? sortedPieces() <= 0 : sortedKg() <= 0 || inputKg() <= 0) || closing()" (click)="askClose()">{{ closeWord() | t }}</button>
        </footer>
        </div>
        </div>

        @if (entry(); as e) {
          <div class="entry-backdrop" (click)="closeSheet()" aria-hidden="true"></div>
          <section class="card entry" role="dialog" aria-modal="true" tabindex="-1" aria-labelledby="entry-title" [attr.aria-describedby]="'entry-left'" [style.bottom.px]="kbInset()" [style.max-height]="sheetMaxH()" (keydown.escape)="closeSheet()">
            <header class="sheet-head">
              <div>
                <h2 id="entry-title">{{ e.purpose === 'bale' ? ('sort.makeBalesOf' | t: { name: rowName(e.ready!) }) : e.kind.name }}</h2>
                <p class="sum" id="entry-left">{{ e.purpose === 'bale' ? ('sort.readyKg' | t: { kg: (e.ready!.availableKg | kg) }) : (byPieces() ? ('sort.leftPieces' | t: { n: (leftPieces() | num) }) : ('sort.left' | t: { kg: (leftKg() | kg) })) }}</p>
              </div>
              <button type="button" class="x" [attr.aria-label]="'common.cancel' | t" (click)="closeSheet()"><lucide-icon [img]="icons.X" [size]="22" /></button>
            </header>
            @if (canPickGrade(e)) {
              <div class="field">
                <span class="field-label" id="entry-grade">{{ 'sort.grade' | t }} <em>· {{ 'common.optional' | t }}</em></span>
                <div class="grades" role="group" aria-labelledby="entry-grade">
                  <button type="button" class="chip" [class.on]="!e.gradeId" [attr.aria-pressed]="!e.gradeId" (click)="patch({ gradeId: null })">{{ 'sort.noGrade' | t }}</button>
                  @for (g of gradeOptions(); track g.id) {
                    <button type="button" class="chip" [class.on]="e.gradeId === g.id" [attr.aria-pressed]="e.gradeId === g.id" (click)="patch({ gradeId: g.id })">{{ g.name }}</button>
                  }
                </div>
              </div>
            }
            @if (e.purpose === 'sort' && !byPieces()) {
              <div class="seg" role="group" [attr.aria-label]="'sort.howEntered' | t">
                <button type="button" [class.on]="e.mode === 'bales'" [attr.aria-pressed]="e.mode === 'bales'" (click)="setMode('bales')">{{ 'sort.modeBales' | t }}</button>
                <button type="button" [class.on]="e.mode === 'kg'" [attr.aria-pressed]="e.mode === 'kg'" (click)="setMode('kg')">{{ 'sort.modeLoose' | t }}</button>
              </div>
            }
            @if (e.purpose === 'bale' && e.ready?.availablePieces) {
              <div class="seg" role="group" [attr.aria-label]="'sort.baleBy' | t">
                @if (+e.ready!.availableKg > 0) {
                  <button type="button" [class.on]="e.baleBy !== 'pieces'" [attr.aria-pressed]="e.baleBy !== 'pieces'" (click)="patch({ baleBy: 'kg' })">{{ 'sort.kgPerBale' | t }}</button>
                }
                <button type="button" [class.on]="e.baleBy === 'pieces'" [attr.aria-pressed]="e.baleBy === 'pieces'" (click)="patch({ baleBy: 'pieces', baleKg: piecesKg(e, e.piecesPerBale ?? null) })">{{ 'sort.piecesPerBale' | t }}</button>
              </div>
            }
            @if (e.mode === 'bales') {
              <div class="bales-row">
                <div class="field">
                  <label class="field-label" for="entry-count">{{ 'sort.howManyBales' | t }}</label>
                  <div class="stepper">
                    <button type="button" [attr.aria-label]="'sort.fewer' | t" [disabled]="e.bales <= 1" (click)="step(-1)"><lucide-icon [img]="icons.Minus" [size]="22" /></button>
                    <input id="entry-count" class="ltr" type="text" inputmode="numeric" enterkeyhint="next" autocomplete="off" [value]="e.bales" (input)="typedCount($event)" (blur)="fixCount($event)" (focus)="selectAll($event)" />
                    <button type="button" [attr.aria-label]="'sort.more' | t" (click)="step(1)"><lucide-icon [img]="icons.Plus" [size]="22" /></button>
                  </div>
                </div>
                @if (e.baleBy === 'pieces') {
                  <tos-number size="big" label="sort.piecesPerBale" unit="unit.pcs" [decimals]="0" [autofocus]="!e.piecesPerBale" [value]="e.piecesPerBale ?? null" (valueChange)="patch({ piecesPerBale: $event, baleKg: piecesKg(e, $event) })" (enter)="save()" [hint]="+e.ready!.availableKg > 0 && e.baleKg ? ('sort.kgEach' | t: { kg: (e.baleKg | kg) }) : null" />
                  @if (+e.ready!.availableKg === 0) {
                    <!-- Sorted without a weight: the bale may be weighed (optional). -->
                    <tos-number label="sort.kgPerBale" unit="unit.kgShort" [optional]="true" [value]="e.baleKg" (valueChange)="patch({ baleKg: $event })" (enter)="save()" />
                  }
                } @else {
                <tos-number size="big" label="sort.kgPerBale" unit="unit.kgShort" [autofocus]="!e.baleKg" [value]="e.baleKg" (valueChange)="patch({ baleKg: $event })" (enter)="save()" />
                }
              </div>
            } @else if (byPieces() && e.purpose === 'sort') {
              <tos-number size="big" label="ws.lf.pieces" unit="unit.pcs" [decimals]="0" [autofocus]="true" [max]="leftPieces()" maxMessage="sort.tooManyPieces" [value]="e.pieces ?? null" (valueChange)="patch({ pieces: $event })" (enter)="save()" />
            } @else {
              <tos-number size="big" label="common.weight" unit="unit.kgShort" [autofocus]="true" [max]="leftKg()" maxMessage="sort.tooMuch" [value]="e.kg" (valueChange)="patch({ kg: $event })" (enter)="save()" />
            }
            @if (tooMuch() && e.mode === 'bales') { <p class="err" role="alert">{{ (e.purpose === 'bale' ? 'sort.tooMuchReady' : 'sort.tooMuch') | t: { kg: (limitKg() | kg) } }}</p> }
            <button type="button" class="btn primary save" [disabled]="!canSave() || tooMuch()" (click)="save()">
              {{ (e.purpose === 'bale' ? 'sort.saveBales' : 'common.save') | t }}
              @if (canSave() && !tooMuch()) { <span class="what">· @if (byPieces() && e.purpose === 'sort') { {{ 'ws.lf.piecesN' | t: { n: (e.pieces | num) } }}@if (entryKg()) { · {{ entryKg() | kg }} } } @else if (e.baleBy === 'pieces') { {{ 'sort.balesTotal' | t: { n: (e.bales | num), kg: ('ws.lf.piecesN' | t: { n: ((e.bales * (e.piecesPerBale ?? 0)) | num) }) } }} } @else if (e.mode === 'bales') { {{ 'sort.balesTotal' | t: { n: (e.bales | num), kg: (entryKg() | kg) } }} } @else { {{ entryKg() | kg }} }</span> }
            </button>
          </section>
        }

        @if (picking(); as p) {
          <div class="entry-backdrop" (click)="closeSheet()" aria-hidden="true"></div>
          <section class="card entry" role="dialog" aria-modal="true" tabindex="-1" aria-labelledby="pick-title" [style.bottom.px]="kbInset()" [style.max-height]="sheetMaxH()" (keydown.escape)="closeSheet()">
            <header class="sheet-head">
              <div>
                <h2 id="pick-title">{{ p.label }}</h2>
                <p class="sum">{{ 'sort.left' | t: { kg: (leftKg() | kg) } }}</p>
              </div>
              <button type="button" class="x" [attr.aria-label]="'common.cancel' | t" (click)="closeSheet()"><lucide-icon [img]="icons.X" [size]="22" /></button>
            </header>
            <tos-number size="big" label="common.weight" unit="unit.kgShort" [autofocus]="true" [max]="leftKg()" maxMessage="sort.tooMuch" [value]="pickKg()" (valueChange)="pickKg.set($event)" (enter)="saveLine(p, $event)" />
            <button type="button" class="btn primary save" [disabled]="!pickKg()" (click)="saveLine(p, pickKg())">{{ 'common.save' | t }}@if (pickKg(); as k) { <span class="what">· {{ k | kg }}</span> }</button>
          </section>
        }

        <!-- Focused in the tap itself so the phone's keyboard opens; the kg box takes the focus a moment later (iPhone). -->
        <input #kbProxy class="kb-proxy" type="text" inputmode="decimal" tabindex="-1" aria-hidden="true" />

      }
    </section>
  `,
  styles: [`
    /* Phone: numbers, categories, what came out, then close. Laptop (v2 sorting review): numbers across the top,
       categories in the middle, what came out and closing on the right. */
    .floor.wide { max-width:var(--ws-content-max, 1280px); padding-block-end:16px; }
    .work { display:grid; grid-template-columns:minmax(0, 1fr); gap:14px; }
    .work .side, .work .main { display:grid; gap:14px; align-content:start; min-width:0; }
    .wide .work { grid-template-columns:minmax(0, 1fr) 400px; grid-template-areas:'top top' 'main side'; align-items:start; gap:18px; }
    .wide .overview, .wide .totals, .wide .bar:not(.big) { grid-area:top; }
    .wide .work .main { grid-area:main; }
    .wide .work .side { grid-area:side; position:sticky; top:calc(var(--ws-topbar-h, 56px) + 16px); max-height:calc(100vh - var(--ws-topbar-h, 56px) - 32px); overflow:auto; }
    .wide .action-bar { position:static; margin:0; }
    .overview { display:grid; gap:12px; }
    .stats { display:grid; grid-template-columns:repeat(2, minmax(0, 1fr)); gap:10px; }
    .wide .stats { grid-template-columns:repeat(4, minmax(0, 1fr)); }
    .stats div { display:grid; gap:2px; align-content:start; padding:10px 12px; border-radius:12px; background:var(--tos-bg, #f6f3f1); }
    .stats small { color:var(--tos-ink-soft); font-size:13px; font-weight:700; }
    .stats strong { font-size:24px; line-height:1.15; white-space:nowrap; font-variant-numeric:tabular-nums; }
    .stats span { color:var(--tos-ink-soft); font-size:13px; }
    .stats .warn strong { color:var(--tos-danger, #b3261e); }
    .bar.big { height:12px; border-radius:6px; }
    .section-title { margin:0; font-size:18px; }
    .main .hint { margin:0; }
    .entries .head { display:flex; align-items:center; justify-content:space-between; gap:8px; }
    .entries h2 { margin:0; }
    .entries .count { min-width:28px; padding:2px 8px; border-radius:999px; background:var(--tos-primary-soft, #f3e8ef); color:var(--tos-primary); font-size:13px; font-weight:700; text-align:center; }
    .elist { list-style:none; margin:0; padding:0; display:grid; }
    .elist li { display:flex; align-items:center; justify-content:space-between; gap:10px; min-height:56px; padding:8px 0; border-top:1px solid var(--tos-line); }
    .elist li:first-child { border-top:0; }
    .elist .what { display:grid; gap:2px; min-width:0; }
    .elist .what strong { font-size:16px; }
    .elist .what small { color:var(--tos-ink-soft); font-size:13px; }
    .elist .acts { display:flex; gap:4px; flex:none; }
    .icon-btn.sm { display:grid; place-items:center; width:40px; height:40px; border:1px solid var(--tos-line); border-radius:10px; background:var(--tos-card); color:var(--tos-ink); cursor:pointer; }
    .elist li.removing { flex-wrap:wrap; }
    .confirm-row { display:flex; flex-wrap:wrap; align-items:center; gap:6px; font-size:14px; font-weight:600; }
    .btn.sm { min-height:40px; padding:0 12px; }
    .btn.danger { border-color:var(--tos-danger, #b3261e); color:var(--tos-danger, #b3261e); }
    .link { justify-self:start; border:0; background:none; padding:6px 0; color:var(--tos-primary); font:inherit; font-weight:700; cursor:pointer; }
    .confirm h2 { margin:0; }
    .sumlist .kat { color:var(--tos-ink-soft); }
    .totals { display:grid; grid-template-columns:1fr 1fr; gap:10px; }
    .totals div { display:grid; padding:12px 14px; border:1px solid var(--tos-line); border-radius:var(--tos-radius); background:var(--tos-card); }
    .totals small { color:var(--tos-ink-soft); font-weight:700; }
    .totals strong { font-size:24px; white-space:nowrap; font-variant-numeric:tabular-nums; }
    .bar { height:8px; border-radius:4px; background:var(--tos-line); overflow:hidden; }
    .bar i { display:block; height:100%; background:var(--tos-primary); }
    .today { margin:0; color:var(--tos-ink-soft); font-weight:700; }
    .printed { display:flex; flex-direction:row; align-items:center; gap:10px; color:var(--tos-primary); font-weight:700; text-decoration:none; }
    .confirm { border-color:var(--tos-warn); background:var(--tos-warn-soft); }
    .confirm p { margin:0; }
    /* A sheet at the bottom: it opens over the tiles wherever the list was scrolled to. */
    .entry-backdrop { position:fixed; inset:0; z-index:40; background:rgb(0 0 0 / .35); }
    .entry { position:fixed; z-index:41; inset-inline:0; bottom:0; display:grid; gap:16px; max-height:85vh; overflow:auto; overscroll-behavior:contain; margin:0 auto; max-width:560px; padding:18px 16px calc(16px + env(safe-area-inset-bottom)); border:0; border-radius:20px 20px 0 0; box-shadow:0 -8px 30px rgb(0 0 0 / .2); transition:bottom .15s ease-out; }
    @media (min-width:1024px) and (pointer:fine) { .entry { bottom:auto !important; top:50%; transform:translateY(-50%); border-radius:18px; max-width:480px; } }
    .entry:focus { outline:none; }
    .sheet-head { display:flex; align-items:flex-start; gap:12px; }
    .sheet-head > div { flex:1; min-width:0; display:grid; gap:2px; }
    .sheet-head h2 { margin:0; font-size:20px; }
    .x { flex:none; display:grid; place-items:center; width:44px; height:44px; margin:-6px -6px 0 0; border:0; border-radius:50%; background:var(--tos-bg, #f6f3f1); color:var(--tos-ink); cursor:pointer; }
    .x:focus-visible, .seg button:focus-visible, .stepper button:focus-visible, .chip:focus-visible { outline:3px solid var(--tos-primary); outline-offset:2px; }
    .field { display:grid; gap:8px; }
    .field-label { font-size:15px; font-weight:700; }
    .field-label em { color:var(--tos-ink-soft); font-style:normal; font-weight:600; }
    .seg { display:grid; grid-template-columns:1fr 1fr; padding:4px; border-radius:12px; background:var(--tos-line); }
    .seg button { min-height:48px; border:0; border-radius:9px; background:transparent; color:var(--tos-ink); font:inherit; font-weight:700; cursor:pointer; }
    .seg button.on { background:var(--tos-card); box-shadow:0 1px 3px rgb(0 0 0 / .15); color:var(--tos-primary); }
    .bales-row { display:grid; gap:16px; }
    .stepper { display:grid; grid-template-columns:56px minmax(0, 1fr) 56px; gap:8px; }
    .stepper button { display:grid; place-items:center; height:64px; border:2px solid var(--tos-line); border-radius:14px; background:var(--tos-card); color:var(--tos-ink); cursor:pointer; }
    .stepper button:disabled { opacity:.4; }
    .stepper input { min-width:0; height:64px; padding:0; border:2px solid var(--tos-line); border-radius:14px; background:var(--tos-card); color:var(--tos-ink); font:inherit; font-size:30px; font-weight:800; text-align:center; font-variant-numeric:tabular-nums; }
    .stepper input:focus { outline:0; border-color:var(--tos-primary); box-shadow:0 0 0 3px var(--tos-primary-soft, #f3e8ef); }
    .save { width:100%; min-height:56px; font-size:17px; }
    .save .what { font-weight:600; }
    .kb-proxy { position:fixed; top:0; left:0; width:1px; height:1px; opacity:0; border:0; padding:0; font-size:16px; pointer-events:none; }
    .sum { margin:0; color:var(--tos-ink-soft); font-weight:700; }
    .err { margin:0; color:var(--tos-danger, #b3261e); font-weight:600; }
    .kat h2 { margin:0; }
    .ready h2 { margin:0; }
    .ready .row { align-items:center; }
    .ready .row .btn { flex:none; min-height:44px; padding:0 14px; }
    .made { display:flex; flex-wrap:wrap; gap:4px 12px; margin:0; color:var(--tos-ink-soft); font-size:14px; }
    .grades { display:flex; flex-wrap:wrap; gap:8px; }
    .grades .chip { min-height:44px; padding-inline:16px; }
  `],
})
export class SortWorkComponent implements OnInit {
  /** Lot id (stage 1) or category output id (stage 2), from the route. */
  readonly id = input.required<string>();
  private readonly route = inject(ActivatedRoute);
  private readonly data = inject(FloorDataService);
  private readonly queue = inject(OfflineQueueService);
  private readonly toast = inject(ToastService);
  private readonly tenant = inject(TenantService);
  private readonly i18n = inject(I18nService);
  protected readonly nav = inject(NavService);
  /** A laptop: wide layout, the shared header and typed numbers (phones keep the floor screen). */
  protected readonly desktop = typeof matchMedia === 'function' && matchMedia('(pointer: fine) and (min-width: 1024px)').matches;
  protected readonly icons = { ArrowLeft, CheckCircle2, Minus, Plus, Printer, Trash2, X };
  protected readonly stage = signal<Stage>(1);

  protected readonly title = signal('');
  protected readonly inputKg = signal(0);
  private readonly categories = signal<CategoryRow[]>([]);
  private readonly grades = signal<Named[]>([]);
  private readonly waste = signal<WasteType | null>(null);
  /** Session id from the server, or the id of the queued "start" while offline. */
  private readonly sessionId = signal<string | null>(null);
  private readonly startQueueId = signal<string | null>(null);
  /** kg and bales per kind already on the server (from the summary). */
  private readonly serverKg = signal<Record<string, number>>({});
  private readonly serverBales = signal<Record<string, number>>({});
  private readonly serverWasteKg = signal(0);
  protected readonly today = signal<{ kg: number; bales: number; pieces?: number } | null>(null);
  protected readonly picking = signal<Tile | null>(null);
  /** Grading: why this entry cannot be graded (graded while sorting, in bales, already graded, not found). */
  protected readonly blocked = signal<string | null>(null);
  protected readonly gradeLot = signal<{ id: string; code: string } | null>(null);
  protected readonly entry = signal<Entry | null>(null);
  protected readonly lastBales = signal<{ ids: string[]; name: string } | null>(null);
  /** This lot's sorted kg not baled yet, and the bales made from it (v2 6.6). */
  protected readonly ready = signal<ReadyRow[]>([]);
  protected readonly madeBales = signal<NonNullable<SortSummary['madeBales']>>([]);
  /** Stage 2 and waste: the kg being typed in the small sheet. */
  protected readonly pickKg = signal<number | null>(null);
  protected readonly sheetOpen = computed(() => !!this.entry() || !!this.picking());
  /** How much of the screen the phone's keyboard covers: the sheet sits just above it. */
  protected readonly kbInset = signal(0);
  private readonly viewportH = signal<number | null>(null);
  protected readonly sheetMaxH = computed(() => (this.viewportH() ? `${Math.round(this.viewportH()! - 24)}px` : null));
  private readonly kbProxy = viewChild<ElementRef<HTMLInputElement>>('kbProxy');
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  /** The tile or button that opened the sheet: the focus goes back to it when the sheet closes. */
  private opener: HTMLElement | null = null;
  protected readonly confirmClose = signal(false);
  /** The lot (supplier, raw type, day, cost per kg) and its entries, newest first (v2 sorting review). */
  protected readonly lot = signal<SortLot | null>(null);
  protected readonly entries = signal<SortEntry[]>([]);
  protected readonly showAll = signal(false);
  protected readonly shownEntries = computed(() => (this.showAll() ? this.entries() : this.entries().slice(0, 8)));
  protected readonly removing = signal<string | null>(null);
  protected readonly busyRemove = signal(false);
  /** "Shershah Gaari · Mixed · 11 Nov 2026": who sold it, what is inside, the day bought. */
  protected readonly lotMeta = computed(() => {
    const l = this.lot();
    if (!l) return '';
    const day = new Date(l.boughtAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
    return [l.supplier ?? l.container, l.rawType, day].filter(Boolean).join(' · ');
  });
  /**
   * What closing would book, per category and grade ("Jeans · A"), before the question: the server's kinds plus
   * lines saved on this phone and not synced yet (by category).
   */
  protected readonly closePreview = computed(() => {
    const rows = new Map<string, { name: string; kg: number }>();
    for (const k of this.serverKinds()) {
      const name = k.gradeName ? `${k.categoryName} · ${k.gradeName}` : k.categoryName;
      rows.set(name, { name, kg: (rows.get(name)?.kg ?? 0) + Number(k.kg) });
    }
    const names = new Map(this.kinds().map((k) => [k.id, k.name]));
    for (const w of this.pendingLines()) {
      const name = names.get(String(w.meta?.['kind'])) ?? '';
      const kg = Number(w.meta?.['kg'] ?? 0) * (w.meta?.['type'] === 'undo' ? -1 : 1);
      if (name) rows.set(name, { name, kg: (rows.get(name)?.kg ?? 0) + kg });
    }
    return [...rows.values()].filter((r) => r.kg > 0).sort((a, b) => b.kg - a.kg);
  });
  private readonly serverKinds = signal<NonNullable<SortSummary['kinds']>>([]);
  /** "Close lot" while sorting; "Finish grading" while grading (it does not close the lot). */
  protected readonly closeWord = computed(() => (this.stage() === 1 ? 'sort.closeLot' : 'sort.finishGrading'));
  /** After closing: the lot's page (laptop, or grading of a lot), else the sorting list. */
  protected readonly doneLink = computed<string | string[]>(() =>
    this.stage() === 2 && this.gradeLot() ? ['/sort/records', this.gradeLot()!.id] : this.desktop && this.stage() === 1 ? ['/sort/records', this.id()] : '/sort',
  );
  protected readonly outputKgAtClose = computed(() => (this.result() ?? []).reduce((s, o) => s + Number(o.weightKg), 0));
  protected readonly closing = signal(false);
  protected readonly throwing = signal(false);
  protected readonly result = signal<SessionOutput[] | null>(null);
  protected readonly kat = signal<SortSummary['kat'] | null>(null);
  protected readonly closedOnline = signal(true);
  protected readonly wasteAtClose = signal(0);

  /** Writes whose answer the server totals already include (their entries leave the pending list a moment later). */
  private readonly inServerTotals = signal<ReadonlySet<string>>(new Set());
  /** Lines saved on this phone but not synced yet, for this session. */
  private readonly pendingLines = computed(() =>
    this.queue
      .pendingOf('sort', (m) => m['target'] === this.id() && m['stage'] === this.stage() && (m['type'] === 'line' || m['type'] === 'undo' || m['type'] === 'waste'))
      // Counting such a line twice would make the lot look fully sorted, and "Close lot" would skip the kat question.
      .filter((w) => !this.inServerTotals().has(w.id)),
  );
  private readonly kgByKind = computed(() => {
    const kg = { ...this.serverKg() };
    for (const w of this.pendingLines()) {
      const m = w.meta as { kind: string; kg: number; type: string };
      if (m.type === 'waste') continue;
      kg[m.kind] = (kg[m.kind] ?? 0) + (m.type === 'undo' ? -m.kg : m.kg);
    }
    return kg;
  });
  private readonly balesByKind = computed(() => {
    const n = { ...this.serverBales() };
    for (const w of this.pendingLines()) {
      const m = w.meta as { kind: string; bales?: number; type: string };
      if (!m.bales) continue;
      n[m.kind] = (n[m.kind] ?? 0) + (m.type === 'undo' ? -m.bales : m.bales);
    }
    return n;
  });
  protected readonly totalBales = computed(() => Object.values(this.balesByKind()).reduce((s, v) => s + v, 0));
  private readonly wasteKg = computed(() => this.serverWasteKg() + this.pendingLines().filter((w) => w.meta?.['type'] === 'waste').reduce((s, w) => s + Number(w.meta?.['kg'] ?? 0), 0));
  protected readonly sortedKg = computed(() => round(Object.values(this.kgByKind()).reduce((s, v) => s + v, 0) + this.wasteKg()));
  protected readonly leftKg = computed(() => round(this.inputKg() - this.sortedKg()));
  protected readonly donePct = computed(() =>
    this.byPieces()
      ? Math.min(100, Math.round((this.sortedPieces() / this.lotPieces()) * 100))
      : this.inputKg() ? Math.min(100, Math.round((this.sortedKg() / this.inputKg()) * 100)) : 0,
  );

  /** A lot bought by the piece is sorted in pieces (owner, 2026-11-11): each entry's kg is its share of the lot's kg. */
  protected readonly lotPieces = computed(() => (this.stage() === 1 ? this.lot()?.pieces ?? 0 : 0));
  protected readonly byPieces = computed(() => this.lotPieces() > 0);
  private readonly serverPieces = signal(0);
  protected readonly sortedPieces = computed(() =>
    this.serverPieces() + this.pendingLines().reduce((s, w) => s + Number(w.meta?.['pieces'] ?? 0) * (w.meta?.['type'] === 'undo' ? -1 : 1), 0),
  );
  protected readonly leftPieces = computed(() => this.lotPieces() - this.sortedPieces());
  /** What is left, as the owner reads it: pieces for a lot bought by the piece, else kg. */
  protected readonly leftText = computed(() => (this.byPieces() ? this.i18n.t('ws.lf.piecesN', { n: this.i18n.num(this.leftPieces()) }) : this.i18n.kg(this.leftKg())));
  /** Save is possible: pieces typed (a lot by the piece, even without kg), a bale of pieces, or some kg. */
  protected readonly canSave = computed(() => {
    const e = this.entry();
    if (!e) return false;
    if (this.byPieces() && e.purpose === 'sort') return (e.pieces ?? 0) > 0;
    if (e.purpose === 'bale' && e.baleBy === 'pieces') return (e.piecesPerBale ?? 0) > 0 && e.bales > 0;
    return this.entryKg() > 0;
  });

  /** Stage 1: one tile per category (the grade, if any, is picked in the sheet). Stage 2: grades. */
  private readonly kinds = computed<Kind[]>(() => {
    if (this.stage() === 2) return this.grades().map((g) => ({ id: g.id, name: g.name, categoryId: '', gradeId: g.id, baleKg: null }));
    return this.categories().map((c) => ({ id: c.id, name: c.name, categoryId: c.id, gradeId: null, baleKg: c.baleWeightKg ? Number(c.baleWeightKg) : null }));
  });

  /** Grades a worker may give while sorting or baling — none when the business does not grade. */
  protected readonly gradeOptions = computed(() => ((this.tenant.tenant()?.sortingStages ?? 2) >= 2 ? this.grades() : []));

  protected readonly tiles = computed<Tile[]>(() => {
    const kg = this.kgByKind();
    const bales = this.balesByKind();
    const tiles: Tile[] = this.inFixedOrder(this.kinds()).map((k) => ({
      id: k.id,
      label: k.name,
      sub: [bales[k.id] ? `${this.i18n.num(bales[k.id])} ${this.i18n.t(bales[k.id] === 1 ? 'unit.bale' : 'unit.bales')}` : '', kg[k.id] ? this.i18n.kg(kg[k.id]) : ''].filter(Boolean).join(' · '),
    }));
    // Grading a category output separately still records its waste; sorting a lot books kat at the end.
    if (this.stage() === 2) tiles.push({ id: WASTE_TILE, label: this.waste()?.name || this.i18n.t('sort.waste'), sub: this.wasteKg() ? this.i18n.kg(this.wasteKg()) : '', tone: 'waste' });
    return tiles;
  });

  protected readonly entryKg = computed(() => {
    const e = this.entry();
    if (!e) return 0;
    if (this.byPieces() && e.purpose === 'sort') {
      const n = e.pieces ?? 0;
      if (!n) return 0;
      // The last pieces take what is left, so the lot ends at exactly its kg.
      return n === this.leftPieces() ? Math.max(this.leftKg(), 0) : round((n * this.inputKg()) / this.lotPieces());
    }
    return e.mode === 'bales' ? round(e.bales * (e.baleKg ?? 0)) : e.kg ?? 0;
  });
  /** Sorting can take what is left of the lot; "Make bales" what is sorted and not baled. */
  protected readonly limitKg = computed(() => {
    const e = this.entry();
    return e?.purpose === 'bale' && e.ready ? Number(e.ready.availableKg) : this.leftKg();
  });
  protected readonly tooMuch = computed(() => {
    const e = this.entry();
    if (this.byPieces() && e?.purpose === 'sort') return (e.pieces ?? 0) > this.leftPieces();
    if (e?.purpose === 'bale' && e.baleBy === 'pieces') return e.bales * (e.piecesPerBale ?? 0) > (e.ready?.availablePieces ?? 0);
    return this.entryKg() > this.limitKg() + 0.001;
  });

  constructor() {
    // Lines are sent in the background: when one reaches the server, its answer is the session's new state.
    const stop = this.queue.onSynced((write, response) => {
      const m = write.meta;
      if (m?.['target'] !== this.id() || m?.['stage'] !== this.stage()) return;
      if (response && typeof response === 'object' && 'buckets' in response) {
        this.inServerTotals.update((ids) => new Set(ids).add(write.id));
        this.applySummary(response as SortSummary);
      }
    });
    const destroy = inject(DestroyRef);
    destroy.onDestroy(stop);

    // The phone's keyboard: keep the sheet above it (iPhone does not shrink the page for it).
    const vv = typeof window !== 'undefined' ? window.visualViewport : null;
    if (vv) {
      const fit = () => {
        this.kbInset.set(Math.max(0, Math.round(window.innerHeight - vv.height - vv.offsetTop)));
        this.viewportH.set(vv.height);
      };
      vv.addEventListener('resize', fit);
      vv.addEventListener('scroll', fit);
      destroy.onDestroy(() => { vv.removeEventListener('resize', fit); vv.removeEventListener('scroll', fit); });
    }

    // A sheet takes the focus when it opens (its kg box, or the sheet itself) and gives it back when it closes.
    let wasOpen = false;
    effect(() => {
      const open = this.sheetOpen();
      untracked(() => {
        if (open && !wasOpen) {
          setTimeout(() => {
            const sheet = this.host.nativeElement.querySelector<HTMLElement>('.entry');
            if (sheet && !sheet.contains(document.activeElement)) sheet.focus();
          }, 50);
        } else if (!open && wasOpen) {
          const back = this.opener;
          this.opener = null;
          if (back?.isConnected) setTimeout(() => back.focus());
        }
        wasOpen = open;
      });
    });
  }

  /** Called in the tap itself: iPhone opens the keyboard only for a focus made during the tap. */
  private keyboardNow(): void {
    const proxy = this.kbProxy()?.nativeElement;
    if (!proxy) return;
    proxy.value = '';
    proxy.focus({ preventScroll: true });
    // Keys typed before the kg box takes over land here: hand them to the box, cursor at the end.
    const handOver = (e: FocusEvent) => {
      const box = e.target;
      if (box === proxy) return;
      document.removeEventListener('focusin', handOver, true);
      const typed = proxy.value;
      proxy.value = '';
      if (!typed || !(box instanceof HTMLInputElement)) return;
      box.value = typed;
      box.dispatchEvent(new Event('input', { bubbles: true }));
      queueMicrotask(() => queueMicrotask(() => box.setSelectionRange(box.value.length, box.value.length)));
    };
    document.addEventListener('focusin', handOver, true);
  }

  private rememberOpener(): void {
    const el = document.activeElement;
    this.opener = el instanceof HTMLElement && el !== document.body ? el : null;
  }

  protected closeSheet(): void {
    this.entry.set(null);
    this.picking.set(null);
  }

  /** The bale count typed with the keyboard (1 to 200). */
  protected typedCount(ev: Event): void {
    const el = ev.target as HTMLInputElement;
    const digits = el.value.replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x6f0)).replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x660)).replace(/\D/g, '').slice(0, 3);
    if (digits !== el.value) el.value = digits;
    const n = Number(digits);
    if (digits && n >= 1) this.patch({ bales: Math.min(200, n) });
  }

  protected fixCount(ev: Event): void {
    (ev.target as HTMLInputElement).value = String(this.entry()?.bales ?? 1);
  }

  protected selectAll(ev: Event): void {
    const el = ev.target as HTMLInputElement;
    queueMicrotask(() => el.select());
  }

  ngOnInit(): void {
    this.stage.set(this.route.snapshot.data['stage'] === 2 ? 2 : 1);
    // Each part shows as soon as it arrives: tiles first (cached on the phone), totals when the session loads.
    this.data.wasteTypes().subscribe((w) => this.setWaste(w));
    this.data.grades().subscribe((g) => this.grades.set(g));
    if (this.stage() === 1) {
      this.data.categories().subscribe((c) => this.categories.set(c));
      this.data.lotsToSort().subscribe((lots) => {
        const lot = lots.find((l) => l.id === this.id());
        if (lot) this.setLot(lot);
        // Not in the (possibly cached) queue, e.g. received a moment ago: ask for this lot itself.
        else this.data.lot(this.id()).subscribe((one) => one && this.setLot(one));
      });
      this.data.sortSummary(this.id()).subscribe((summary) => {
        if (!this.inputKg() && summary?.session?.totalInputWeight) this.inputKg.set(Number(summary.session.totalInputWeight));
        this.applySummary(summary);
      });
    } else {
      // The entry itself (not the "waiting for grading" list, which holds closed lots only): a lot still being
      // sorted can be graded too, and an entry that cannot be graded says why.
      this.data.gradeOutput(this.id()).subscribe((o) => {
        if (!o) return this.blocked.set('NOT_FOUND');
        this.title.set(o.category.name);
        this.gradeLot.set(o.lot);
        if (o.lot) this.nav.setName(o.id, o.category.name);
        this.inputKg.set(Number(o.weightKg));
        if (!o.canGrade) return this.blocked.set(o.blocked);
        if (o.gradeSession?.status === 'OPEN') this.data.gradeSession(o.gradeSession.id).subscribe((s) => this.applySummary(s));
      });
    }
  }

  /** "3:42 pm" today, "9 Nov, 3:42 pm" before. */
  protected when(at: string): string {
    const d = new Date(at);
    const time = d.toLocaleTimeString('en-GB', { hour: 'numeric', minute: '2-digit', hour12: true });
    return d.toDateString() === new Date().toDateString() ? time : `${d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}, ${time}`;
  }

  /** Takes one entry back (and its bales, if none is used); the list and totals come back from the server. */
  protected async removeEntry(e: SortEntry): Promise<void> {
    this.busyRemove.set(true);
    try {
      const r = await this.queue.send<SortSummary>({
        kind: 'sort',
        label: `${this.title()} · ${e.categoryName} · −${this.i18n.kg(e.kg)}`,
        url: `/api/sorting/stage-1/entries/${e.id}/remove`,
        body: {},
        meta: { target: this.id(), stage: 1, type: 'undo', kind: e.categoryId, kg: Number(e.kg), bales: e.bales, pieces: this.byPieces() ? e.pieces ?? 0 : 0 },
      });
      if (r.saved) this.applySummary(r.response);
      if (e.baleIds.length && this.lastBales()?.ids.some((id) => e.baleIds.includes(id))) this.lastBales.set(null);
      this.toast.show(this.i18n.t('sort.removed', { name: e.gradeName ? `${e.categoryName} · ${e.gradeName}` : e.categoryName }));
    } catch (err: any) {
      this.toast.error(err?.error?.message || this.i18n.t('common.couldNotSave'));
    } finally {
      this.busyRemove.set(false);
      this.removing.set(null);
    }
  }

  protected pct(kg: string | number): number {
    return this.inputKg() ? Math.round((Number(kg) / this.inputKg()) * 100) : 0;
  }

  protected startLine(tile: Tile): void {
    this.rememberOpener();
    if (this.stage() === 2 || tile.id === WASTE_TILE) {
      // One tap on the tile, then the kg: the keyboard opens straight away.
      this.keyboardNow();
      this.pickKg.set(null);
      this.picking.set(tile);
      return;
    }
    const kind = this.kinds().find((k) => k.id === tile.id);
    if (!kind) return;
    const baleKg = lastBaleKg(kind.id) ?? kind.baleKg;
    // A lot bought by the piece: the number of pieces, the keyboard at once.
    if (this.byPieces()) {
      this.keyboardNow();
      this.entry.set({ purpose: 'sort', kind, ready: null, mode: 'kg', gradeId: this.lastGrade(kind.id), bales: 1, baleKg, kg: null, pieces: null });
      return;
    }
    // Bales first when this category has a bale weight; the worker can switch to loose kg. The grade is optional.
    // Without a bale weight it starts on loose kg, and the keyboard opens at once.
    if (!baleKg) this.keyboardNow();
    this.entry.set({ purpose: 'sort', kind, ready: null, mode: baleKg ? 'bales' : 'kg', gradeId: this.lastGrade(kind.id), bales: 1, baleKg, kg: null });
  }

  /** "Make bales" from this lot's sorted kg of one kind; ungraded kg can be given a grade now. */
  protected startBales(r: ReadyRow): void {
    const kind = this.kinds().find((k) => k.id === r.categoryId) ?? { id: r.categoryId, name: r.categoryName, categoryId: r.categoryId, gradeId: null, baleKg: null };
    this.rememberOpener();
    const baleKg = lastBaleKg(kind.id) ?? kind.baleKg;
    if (!baleKg) this.keyboardNow();
    // Pieces ready (a lot sorted in pieces): bales of a number of pieces first; kg per bale is one tap away.
    const byPieces = !!r.availablePieces && (this.byPieces() || Number(r.availableKg) === 0);
    this.entry.set({ purpose: 'bale', kind, ready: r, mode: 'bales', gradeId: r.gradeId, bales: 1, baleKg: byPieces ? null : baleKg, kg: null, baleBy: byPieces ? 'pieces' : 'kg', piecesPerBale: null });
  }

  /** Kg of a bale of `pieces` pieces: the kind's ready kg per piece. */
  protected piecesKg(e: Entry, pieces: number | null): number | null {
    const kg = Number(e.ready?.availableKg ?? 0), n = e.ready?.availablePieces ?? 0;
    // Pieces sorted without a weight: kg is only what was weighed, kept as typed.
    if (!kg) return e.baleKg;
    return pieces && n ? round((pieces * kg) / n) : null;
  }

  protected canPickGrade(e: Entry): boolean {
    return this.gradeOptions().length > 0 && (e.purpose === 'sort' || !e.ready?.gradeId);
  }

  protected readyKey(r: ReadyRow): string {
    return kindKey(r.categoryId, r.gradeId);
  }

  protected rowName(r: { categoryName: string; gradeName: string | null }): string {
    return r.gradeName ? `${r.categoryName} · ${r.gradeName}` : r.categoryName;
  }

  protected save(): void {
    void (this.entry()?.purpose === 'bale' ? this.saveBales() : this.saveEntry());
  }

  /** Bales from sorted kg of this lot: into stock with stickers, sellable at once; the lot stays in sorting. */
  private async saveBales(): Promise<void> {
    const e = this.entry();
    const kg = this.entryKg();
    if (!e?.ready || !this.canSave() || this.tooMuch()) return;
    if (e.baleBy !== 'pieces' && !e.baleKg) return;
    this.entry.set(null);
    const pieces = e.baleBy === 'pieces' ? e.piecesPerBale ?? 0 : 0;
    if (!pieces && e.baleKg) rememberBaleKg(e.kind.id, e.baleKg);
    const grade = this.gradeOptions().find((g) => g.id === e.gradeId) ?? null;
    const name = grade ? `${e.kind.name} · ${grade.name}` : e.kind.name;
    const what = `${this.i18n.num(e.bales)} ${this.i18n.t(e.bales === 1 ? 'unit.bale' : 'unit.bales')}${pieces ? ` · ${this.i18n.t('sort.piecesEach', { n: this.i18n.num(pieces) })}` : ''}${kg ? ` · ${this.i18n.kg(kg)}` : ''}`;
    try {
      const r = await this.queue.send<{ baleIds?: string[] }>({
        kind: 'bale',
        label: `${this.title()} · ${name} · ${what}`,
        url: '/api/stock/bales',
        body: { categoryId: e.kind.categoryId, ...(e.gradeId ? { gradeId: e.gradeId } : {}), fromUngraded: !e.ready.gradeId, ragId: this.id(), count: e.bales, ...(e.baleKg ? { weightKg: e.baleKg } : {}), ...(pieces ? { pieces } : {}) },
        meta: { kind: kindKey(e.kind.categoryId, e.ready.gradeId), kg },
      });
      if (r.saved && r.response.baleIds?.length) this.lastBales.set({ ids: r.response.baleIds, name });
      this.toast.show(r.saved ? this.i18n.t('sort.balesSaved', { what, name }) : this.i18n.t('sync.savedOnPhone'));
      this.data.sortSummary(this.id()).subscribe((s) => this.applySummary(s));
    } catch (err: any) {
      this.toast.error(err?.error?.message || this.i18n.t('common.couldNotSave'));
    }
  }

  protected setMode(mode: Mode): void {
    const e = this.entry();
    if (!e || e.mode === mode) return;
    // The new box gets the cursor: loose kg always, bales when there is no bale weight yet.
    if (mode === 'kg' || !e.baleKg) this.keyboardNow();
    this.patch({ mode });
  }

  protected step(by: number): void {
    const e = this.entry();
    if (e) this.patch({ bales: Math.max(1, Math.min(200, e.bales + by)) });
  }

  protected patch(change: Partial<Entry>): void {
    this.entry.update((e) => (e ? { ...e, ...change } : e));
  }

  /** Saves the entry: bales (into stock with stickers) or loose kg. */
  protected async saveEntry(): Promise<void> {
    const e = this.entry();
    const kg = this.entryKg();
    if (!e || !this.canSave() || this.tooMuch()) return;
    this.entry.set(null);
    const bales = e.mode === 'bales' ? e.bales : 0;
    if (bales) rememberBaleKg(e.kind.id, e.baleKg!);
    rememberGrade(e.kind.id, e.gradeId);
    const grade = this.gradeOptions().find((g) => g.id === e.gradeId) ?? null;
    const kind = { ...e.kind, name: grade ? `${e.kind.name} · ${grade.name}` : e.kind.name };
    const sessionId = await this.ensureSession();
    const pieces = this.byPieces() ? e.pieces ?? 0 : 0;
    const body = {
      sessionId,
      categoryId: e.kind.categoryId,
      ...(e.gradeId ? { gradeId: e.gradeId } : {}),
      ...(pieces ? { pieces } : bales ? { bales, baleWeightKg: e.baleKg } : { amountKg: kg }),
    };
    const what = pieces
      ? `${this.i18n.t('ws.lf.piecesN', { n: this.i18n.num(pieces) })}${kg ? ` · ${this.i18n.kg(kg)}` : ''}`
      : bales ? `${this.i18n.num(bales)} ${this.i18n.t(bales === 1 ? 'unit.bale' : 'unit.bales')} · ${this.i18n.kg(kg)}` : this.i18n.kg(kg);
    try {
      const r = await this.queue.send<SortSummary>({
        kind: 'sort',
        label: `${this.title()} · ${kind.name} · ${what}`,
        url: '/api/sorting/stage-1/allocate',
        body,
        meta: { target: this.id(), stage: 1, type: 'line', kind: e.kind.id, kg, bales, pieces },
        background: !bales,
      });
      if (r.saved) {
        this.applySummary(r.response);
        if (r.response.baleIds?.length) this.lastBales.set({ ids: r.response.baleIds, name: kind.name });
      }
      countUse(this.usageKey(), e.kind.id);
      this.toast.show(this.i18n.t('sort.added', { kg: what, name: kind.name }), { undo: () => void this.undoEntry(kind, body, kg, bales, what) });
    } catch (err: any) {
      this.toast.error(err?.error?.message || this.i18n.t('common.couldNotSave'));
    }
  }

  private async undoEntry(kind: Kind, body: Record<string, unknown>, kg: number, bales: number, what: string): Promise<void> {
    try {
      const r = await this.queue.send<SortSummary>({
        kind: 'sort',
        label: `${this.title()} · ${kind.name} · −${what}`,
        url: '/api/sorting/stage-1/unallocate',
        body: { ...body, sessionId: await this.ensureSession() },
        meta: { target: this.id(), stage: 1, type: 'undo', kind: kind.id, kg, bales },
        background: true,
      });
      if (r.saved) this.applySummary(r.response);
      if (bales) this.lastBales.set(null);
    } catch (e: any) {
      this.toast.error(e?.error?.message || this.i18n.t('common.couldNotSave'));
    }
  }

  /** Stage 2 (and waste while grading): one kg line. */
  protected async saveLine(tile: Tile, kg: number | null): Promise<void> {
    this.picking.set(null);
    if (!kg) return;
    const isWaste = tile.id === WASTE_TILE;
    const base = `/api/sorting/stage-${this.stage()}`;
    const sessionId = await this.ensureSession();
    const body = isWaste ? { sessionId, wasteCategoryId: this.waste()?.id, amount: kg } : { sessionId, gradeId: tile.id, amountKg: kg };
    try {
      const r = await this.queue.send<SortSummary>({
        kind: 'sort',
        label: `${this.title()} · ${tile.label} · ${this.i18n.kg(kg)}`,
        url: `${base}/${isWaste ? 'waste' : 'allocate'}`,
        body,
        meta: { target: this.id(), stage: this.stage(), type: isWaste ? 'waste' : 'line', kind: tile.id, kg },
        background: true,
      });
      if (r.saved) this.applySummary(r.response);
      if (!isWaste) countUse(this.usageKey(), tile.id);
      this.toast.show(this.i18n.t('sort.added', { kg: this.i18n.kg(kg), name: tile.label }), isWaste ? {} : { undo: () => void this.undoLine(tile, kg) });
    } catch (e: any) {
      this.toast.error(e?.error?.message || this.i18n.t('common.couldNotSave'));
    }
  }

  private async undoLine(tile: Tile, kg: number): Promise<void> {
    const base = `/api/sorting/stage-${this.stage()}`;
    try {
      const r = await this.queue.send<SortSummary>({
        kind: 'sort',
        label: `${this.title()} · ${tile.label} · −${this.i18n.kg(kg)}`,
        url: `${base}/unallocate`,
        body: { sessionId: await this.ensureSession(), gradeId: tile.id, amountKg: kg },
        meta: { target: this.id(), stage: this.stage(), type: 'undo', kind: tile.id, kg },
        background: true,
      });
      if (r.saved) this.applySummary(r.response);
    } catch (e: any) {
      this.toast.error(e?.error?.message || this.i18n.t('common.couldNotSave'));
    }
  }

  protected askClose(): void {
    if (this.byPieces()) {
      if (this.leftPieces() > 0) this.confirmClose.set(true);
      else void this.close();
      return;
    }
    if (this.inputKg() <= 0) return; // weight not known yet (the button is disabled meanwhile)
    if (this.leftKg() > 0) this.confirmClose.set(true);
    else void this.close();
  }

  protected async close(): Promise<void> {
    this.confirmClose.set(false);
    this.closing.set(true);
    const left = Math.max(0, this.leftKg());
    const sessionId = await this.ensureSession();
    const url = typeof sessionId === 'string' ? `/api/sorting/stage-${this.stage()}/${sessionId}/seal` : `/api/sorting/stage-${this.stage()}/{ref:${this.startQueueId()}:session.id}/seal`;
    try {
      const r = await this.queue.send<SortSummary | { outputsCreated: number }>({
        kind: 'sort',
        method: 'PATCH',
        label: `${this.title()} · ${this.i18n.t('sort.closeLot')}`,
        url,
        body: this.waste() ? { wasteCategoryId: this.waste()!.id } : {},
        meta: { target: this.id(), stage: this.stage(), type: 'close' },
      });
      this.wasteAtClose.set(round(this.wasteKg() + left));
      const names = new Map(this.kinds().map((k) => [k.id, k.name]));
      const local = Object.entries(this.kgByKind())
        .filter(([, kg]) => kg > 0)
        .map(([id, kg]) => ({ id, name: names.get(id) ?? '', weightKg: String(kg), cost: '', costPerKg: '', bales: this.balesByKind()[id] ?? 0 }));
      let outputs: SessionOutput[] = local;
      if (r.saved) {
        const summary = 'outputs' in r.response ? r.response : null;
        const fresh = summary?.outputs?.length ? summary : await this.reload();
        if (fresh?.outputs?.length) {
          outputs = fresh.outputs;
          // The server's outputs are the truth: kat is what the lot weighed minus what came out.
          this.wasteAtClose.set(round(this.inputKg() - outputs.reduce((s, o) => s + Number(o.weightKg), 0)));
          this.kat.set(fresh.kat ?? null);
        }
      }
      this.closedOnline.set(r.saved);
      this.result.set(outputs);
      // Closed: an entry can no longer be undone.
      this.toast.dismiss();
    } catch (e: any) {
      this.toast.error(e?.error?.message || this.i18n.t('common.couldNotSave'));
    } finally {
      this.closing.set(false);
    }
  }

  /** Kat nobody will buy: out of stock (it cost nothing). */
  protected async throwAway(itemId: string): Promise<void> {
    this.throwing.set(true);
    try {
      await this.queue.send({ kind: 'sort', label: `${this.title()} · ${this.i18n.t('sort.katThrowAway')}`, url: `/api/sorting/stage-1/kat/${itemId}/throw-away`, body: {}, meta: { target: this.id(), stage: 1, type: 'kat' } });
      this.kat.update((k) => (k ? { ...k, leftKg: '0' } : k));
    } catch (e: any) {
      this.toast.error(e?.error?.message || this.i18n.t('common.couldNotSave'));
    } finally {
      this.throwing.set(false);
    }
  }

  /** The session to write to: the real id, or (offline, first line) a reference to a queued start. */
  private async ensureSession(): Promise<unknown> {
    const id = this.sessionId();
    if (id) return id;
    if (!this.startQueueId()) {
      const pendingStart = this.queue.pendingOf('sort', (m) => m['target'] === this.id() && m['stage'] === this.stage() && m['type'] === 'start')[0];
      if (pendingStart) this.startQueueId.set(pendingStart.id);
      else {
        const r = await this.queue.send<SortSummary>({
          kind: 'sort',
          label: `${this.title()} · ${this.i18n.t('sort.title')}`,
          url: `/api/sorting/stage-${this.stage()}/start`,
          body: this.stage() === 1 ? { ragId: this.id() } : { categoryOutputId: this.id() },
          meta: { target: this.id(), stage: this.stage(), type: 'start' },
        });
        if (r.saved && r.response.session) {
          this.applySummary(r.response);
          return r.response.session.id;
        }
        this.startQueueId.set(r.id);
      }
    }
    return this.queue.ref(this.startQueueId()!, 'session.id');
  }

  private setLot(lot: { ragCode: string; weightKg: string }): void {
    this.title.set(lot.ragCode);
    if (this.stage() === 1) this.nav.setName(this.id(), lot.ragCode);
    if (Number(lot.weightKg) > 0) this.inputKg.set(Number(lot.weightKg));
  }

  private applySummary(summary: SortSummary | null): void {
    if (summary?.lot) {
      this.lot.set(summary.lot);
      if (!this.title()) this.title.set(summary.lot.code);
      if (!this.inputKg() && Number(summary.lot.weightKg) > 0) this.inputKg.set(Number(summary.lot.weightKg));
    }
    if (summary?.entries) this.entries.set(summary.entries);
    if (!summary?.session) return;
    if (!this.inputKg() && Number(summary.session.totalInputWeight) > 0) this.inputKg.set(Number(summary.session.totalInputWeight));
    this.sessionId.set(summary.session.id);
    const kg: Record<string, number> = {};
    const bales: Record<string, number> = {};
    if (this.stage() === 1 && summary.kinds) {
      // Tiles are categories: kg sorted per category (all grades, and kg from before v2 6.6), bales made from it.
      for (const b of summary.buckets) if (b.categoryId) kg[b.categoryId] = Number(b.outputWeightKg);
      for (const k of summary.kinds) bales[k.categoryId] = (bales[k.categoryId] ?? 0) + k.bales;
      this.serverKinds.set(summary.kinds);
      if (summary.today) this.today.set({ kg: Number(summary.today.kg), bales: summary.today.bales, pieces: summary.today.pieces ?? 0 });
      this.serverPieces.set(summary.kinds.reduce((t, k) => t + (k.pieces ?? 0), 0));
      this.ready.set(summary.ready ?? []);
      this.madeBales.set(summary.madeBales ?? []);
    } else {
      for (const b of summary.buckets) kg[(b.categoryId ?? b.gradeId)!] = Number(b.outputWeightKg);
    }
    this.serverKg.set(kg);
    this.serverBales.set(bales);
    this.serverWasteKg.set(summary.wasteLineItems.reduce((s, w) => s + Number(w.amount), 0));
    if (summary.session.status === 'CLOSED' && summary.outputs?.length && !this.result()) {
      this.result.set(summary.outputs);
      this.kat.set(summary.kat ?? null);
      this.wasteAtClose.set(round(this.inputKg() - summary.outputs.reduce((s, o) => s + Number(o.weightKg), 0)));
    }
  }

  private async reload(): Promise<SortSummary | null> {
    const id = this.sessionId();
    if (!id) return null;
    const obs = this.stage() === 1 ? this.data.sortSession(id) : this.data.gradeSession(id);
    return new Promise((resolve) => obs.subscribe((s) => resolve(s)));
  }

  private setWaste(list: WasteType[]): void {
    this.waste.set(list.find((w) => /katran/i.test(w.name)) ?? list[0] ?? null);
  }

  /** The grade last given to this category on this phone (sorting the same pile again is common). */
  private lastGrade(categoryId: string): string | null {
    try {
      const id = JSON.parse(localStorage.getItem(GRADE_KEY) || '{}')[categoryId];
      return typeof id === 'string' && this.gradeOptions().some((g) => g.id === id) ? id : null;
    } catch {
      return null;
    }
  }

  /**
   * Most-used first, but decided once when the screen opens: tiles do not jump while the worker is entering
   * (v2 cycle review). A category added meanwhile goes last.
   */
  private tileOrder: string[] | null = null;
  private inFixedOrder(kinds: Kind[]): Kind[] {
    if (!kinds.length) return kinds;
    this.tileOrder ??= usageOrder(kinds, this.usageKey()).map((k) => k.id);
    const at = (id: string) => { const i = this.tileOrder!.indexOf(id); return i < 0 ? Number.MAX_SAFE_INTEGER : i; };
    return [...kinds].sort((a, b) => at(a.id) - at(b.id));
  }

  private usageKey(): string {
    return this.stage() === 1 ? 'category' : 'grade';
  }
}

function round(n: number): number {
  return Math.round(n * 100) / 100;
}

/** The bale weight last used for a kind on this phone (it beats the category's usual weight). */
function lastBaleKg(kind: string): number | null {
  try {
    const v = JSON.parse(localStorage.getItem(BALE_KG_KEY) || '{}')[kind];
    return typeof v === 'number' && v > 0 ? v : null;
  } catch {
    return null;
  }
}

function rememberBaleKg(kind: string, kg: number): void {
  try {
    const all = JSON.parse(localStorage.getItem(BALE_KG_KEY) || '{}');
    all[kind] = kg;
    localStorage.setItem(BALE_KG_KEY, JSON.stringify(all));
  } catch {
    /* private window */
  }
}

function rememberGrade(categoryId: string, gradeId: string | null): void {
  try {
    const all = JSON.parse(localStorage.getItem(GRADE_KEY) || '{}');
    all[categoryId] = gradeId;
    localStorage.setItem(GRADE_KEY, JSON.stringify(all));
  } catch {
    /* private window */
  }
}
