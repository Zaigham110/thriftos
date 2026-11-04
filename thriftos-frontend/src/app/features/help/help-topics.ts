import { Boxes, FileUp, Layers, LucideIconData, Package, ShoppingCart, Truck, UserPlus, Users } from 'lucide-angular';

/** v2 6.4: short help screens, one task each, four steps, and a button to do it now. Text is `help.<topic>.*`. */
export interface HelpTopic {
  key: string;
  icon: LucideIconData;
  /** Where "Do it now" goes. */
  link: string;
  steps: 4;
}

export const HELP_TOPICS: HelpTopic[] = [
  { key: 'supplier', icon: Truck, link: '/receive/container', steps: 4 },
  { key: 'container', icon: Boxes, link: '/receive/container', steps: 4 },
  { key: 'sorting', icon: Layers, link: '/sort', steps: 4 },
  { key: 'stock', icon: Package, link: '/stock/bale', steps: 4 },
  { key: 'sale', icon: ShoppingCart, link: '/sell/new', steps: 4 },
  { key: 'khata', icon: Users, link: '/khata', steps: 4 },
  { key: 'team', icon: UserPlus, link: '/settings/team', steps: 4 },
  { key: 'import', icon: FileUp, link: '/settings/admin/import', steps: 4 },
];

export const helpTopic = (key: string | null | undefined) => HELP_TOPICS.find((t) => t.key === key);
