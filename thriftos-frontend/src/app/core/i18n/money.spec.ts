import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { I18nService } from './i18n.service';
import { TilesComponent } from '../../shared/floor/tiles.component';

const EN = {
  common: { showAllN: 'Show all {n}', search: 'Search', empty: 'Nothing here' },
  unit: { rs: 'Rs {n}', money: '{money}', curName: { PKR: 'Rs', USD: '$', AED: 'AED' }, fmt: { USD: '${n}', AED: 'AED {n}' } },
  ws: { si: { pricePerBale: 'Price per bale ({money})' } },
};
const strip = (s: string) => s.replace(/[⁦-⁩]/g, '');

describe('money in the business currency', () => {
  let i18n: I18nService;

  beforeEach(async () => {
    try { localStorage.removeItem('thriftos.lang'); } catch { /* private mode */ }
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    i18n = TestBed.inject(I18nService);
    const loading = i18n.init();
    TestBed.inject(HttpTestingController).expectOne('/i18n/en.json').flush(EN);
    await loading;
  });

  it('shows rupees until the business says otherwise', () => {
    expect(strip(i18n.money(12500))).toBe('Rs 12,500');
    expect(i18n.t('ws.si.pricePerBale')).toBe('Price per bale (Rs)');
  });

  it('shows dollars for a business that keeps its books in USD, and other codes as they are', () => {
    i18n.setGlobal('currency', 'USD');
    expect(strip(i18n.money(800))).toBe('$800');
    expect(strip(i18n.money(0.8))).toBe('$0.80');
    expect(i18n.t('ws.si.pricePerBale')).toBe('Price per bale ($)');
    expect(i18n.t('unit.money')).toBe('$');
    i18n.setGlobal('currency', 'AED');
    expect(strip(i18n.money(50))).toBe('AED 50');
    i18n.setGlobal('currency', 'EUR');
    expect(strip(i18n.money(50))).toBe('EUR 50');
  });
});

describe('tiles with more than fit', () => {
  it('ends with "Show all N", which shows every tile', async () => {
    TestBed.configureTestingModule({ imports: [TilesComponent], providers: [provideHttpClient(), provideHttpClientTesting()] });
    const i18n = TestBed.inject(I18nService);
    const loading = i18n.init();
    TestBed.inject(HttpTestingController).expectOne('/i18n/en.json').flush(EN);
    await loading;
    const f = TestBed.createComponent(TilesComponent);
    f.componentRef.setInput('items', Array.from({ length: 213 }, (_, k) => ({ id: `c${k}`, label: `Category ${k}` })));
    f.componentRef.setInput('limit', 80);
    f.detectChanges();
    const el = f.nativeElement as HTMLElement;
    const more = el.querySelector<HTMLButtonElement>('.tile.more')!;
    expect(el.querySelectorAll('.tile:not(.more)').length).toBe(80);
    expect(more.textContent?.trim()).toBe('Show all 213');
    more.click();
    f.detectChanges();
    expect(el.querySelectorAll('.tile').length).toBe(213);
    expect(el.querySelector('input[type=search]')).not.toBeNull();
  });
});
