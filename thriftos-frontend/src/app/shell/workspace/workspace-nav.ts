import {
  BarChart3,
  BookOpen,
  Coins,
  Factory,
  Gauge,
  Boxes,
  Home,
  Layers3,
  PackagePlus,
  PackageSearch,
  Receipt,
  Settings2,
  Tags,
  ShoppingCart,
  TrendingUp,
  Truck,
  Vault,
  Wallet,
} from 'lucide-angular';
import { TenantModule } from '../../core/tenant/tenant.service';

export type Icon = typeof Home;

export interface WsNavItem {
  /** Dictionary key of the label. */
  label: string;
  path: string;
  icon: Icon;
  module?: TenantModule;
  /** Shown only to people with this permission. */
  permission?: string;
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
      { label: 'ws.nav.sorting', path: '/sort/records', icon: Layers3, module: 'SORT', keywords: 'chhantai sort grade lots' },
      { label: 'ws.nav.yield', path: '/sort/yield', icon: Gauge, module: 'SORT', keywords: 'yield waste chhantai percent supplier' },
      { label: 'ws.nav.inventory', path: '/stock/items', icon: PackageSearch, module: 'STOCK', keywords: 'stock bale inventory maal' },
      { label: 'ws.nav.stockValue', path: '/stock/value', icon: Coins, module: 'STOCK', keywords: 'stock value ageing purana maal valuation count' },
    ],
  },
  {
    label: 'ws.group.sales',
    items: [
      { label: 'ws.nav.sales', path: '/sell/records', icon: ShoppingCart, module: 'SELL', keywords: 'becho sale invoice bill' },
      { label: 'ws.nav.prices', path: '/sell/prices', icon: Tags, module: 'SELL', permission: 'price.manage', keywords: 'price list rate wholesale retail group' },
      { label: 'ws.nav.receivables', path: '/khata/records', icon: BookOpen, module: 'KHATA', keywords: 'khata udhaar customers payments' },
    ],
  },
  {
    label: 'ws.group.finance',
    items: [
      { label: 'ws.nav.expenses', path: '/finance/expenses', icon: Receipt, permission: 'finance.view', keywords: 'kharcha expense rent bijli labour transport' },
      { label: 'ws.nav.book', path: '/finance/book', icon: Wallet, permission: 'finance.view', keywords: 'cash book bank jazzcash easypaisa raast' },
      { label: 'ws.nav.close', path: '/finance/close', icon: Vault, permission: 'finance.view', keywords: 'cash close galla hisaab day end' },
      { label: 'ws.nav.pnl', path: '/finance/pnl', icon: TrendingUp, permission: 'cost.view', keywords: 'profit loss munafa nuqsan p&l' },
    ],
  },
  {
    label: 'ws.group.insights',
    items: [
      { label: 'ws.nav.reports', path: '/insights', icon: BarChart3, permission: 'REPORTS_VIEW', keywords: 'reports analytics report centre' },
      { label: 'ws.nav.salesAnalytics', path: '/sell/analytics', icon: TrendingUp, module: 'SELL', permission: 'REPORTS_VIEW', keywords: 'sales analytics customer city grade price trend' },
      { label: 'ws.nav.scorecard', path: '/receive/scorecard', icon: Factory, module: 'RECEIVE', permission: 'REPORTS_VIEW', keywords: 'supplier origin scorecard ranking profit per kg' },
    ],
  },
];

export const WS_SETTINGS: WsNavItem = { label: 'ws.nav.settings', path: '/settings', icon: Settings2, keywords: 'settings team password language export' };

/** Quick create (top bar "+" and the command palette). */
export const WS_CREATE: WsNavItem[] = [
  { label: 'ws.new.sale', path: '/sell/records/new', icon: ShoppingCart, module: 'SELL', keywords: 'new sale becho' },
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
  yield: 'ws.nav.yield',
  finance: 'ws.group.finance',
  expenses: 'ws.nav.expenses',
  book: 'ws.nav.book',
  close: 'ws.nav.close',
  pnl: 'ws.nav.pnl',
  analytics: 'ws.nav.salesAnalytics',
  insights: 'ws.nav.reports',
  scorecard: 'ws.nav.scorecard',
  prices: 'ws.nav.prices',
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
