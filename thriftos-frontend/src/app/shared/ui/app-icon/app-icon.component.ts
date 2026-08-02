import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  LucideAngularModule,
  AlertTriangle,
  ChevronUp,
  Eye,
  EyeOff,
  LayoutDashboard,
  MoreVertical,
  ShoppingCart,
  FileText,
  Container,
  Package,
  Boxes,
  Warehouse,
  BarChart3,
  Settings,
  Layers,
  Search,
  Tag,
  ChevronRight,
  ChevronDown,
  ChevronsUpDown,
  X,
  Building2,
  Users,
  Shield,
  Truck,
  Trash2,
  Box,
  Zap,
  TrendingUp,
  DollarSign,
  ArrowRight,
  ShoppingBag,
} from 'lucide-angular';

type IconSize = 'sm' | 'md' | 'lg';

/**
 * app-icon
 * Lucide-angular icon mapping.
 */
@Component({
  selector: 'app-icon',
  standalone: true,
  imports: [CommonModule, LucideAngularModule],
  template: `
    <lucide-icon
      class="app-icon"
      [img]="icon"
      [size]="sizeValue"
    />
  `,
  styleUrl: './app-icon.component.scss',
})
export class AppIconComponent {
  @Input({ required: true }) name!: string;
  @Input() size: IconSize = 'md';

  get sizeValue(): number {
    const sizes: Record<IconSize, number> = {
      sm: 16,
      md: 20,
      lg: 24,
    };
    return sizes[this.size];
  }

  get icon() {
    switch (this.name) {
      case 'alert-triangle':
        return AlertTriangle;
      case 'chevron-up':
        return ChevronUp;
      case 'eye':
        return Eye;
      case 'eye-off':
        return EyeOff;
      case 'layout-dashboard':
        return LayoutDashboard;
      case 'shopping-cart':
        return ShoppingCart;
      case 'file-text':
        return FileText;
      case 'container':
        return Container;
      case 'package':
        return Package;
      case 'boxes':
        return Boxes;
      case 'warehouse':
        return Warehouse;
      case 'bar-chart-3':
        return BarChart3;
      case 'settings':
        return Settings;
      case 'layers':
        return Layers;
      case 'more-vertical':
        return MoreVertical;
      case 'search':
        return Search;
      case 'tag':
        return Tag;
      case 'chevron-right':
        return ChevronRight;
      case 'chevron-down':
        return ChevronDown;
      case 'chevrons-up-down':
        return ChevronsUpDown;
      case 'x':
        return X;
      case 'building-2':
        return Building2;
      case 'users':
        return Users;
      case 'shield':
        return Shield;
      case 'truck':
        return Truck;
      case 'trash-2':
        return Trash2;
      case 'box':
        return Box;
      case 'zap':
        return Zap;
      case 'trending-up':
        return TrendingUp;
      case 'dollar-sign':
        return DollarSign;
      case 'arrow-right':
        return ArrowRight;
      case 'shopping-bag':
        return ShoppingBag;
      default:
        return FileText;
    }
  }
}
