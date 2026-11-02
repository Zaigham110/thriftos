import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Container, LucideAngularModule, Package, Truck } from 'lucide-angular';
import { TPipe } from '../../core/i18n/t.pipe';

/** Maal aya: what came in? Three big choices, nothing else. */
@Component({
  selector: 'app-receive-home',
  standalone: true,
  imports: [RouterLink, LucideAngularModule, TPipe],
  template: `
    <section class="floor">
      <header class="floor-head"><h1>{{ 'receive.title' | t }}</h1></header>
      <a class="choice" routerLink="/receive/container"><lucide-icon [img]="icons.Container" [size]="30" /><span><strong>{{ 'receive.container' | t }}</strong><small>{{ 'receive.containerHint' | t }}</small></span></a>
      <a class="choice" routerLink="/receive/lot"><lucide-icon [img]="icons.Truck" [size]="30" /><span><strong>{{ 'receive.lot' | t }}</strong><small>{{ 'receive.lotHint' | t }}</small></span></a>
      <a class="choice" routerLink="/receive/ready"><lucide-icon [img]="icons.Package" [size]="30" /><span><strong>{{ 'receive.ready' | t }}</strong><small>{{ 'receive.readyHint' | t }}</small></span></a>
    </section>
  `,
  styles: [`
    .choice { min-height:96px; display:flex; align-items:center; gap:16px; padding:16px 18px; border:1px solid var(--tos-line); border-radius:var(--tos-radius); background:#fff; color:var(--tos-ink); text-decoration:none; }
    .choice lucide-icon { color:var(--tos-primary); }
    .choice span { display:grid; gap:4px; }
    .choice strong { font-size:19px; }
    .choice small { color:var(--tos-ink-soft); font-size:14px; }
  `],
})
export class ReceiveHomeComponent {
  protected readonly icons = { Container, Package, Truck };
}
