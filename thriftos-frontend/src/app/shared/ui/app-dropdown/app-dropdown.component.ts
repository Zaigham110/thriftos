import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ClickOutsideDirective } from '../../directives/click-outside.directive';

export interface DropdownItem {
  label: string;
  value: string;
  icon?: string;
  disabled?: boolean;
}

@Component({
  selector: 'app-dropdown',
  standalone: true,
  imports: [CommonModule, ClickOutsideDirective],
  templateUrl: './app-dropdown.component.html',
  styleUrl: './app-dropdown.component.scss'
})
export class AppDropdownComponent {
  @Input() items: DropdownItem[] = [];
  @Output() itemSelect = new EventEmitter<string>();

  isOpen = false;

  toggle(): void {
    this.isOpen = !this.isOpen;
  }

  selectItem(item: DropdownItem): void {
    if (!item.disabled) {
      this.itemSelect.emit(item.value);
      this.isOpen = false;
    }
  }

  close(): void {
    this.isOpen = false;
  }
}
