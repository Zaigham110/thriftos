import { Component, computed, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { I18nService } from '../../core/i18n/i18n.service';
import { I18N } from '../../core/i18n/t.pipe';

type Page = 'terms' | 'privacy';
const PARAGRAPHS = ['p1', 'p2', 'p3', 'p4', 'p5', 'p6'] as const;

/** Terms of use and Privacy, in English and Urdu (public, no login). Text lives in the dictionaries. */
@Component({
  selector: 'app-legal-page',
  standalone: true,
  imports: [RouterLink, I18N],
  template: `
    <main class="legal">
      <button type="button" class="link-btn lang" (click)="toggleLang()">{{ 'nav.language' | t }}</button>
      <h1>{{ 'legal.' + page() + '.title' | t }}</h1>
      @for (p of paragraphs; track p) { <p>{{ 'legal.' + page() + '.' + p | t }}</p> }
      <p class="updated">{{ 'legal.updated' | t }}</p>
      <nav>
        <a routerLink="/terms">{{ 'legal.terms.title' | t }}</a>
        <a routerLink="/privacy">{{ 'legal.privacy.title' | t }}</a>
        <a routerLink="/auth/login">{{ 'auth.signIn' | t }}</a>
      </nav>
    </main>
  `,
  styles: [`
    :host { display:block; min-height:100vh; background:var(--tos-canvas); }
    .legal { position:relative; max-width:680px; margin:0 auto; padding:32px 16px 48px; line-height:1.7; }
    .lang { position:absolute; inset-block-start:16px; inset-inline-end:16px; }
    h1 { font-size:26px; margin:0 0 12px; }
    .updated { color:var(--tos-ink-soft); font-size:14px; }
    nav { display:flex; gap:16px; flex-wrap:wrap; margin-top:24px; }
  `],
})
export class LegalPageComponent {
  private readonly i18n = inject(I18nService);
  /** From the route's data (component input binding). */
  readonly kind = input<Page>('terms');
  protected readonly page = computed(() => this.kind());
  protected readonly paragraphs = PARAGRAPHS;

  protected toggleLang(): void {
    this.i18n.use(this.i18n.lang() === 'ur' ? 'en' : 'ur');
  }
}
