import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LucideAngularModule } from 'lucide-angular';
import { cva } from 'class-variance-authority';

import { cn } from '../utils/cn';

export type ButtonVariant =
  | 'default'
  | 'primary'
  | 'secondary'
  | 'outline'
  | 'ghost'
  | 'link'
  | 'danger'
  | 'destructive';
export type ButtonSize = 'sm' | 'md' | 'lg' | 'icon';

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ring-offset-background disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        default: 'bg-primary text-primary-foreground hover:bg-primary/90',
        secondary: 'bg-secondary text-secondary-foreground hover:bg-secondary/80',
        outline: 'border border-input bg-background hover:bg-accent hover:text-accent-foreground',
        ghost: 'hover:bg-accent hover:text-accent-foreground',
        destructive: 'bg-destructive text-destructive-foreground hover:bg-destructive/90',
      },
      size: {
        sm: 'h-9 px-3 text-xs',
        md: 'h-10 px-4 py-2',
        lg: 'h-11 px-8',
        icon: 'h-10 w-10 p-0',
      },
      fullWidth: {
        true: 'w-full',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'md',
    },
  },
);

@Component({
  selector: 'ui-button, app-button',
  standalone: true,
  imports: [CommonModule, LucideAngularModule],
  templateUrl: './button.html',
  styleUrl: './button.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ButtonComponent {
  readonly variant = input<ButtonVariant>('primary');
  readonly size = input<ButtonSize>('md');
  readonly disabled = input<boolean>(false);
  readonly loading = input<boolean>(false);
  readonly type = input<'button' | 'submit' | 'reset'>('button');
  readonly fullWidth = input<boolean>(false);

  readonly clicked = output<MouseEvent>();
  readonly onClick = output<MouseEvent>();

  get buttonClasses(): string {
    const mappedVariant = this.mapVariant(this.variant());
    const mappedSize = this.size();

    return cn(
      buttonVariants({
        variant: mappedVariant,
        size: mappedSize,
        fullWidth: this.fullWidth() ? true : undefined,
      }),
      this.loading() ? 'relative' : undefined,
    );
  }

  private mapVariant(
    variant: ButtonVariant,
  ): 'default' | 'secondary' | 'outline' | 'ghost' | 'destructive' {
    switch (variant) {
      case 'default':
        return 'default';
      case 'primary':
        return 'default';
      case 'link':
        return 'ghost';
      case 'danger':
      case 'destructive':
        return 'destructive';
      default:
        return variant;
    }
  }

  handleClick(event: MouseEvent): void {
    if (!this.disabled() && !this.loading()) {
      this.clicked.emit(event);
      this.onClick.emit(event);
    }
  }
}
