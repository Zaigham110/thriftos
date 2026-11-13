import { Component, input } from '@angular/core';

/** Line icons, 24 x 24, drawn here so the app needs no icon font and works offline. */
export const ICONS = {
  till: 'M4 4h16v6H4zM4 10l-1 10h18l-1-10M8 14h2m4 0h2M8 17h2m4 0h2',
  bills: 'M7 3h10v18l-2.5-1.5L12 21l-2.5-1.5L7 21V3zm3 5h4m-4 4h4',
  stock: 'M4 8l8-4 8 4-8 4-8-4zm0 0v8l8 4 8-4V8M12 12v8',
  people: 'M16 19v-1a4 4 0 00-4-4H7a4 4 0 00-4 4v1M9.5 10a3.5 3.5 0 100-7 3.5 3.5 0 000 7zM21 19v-1a4 4 0 00-3-3.9M15.5 3.2a3.5 3.5 0 010 6.7',
  manage: 'M4 5h6v6H4zM14 5h6v6h-6zM4 15h6v4H4zM14 15h6v4h-6z',
  scan: 'M4 8V5h3M17 5h3v3M20 16v3h-3M7 19H4v-3M8 9v6M11 9v6M14 9v6M17 9v6',
  camera: 'M4 8h3l2-3h6l2 3h3v11H4zM12 16a3 3 0 100-6 3 3 0 000 6z',
  plus: 'M12 5v14M5 12h14',
  minus: 'M5 12h14',
  search: 'M11 18a7 7 0 100-14 7 7 0 000 14zM20 20l-4-4',
  hold: 'M8 5v14M16 5v14',
  user: 'M12 12a4 4 0 100-8 4 4 0 000 8zM5 20a7 7 0 0114 0',
  trash: 'M5 7h14M10 7V4h4v3M7 7l1 13h8l1-13',
  print: 'M7 8V4h10v4M7 17H4v-7h16v7h-3M7 14h10v6H7z',
  lock: 'M7 11V8a5 5 0 0110 0v3M5 11h14v9H5z',
  drawer: 'M3 13h18v7H3zM6 13V5h12v8M10 16.5h4',
  chart: 'M4 20V4M4 20h16M8 16v-4M12 16V8M16 16v-6',
  truck: 'M3 16V7h11v9M14 10h4l3 3v3h-7M7.5 19a1.5 1.5 0 100-3 1.5 1.5 0 000 3zm10 0a1.5 1.5 0 100-3 1.5 1.5 0 000 3z',
  swap: 'M4 8h14l-3-3M20 16H6l3 3',
  check: 'M5 12.5l4.5 4.5L19 7.5',
  wallet: 'M4 7h14a2 2 0 012 2v9H4zM4 7V5h12M16 13h2',
  gear: 'M4 6h9m4 0h3M4 12h3m4 0h9M4 18h11m4 0h1M15 4v4M9 10v4M17 16v4',
  back: 'M15 5l-7 7 7 7',
  right: 'M9 5l7 7-7 7',
  tag: 'M4 4h8l8 8-8 8-8-8zM8.5 8.5h.01',
  store: 'M4 10l1-6h14l1 6M5 10v10h14V10M9 20v-6h6v6',
  cloudOff: 'M4 4l16 16M8 8a5 5 0 00-4 8h11M10 6a6 6 0 019 4 4 4 0 012 6',
  count: 'M5 5h14v14H5zM9 10l2 2 4-4M9 16h6',
  receipt: 'M6 3h12v18l-3-2-3 2-3-2-3 2zM9 8h6M9 12h6',
  out: 'M10 5H5v14h5M14 8l4 4-4 4M18 12H9',
} as const;
export type IconName = keyof typeof ICONS;

@Component({
  selector: 'pos-icon',
  template: `<svg [class]="size()" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path [attr.d]="path()" /></svg>`,
  host: { class: 'inline-flex shrink-0' },
})
export class Icon {
  readonly name = input.required<IconName>();
  readonly size = input('h-5 w-5');
  path() {
    return ICONS[this.name()];
  }
}
