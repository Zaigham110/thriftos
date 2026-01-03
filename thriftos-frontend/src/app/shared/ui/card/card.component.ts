import { ChangeDetectionStrategy, Component } from '@angular/core';
import { CommonModule } from '@angular/common';

export { CardComponent } from './card';

@Component({
  selector: 'app-card-header, ui-card-header',
  standalone: true,
  imports: [CommonModule],
  template: '<ng-content></ng-content>',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'card-header' },
})
export class CardHeaderComponent {}

@Component({
  selector: 'app-card-title, ui-card-title',
  standalone: true,
  imports: [CommonModule],
  template: '<ng-content></ng-content>',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'card-title' },
})
export class CardTitleComponent {}

@Component({
  selector: 'app-card-description, ui-card-description',
  standalone: true,
  imports: [CommonModule],
  template: '<ng-content></ng-content>',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'text-sm text-muted-foreground' },
})
export class CardDescriptionComponent {}

@Component({
  selector: 'app-card-content, ui-card-content',
  standalone: true,
  imports: [CommonModule],
  template: '<ng-content></ng-content>',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'card-body' },
})
export class CardContentComponent {}

@Component({
  selector: 'app-card-footer, ui-card-footer',
  standalone: true,
  imports: [CommonModule],
  template: '<ng-content></ng-content>',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'card-footer' },
})
export class CardFooterComponent {}
