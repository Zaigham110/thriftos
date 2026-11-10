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
  /** Other pages that belong to this item (it stays highlighted there), e.g. Purchasing's second tab. */
  also?: string[];
  icon: Icon;
  module?: TenantModule | TenantModule[];
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
      { label: 'ws.nav.purchasing', path: '/receive/records/containers', also: ['/receive/records/lots'], icon: Truck, module: ['CONTAINERS', 'LOOSE_LOTS'], keywords: 'receive maal aya container lot gaari purchase kharidari' },
      { label: 'ws.nav.suppliers', path: '/receive/records/suppliers', icon: Factory, module: 'RECEIVE', keywords: 'supplier vendor scorecard' },
      { label: 'ws.nav.sorting', path: '/sort/records', icon: Layers3, module: 'SORT', keywords: 'chhantai sort grade lots' },
      { label: 'ws.nav.yield', path: '/sort/yield', icon: Gauge, module: 'SORT', keywords: 'yield waste chhantai percent supplier' },
      { label: 'ws.nav.inventory', path: '/stock/by-item', also: ['/stock/items'], icon: PackageSearch, module: 'STOCK', keywords: 'stock bale inventory maal' },
      { label: 'ws.nav.stockValue', path: '/stock/value', icon: Coins, module: 'STOCK', keywords: 'stock value ageing purana maal valuation count' },
    ],
  },
  {
    label: 'ws.group.sales',
    items: [
      { label: 'ws.nav.sales', path: '/sell/records', icon: ShoppingCart, module: 'SELL', keywords: 'becho sale invoice bill' },
      { label: 'ws.nav.prices', path: '/sell/prices', icon: Tags, module: 'PRICE_LISTS', permission: 'price.manage', keywords: 'price list rate wholesale retail group' },
      { label: 'ws.nav.receivables', path: '/khata/records', icon: BookOpen, module: 'KHATA', keywords: 'khata udhaar customers payments' },
    ],
  },
  {
    label: 'ws.group.finance',
    items: [
      { label: 'ws.nav.expenses', path: '/finance/expenses', icon: Receipt, module: 'EXPENSES', permission: 'finance.view', keywords: 'kharcha expense rent bijli labour transport' },
      { label: 'ws.nav.book', path: '/finance/book', icon: Wallet, module: ['CASH_CLOSE', 'EXPENSES'], permission: 'finance.view', keywords: 'cash book bank jazzcash easypaisa raast' },
      { label: 'ws.nav.close', path: '/finance/close', icon: Vault, module: 'CASH_CLOSE', permission: 'finance.view', keywords: 'cash close galla hisaab day end' },
      { label: 'ws.nav.pnl', path: '/finance/pnl', icon: TrendingUp, module: 'PNL', permission: 'cost.view', keywords: 'profit loss munafa nuqsan p&l' },
    ],
  },
  {
    label: 'ws.group.insights',
    items: [
      { label: 'ws.nav.reports', path: '/insights', icon: BarChart3, permission: 'REPORTS_VIEW', keywords: 'reports analytics report centre' },
      { label: 'ws.nav.salesAnalytics', path: '/sell/analytics', icon: TrendingUp, module: 'SELL', permission: 'REPORTS_VIEW', keywords: 'sales analytics customer city grade price trend' },
      { label: 'ws.nav.scorecard', path: '/receive/scorecard', icon: Factory, module: ['CONTAINERS', 'LOOSE_LOTS'], permission: 'REPORTS_VIEW', keywords: 'supplier origin scorecard ranking profit per kg' },
    ],
  },
];

export const WS_SETTINGS: WsNavItem = { label: 'ws.nav.settings', path: '/settings', icon: Settings2, keywords: 'settings team password language export' };

/** Quick create (top bar "+" and the command palette). */
export const WS_CREATE: WsNavItem[] = [
  { label: 'ws.new.sale', path: '/sell/records/new', icon: ShoppingCart, module: 'SELL', permission: 'sale.create', keywords: 'new sale becho' },
  { label: 'ws.new.container', path: '/receive/records/containers/new', icon: Truck, module: 'CONTAINERS', permission: 'container.create', keywords: 'new container' },
  { label: 'ws.new.lot', path: '/receive/records/lots/new', icon: Boxes, module: 'LOOSE_LOTS', permission: 'rag.create', keywords: 'loose lot' },
  { label: 'ws.new.ready', path: '/receive/ready', icon: PackagePlus, module: 'READY_STOCK', permission: 'INVENTORY_INTAKE', keywords: 'ready stock' },
  { label: 'ws.new.bale', path: '/stock/bale', icon: Boxes, module: 'STOCK', keywords: 'make bale' },
  { label: 'ws.expenses.new', path: '/finance/expenses/new', icon: Receipt, module: 'EXPENSES', permission: 'expense.create', keywords: 'kharcha' },
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
  create: 'ws.crumb.new',
  edit: 'ws.crumb.edit',
  statement: 'ws.customer.statement',
  tenant: 'ws.adminIdx.area.tenant.name',
  users: 'ws.adminIdx.area.users.name',
  roles: 'ws.adminIdx.area.roles.name',
  categories: 'ws.adminIdx.area.categories.name',
  'raw-categories': 'ws.adminIdx.area.rawCategories.name',
  grades: 'ws.adminIdx.area.grades.name',
  warehouses: 'ws.adminIdx.area.godowns.name',
  vendors: 'ws.adminIdx.area.vendors.name',
  'waste-categories': 'ws.adminIdx.area.waste.name',
  import: 'ws.adminIdx.area.import.name',
  container: 'ws.new.container',
  lot: 'ws.new.lot',
  ready: 'ws.new.ready',
  bale: 'ws.new.bale',
  labels: 'ws.crumb.labels',
  label: 'ws.crumb.labels',
  items: 'ws.crumb.items',
  'by-item': 'ws.si.tab',
  grade: 'ws.crumb.grading',
  containers: 'ws.crumb.containers',
  lots: 'ws.purchasing.lots',
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
  /** A dictionary key, or (raw) a record's own name such as "CONT-2026-006". */
  label: string;
  path: string;
  raw?: boolean;
}

/**
 * Breadcrumbs for a URL: known segments, each linking to its own path, plus records whose name a page has
 * given (`names`: id → name). Unknown ids are left out.
 */
/** A page you open from the menu (or a tab of one): the top of its trail, so it shows no breadcrumb. */
export function isMenuPage(url: string): boolean {
  const path = url.split(/[?#]/)[0];
  const items = [...WS_NAV.flatMap((g) => g.items), WS_SETTINGS];
  return items.some((i) => i.path === path || (i.also ?? []).includes(path));
}

/**
 * Pages that sit elsewhere in the menu than their address says: their breadcrumb follows the menu (Suppliers is
 * its own menu item; Supplier scorecard is a report under Insights).
 */
const MENU_CRUMBS: Array<{ prefix: string; crumbs: Crumb[] }> = [
  { prefix: '/receive/records/suppliers', crumbs: [{ label: 'ws.nav.suppliers', path: '/receive/records/suppliers' }] },
  { prefix: '/receive/scorecard', crumbs: [{ label: 'ws.nav.reports', path: '/insights' }, { label: 'ws.nav.scorecard', path: '/receive/scorecard' }] },
  { prefix: '/sort/yield', crumbs: [{ label: 'ws.nav.sorting', path: '/sort/records' }, { label: 'ws.nav.yield', path: '/sort/yield' }] },
];

export function crumbsFor(url: string, names: Record<string, string> = {}): Crumb[] {
  const path = url.split(/[?#]/)[0];
  // The sorting screen of a lot sits under the lot's page: Sorting › LOT-2026-011 › Sorting now.
  const sorting = /^\/sort\/(?!records$|records\/|yield$|grade\/|next$)([^/]+)$/.exec(path);
  if (sorting) {
    const id = decodeURIComponent(sorting[1]);
    return [
      { label: 'ws.nav.sorting', path: '/sort/records' },
      ...(names[id] ? [{ label: names[id], path: `/sort/records/${sorting[1]}`, raw: true }] : []),
      { label: 'ws.crumb.sortingNow', path },
    ];
  }
  const segments = path.split('/').filter(Boolean);
  const menu = MENU_CRUMBS.find((m) => path === m.prefix || path.startsWith(m.prefix + '/'));
  const crumbs: Crumb[] = menu ? [...menu.crumbs] : [];
  const skip = menu ? menu.prefix.split('/').filter(Boolean).length : 0;
  segments.forEach((segment, i) => {
    if (i < skip) return;
    const path = '/' + segments.slice(0, i + 1).join('/');
    const name = names[decodeURIComponent(segment)];
    if (name) crumbs.push({ label: name, path, raw: true });
    else if (WS_CRUMBS[segment]) crumbs.push({ label: WS_CRUMBS[segment], path });
  });
  return crumbs;
}
