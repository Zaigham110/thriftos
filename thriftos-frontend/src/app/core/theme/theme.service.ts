import { Injectable, signal } from '@angular/core';

export type Theme = 'light' | 'dark';
export type Density = 'comfortable' | 'compact';

const THEME_KEY = 'thriftos.theme';
const DENSITY_KEY = 'thriftos.density';

function read<T extends string>(key: string, allowed: readonly T[], fallback: T): T {
  try {
    const v = localStorage.getItem(key) as T | null;
    return v && allowed.includes(v) ? v : fallback;
  } catch {
    return fallback;
  }
}

function write(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Private mode or storage blocked: the choice lasts for this visit only.
  }
}

/**
 * Light/dark and comfortable/compact for the workspace, remembered on this device. Light is the default
 * (phones on the floor are used in daylight); dark is only ever chosen by the person.
 * Applied as html[data-theme] and html[data-density], which the --ws-* tokens read.
 */
@Injectable({ providedIn: 'root' })
export class ThemeService {
  readonly theme = signal<Theme>(read(THEME_KEY, ['light', 'dark'] as const, 'light'));
  readonly density = signal<Density>(read(DENSITY_KEY, ['comfortable', 'compact'] as const, 'comfortable'));

  constructor() {
    this.apply();
  }

  toggleTheme(): void {
    this.theme.set(this.theme() === 'dark' ? 'light' : 'dark');
    write(THEME_KEY, this.theme());
    this.apply();
  }

  setDensity(density: Density): void {
    this.density.set(density);
    write(DENSITY_KEY, density);
    this.apply();
  }

  private apply(): void {
    const root = document.documentElement;
    root.setAttribute('data-theme', this.theme());
    root.setAttribute('data-density', this.density());
  }
}
