import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { SupportBannerComponent } from './shared/support/support-banner.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, SupportBannerComponent],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class AppComponent {
  constructor() {}
}
