import { ChangeDetectionStrategy, Component, input, output, signal, contentChildren, AfterContentInit } from '@angular/core';
import { CommonModule } from '@angular/common';

export interface Tab {
  id: string;
  label: string;
  disabled?: boolean;
}

@Component({
  selector: 'ui-tabs',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './tabs.html',
  styleUrl: './tabs.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TabsComponent {
  readonly tabs = input<Tab[]>([]);
  readonly activeTab = input<string>('');

  readonly tabChange = output<string>();

  protected activeTabId = signal<string>('');

  ngOnInit(): void {
    if (this.activeTab()) {
      this.activeTabId.set(this.activeTab());
    } else if (this.tabs().length > 0) {
      this.activeTabId.set(this.tabs()[0].id);
    }
  }

  selectTab(tabId: string): void {
    const tab = this.tabs().find(t => t.id === tabId);
    if (tab && !tab.disabled) {
      this.activeTabId.set(tabId);
      this.tabChange.emit(tabId);
    }
  }

  isActive(tabId: string): boolean {
    return this.activeTabId() === tabId;
  }
}
