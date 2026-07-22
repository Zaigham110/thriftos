import {
  Component,
  Input,
  Output,
  EventEmitter,
  forwardRef,
  signal,
  computed,
  ElementRef,
  HostListener,
  inject,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ControlValueAccessor, NG_VALUE_ACCESSOR, FormsModule } from '@angular/forms';
import { LucideAngularModule, ChevronDown, Check, Plus, Search } from 'lucide-angular';

export interface AutocompleteOption {
  value: string;
  label: string;
  sublabel?: string;
}

@Component({
  selector: 'app-autocomplete',
  standalone: true,
  imports: [CommonModule, FormsModule, LucideAngularModule],
  template: `
    <div class="app-autocomplete" [class.disabled]="disabled" [class.open]="isOpen()">
      <div class="input-wrapper" (click)="toggleDropdown($event)">
        <lucide-icon [img]="icons.Search" [size]="14" class="search-icon"></lucide-icon>
        
        <input
          type="text"
          class="autocomplete-input"
          [placeholder]="placeholder"
          [disabled]="disabled"
          [ngModel]="query()"
          (ngModelChange)="onQueryChange($event)"
          (focus)="onFocus()"
          (keydown)="onKeyDown($event)"
        />

        <lucide-icon [img]="icons.ChevronDown" [size]="16" class="chevron-icon" [class.rotated]="isOpen()"></lucide-icon>
      </div>

      <!-- Dropdown Panel -->
      @if (isOpen()) {
        <div class="autocomplete-dropdown">
          <ul class="options-list">
            @for (opt of filteredOptions(); track opt.value; let idx = $index) {
              <li
                class="option-item"
                [class.active]="activeIdx() === idx"
                [class.selected]="opt.value === value()"
                (click)="selectOption(opt, $event)"
              >
                <div class="option-content">
                  <span class="option-label">{{ opt.label }}</span>
                  @if (opt.sublabel) {
                    <span class="option-sublabel">{{ opt.sublabel }}</span>
                  }
                </div>

                @if (opt.value === value()) {
                  <lucide-icon [img]="icons.Check" [size]="14" class="check-icon"></lucide-icon>
                }
              </li>
            }

            @if (filteredOptions().length === 0 && query().trim()) {
              <li class="custom-entry-item" (click)="selectCustomValue(query().trim(), $event)">
                <lucide-icon [img]="icons.Plus" [size]="14" class="plus-icon"></lucide-icon>
                <span>Use custom value: <strong>"{{ query().trim() }}"</strong></span>
              </li>
            }

            @if (filteredOptions().length === 0 && !query().trim()) {
              <li class="no-options-item">
                <span>No options available</span>
              </li>
            }
          </ul>
        </div>
      }
    </div>
  `,
  styleUrl: './app-autocomplete.component.scss',
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => AppAutocompleteComponent),
      multi: true,
    },
  ],
})
export class AppAutocompleteComponent implements ControlValueAccessor {
  private elementRef = inject(ElementRef);

  @Input() options: AutocompleteOption[] = [];
  @Input() placeholder: string = 'Select or type...';
  @Input() disabled: boolean = false;

  @Output() optionSelected = new EventEmitter<AutocompleteOption>();

  readonly value = signal<string>('');
  readonly query = signal<string>('');
  readonly isOpen = signal<boolean>(false);
  readonly activeIdx = signal<number>(-1);

  readonly icons = {
    ChevronDown,
    Check,
    Plus,
    Search,
  };

  onChangeCallback: (value: string) => void = () => {};
  onTouchedCallback: () => void = () => {};

  readonly filteredOptions = computed(() => {
    const q = this.query().toLowerCase().trim();
    if (!q) return this.options;

    return this.options.filter(
      (opt) =>
        opt.label.toLowerCase().includes(q) ||
        opt.value.toLowerCase().includes(q) ||
        (opt.sublabel || '').toLowerCase().includes(q)
    );
  });

  writeValue(value: string): void {
    this.value.set(value || '');
    this.query.set(value || '');
  }

  registerOnChange(fn: (value: string) => void): void {
    this.onChangeCallback = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouchedCallback = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    this.disabled = isDisabled;
  }

  onFocus(): void {
    if (!this.disabled) {
      this.isOpen.set(true);
    }
  }

  toggleDropdown(event: Event): void {
    event.stopPropagation();
    if (this.disabled) return;
    this.isOpen.update((prev) => !prev);
  }

  onQueryChange(newQuery: string): void {
    this.query.set(newQuery);
    this.value.set(newQuery);
    this.onChangeCallback(newQuery);
    this.isOpen.set(true);
    this.activeIdx.set(0);
  }

  selectOption(opt: AutocompleteOption, event?: Event): void {
    if (event) event.stopPropagation();
    this.value.set(opt.label);
    this.query.set(opt.label);
    this.onChangeCallback(opt.label);
    this.optionSelected.emit(opt);
    this.isOpen.set(false);
  }

  selectCustomValue(customVal: string, event?: Event): void {
    if (event) event.stopPropagation();
    this.value.set(customVal);
    this.query.set(customVal);
    this.onChangeCallback(customVal);
    this.isOpen.set(false);
  }

  onKeyDown(event: KeyboardEvent): void {
    if (!this.isOpen()) {
      if (event.key === 'ArrowDown' || event.key === 'Enter') {
        this.isOpen.set(true);
      }
      return;
    }

    const maxIdx = this.filteredOptions().length - 1;

    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        this.activeIdx.update((idx) => (idx < maxIdx ? idx + 1 : 0));
        break;
      case 'ArrowUp':
        event.preventDefault();
        this.activeIdx.update((idx) => (idx > 0 ? idx - 1 : maxIdx));
        break;
      case 'Enter':
        event.preventDefault();
        if (this.activeIdx() >= 0 && this.activeIdx() <= maxIdx) {
          const selected = this.filteredOptions()[this.activeIdx()];
          this.selectOption(selected);
        } else if (this.query().trim()) {
          this.selectCustomValue(this.query().trim());
        }
        break;
      case 'Escape':
        this.isOpen.set(false);
        break;
    }
  }

  @HostListener('document:click', ['$event'])
  onClickOutside(event: Event): void {
    if (!this.elementRef.nativeElement.contains(event.target)) {
      this.isOpen.set(false);
      this.onTouchedCallback();
    }
  }
}
