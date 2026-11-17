import { Banknote, Boxes, FileUp, HandCoins, Layers, LucideIconData, Package, Receipt, ShoppingCart, Tags, Truck, UserPlus, Users, Wallet } from 'lucide-angular';
import type { TenantModule } from '../../core/tenant/tenant.service';

/** v2 6.4: short help screens, one task each, four steps, and a button to do it now. Text is `help.<topic>.*`. */
export interface HelpTopic {
  key: string;
  icon: LucideIconData;
  /** Where "Do it now" goes. */
  link: string;
  steps: 4;
  /** Shown only to a business that has this part (v2 review: "Receive a container" showed without containers). */
  module?: TenantModule;
}

export const HELP_TOPICS: HelpTopic[] = [
  { key: 'supplier', icon: Truck, link: '/receive/records/suppliers/new', steps: 4 },
  { key: 'container', icon: Boxes, link: '/receive/container', steps: 4, module: 'CONTAINERS' },
  { key: 'lot', icon: Boxes, link: '/receive/lot', steps: 4, module: 'LOOSE_LOTS' },
  { key: 'sorting', icon: Layers, link: '/sort', steps: 4, module: 'SORT' },
  { key: 'stock', icon: Package, link: '/stock/bale', steps: 4, module: 'SORT' },
  { key: 'sale', icon: ShoppingCart, link: '/sell/new', steps: 4 },
  { key: 'khata', icon: Users, link: '/khata', steps: 4, module: 'KHATA' },
  { key: 'supplierPay', icon: Wallet, link: '/receive/records/suppliers', steps: 4 },
  { key: 'expense', icon: Receipt, link: '/finance/expenses/new', steps: 4, module: 'EXPENSES' },
  { key: 'close', icon: Banknote, link: '/finance/close', steps: 4, module: 'CASH_CLOSE' },
  { key: 'pay', icon: HandCoins, link: '/payroll', steps: 4, module: 'PAYROLL' },
  { key: 'prices', icon: Tags, link: '/sell/prices', steps: 4, module: 'PRICE_LISTS' },
  { key: 'team', icon: UserPlus, link: '/settings/team', steps: 4, module: 'STAFF' },
  { key: 'import', icon: FileUp, link: '/settings/admin/import', steps: 4, module: 'IMPORT' },
];

export const helpTopic = (key: string | null | undefined) => HELP_TOPICS.find((t) => t.key === key);
