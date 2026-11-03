import {
  BarChart3,
  BookOpen,
  Coins,
  Factory,
  Boxes,
  Home,
  Layers3,
  PackagePlus,
  PackageSearch,
  Settings2,
  ShoppingCart,
  Truck,
} from 'lucide-angular';
import { TenantModule } from '../../core/tenant/tenant.service';

export type Icon = typeof Home;

export interface WsNavItem {
  /** Dictionary key of the label. */
  label: string;
  path: string;
  icon: Icon;
  module?: TenantModule;
  /** Extra words the command palette matches (English and Roman Urdu). */
  keywords?: string;
}

export interface WsNavGroup {
  /** Dictionary key of the group heading; empty for the top group. */
  label: string;
  items: WsNavItem[];
}

/** The workspace menu, grouped like an ERP. Areas that do not exist yet (Finance) join in E3. */
export const WS_NAV: WsNavGroup[] = [
  { label: '', items: [{ label: 'ws.nav.home', path: '/home', icon: Home, keywords: 'dashboard home' }] },
  {
    label: 'ws.group.operations',
    items: [
      { label: 'ws.nav.purchasing', path: '/receive/records/containers', icon: Truck, module: 'RECEIVE', keywords: 'receive maal aya container lot purchase' },
      { label: 'ws.nav.suppliers', path: '/receive/records/suppliers', icon: Factory, module: 'RECEIVE', keywords: 'supplier vendor scorecard' },
      { label: 'ws.nav.sorting', path: '/sort', icon: Layers3, module: 'SORT', keywords: 'chhantai sort grade' },
      { label: 'ws.nav.inventory', path: '/stock/items', icon: PackageSearch, module: 'STOCK', keywords: 'stock bale inventory maal' },
      { label: 'ws.nav.stockValue', path: '/stock/value', icon: Coins, module: 'STOCK', keywords: 'stock value ageing purana maal valuation count' },
    ],
  },
  {
    label: 'ws.group.sales',
    items: [
      { label: 'ws.nav.sales', path: '/sell/records', icon: ShoppingCart, module: 'SELL', keywords: 'becho sale invoice bill' },
      { label: 'ws.nav.receivables', path: '/khata/records', icon: BookOpen, module: 'KHATA', keywords: 'khata udhaar customers payments' },
    ],
  },
  { label: 'ws.group.insights', items: [{ label: 'ws.nav.reports', path: '/reports', icon: BarChart3, module: 'REPORTS', keywords: 'reports analytics' }] },
];

export const WS_SETTINGS: WsNavItem = { label: 'ws.nav.settings', path: '/settings', icon: Settings2, keywords: 'settings team password language export' };

/** Quick create (top bar "+" and the command palette). */
export const WS_CREATE: WsNavItem[] = [
  { label: 'ws.new.sale', path: '/sell/new', icon: ShoppingCart, module: 'SELL', keywords: 'new sale becho' },
  { label: 'ws.new.container', path: '/receive/container', icon: Truck, module: 'RECEIVE', keywords: 'new container' },
  { label: 'ws.new.lot', path: '/receive/lot', icon: Boxes, module: 'RECEIVE', keywords: 'loose lot' },
  { label: 'ws.new.ready', path: '/receive/ready', icon: PackagePlus, module: 'RECEIVE', keywords: 'ready stock' },
  { label: 'ws.new.bale', path: '/stock/bale', icon: Boxes, module: 'STOCK', keywords: 'make bale' },
];

/** Breadcrumb names for path segments; ids and unknown segments are not shown. */
export const WS_CRUMBS: Record<string, string> = {
  home: 'ws.nav.home',
  receive: 'ws.nav.purchasing',
  sort: 'ws.nav.sorting',
  stock: 'ws.nav.inventory',
  sell: 'ws.nav.sales',
  khata: 'ws.nav.receivables',
  reports: 'ws.nav.reports',
  settings: 'ws.nav.settings',
  new: 'ws.crumb.new',
  container: 'ws.new.container',
  lot: 'ws.new.lot',
  ready: 'ws.new.ready',
  bale: 'ws.new.bale',
  labels: 'ws.crumb.labels',
  label: 'ws.crumb.labels',
  records: 'ws.crumb.records',
  items: 'ws.crumb.items',
  grade: 'ws.crumb.grading',
  containers: 'ws.crumb.containers',
  suppliers: 'ws.nav.suppliers',
  value: 'ws.nav.stockValue',
  counts: 'ws.counts.title',
  today: 'ws.crumb.today',
  team: 'settings.team',
  password: 'settings.password',
  admin: 'settings.advanced',
  'ui-gallery': 'ws.crumb.gallery',
};

export interface Crumb {
  label: string;
  path: string;
}

/** Breadcrumbs for a URL: known segments only, each linking to its own path. */
export function crumbsFor(url: string): Crumb[] {
  const segments = url.split(/[?#]/)[0].split('/').filter(Boolean);
  const crumbs: Crumb[] = [];
  segments.forEach((segment, i) => {
    const label = WS_CRUMBS[segment];
    if (label) crumbs.push({ label, path: '/' + segments.slice(0, i + 1).join('/') });
  });
  return crumbs;
}
