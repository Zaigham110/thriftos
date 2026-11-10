import type { Texts } from '../language/language';

/**
 * Every part of ThriftOS a business can have, in one list (v2 review: "break each and every module"). The super
 * admin turns them on or off per business; the server refuses a module that is off and the app hides it.
 *
 * Stored in `Tenant.enabledModules`. RECEIVE, STOCK and SELL are always there (the old route switches); SORT is
 * there when the business sorts (`sortingStages` > 0). BILLING and PAYROLL belong to the platform, not to this list.
 */
export const MODULE_KEYS = [
  'CONTAINERS', 'LOOSE_LOTS', 'READY_STOCK', 'PURCHASE_ORDERS',
  'SORT',
  'WAREHOUSES', 'STOCK_COUNTS',
  'PRICE_LISTS', 'EXPORT', 'KHATA',
  'EXPENSES', 'CASH_CLOSE', 'PNL',
  'REPORTS', 'STAFF', 'IMPORT',
] as const;
export type ModuleKey = (typeof MODULE_KEYS)[number];

/** Always on: without them there is no ThriftOS. Kept in the stored list so the older route switches keep working. */
export const ALWAYS_ON = ['RECEIVE', 'STOCK', 'SELL'] as const;

/** Ways stock comes in; a business needs at least one. */
export const BUYING: readonly ModuleKey[] = ['CONTAINERS', 'LOOSE_LOTS', 'READY_STOCK'];

export type ModuleGroup = 'buying' | 'sorting' | 'stock' | 'selling' | 'money' | 'other';

export interface ModuleInfo {
  key: ModuleKey;
  group: ModuleGroup;
  name: Texts<string>;
  hint: Texts<string>;
  /** On for a new business unless the super admin says otherwise. */
  byDefault: boolean;
}

export const GROUP_NAMES: Record<ModuleGroup, Texts<string>> = {
  buying: { en: 'Buying', ur: 'خریداری', roman: 'Khareedari' },
  sorting: { en: 'Sorting', ur: 'چھانٹی', roman: 'Chhantai' },
  stock: { en: 'Stock', ur: 'اسٹاک', roman: 'Stock' },
  selling: { en: 'Selling', ur: 'فروخت', roman: 'Farokht' },
  money: { en: 'Money', ur: 'حساب', roman: 'Hisaab' },
  other: { en: 'Other', ur: 'دیگر', roman: 'Deegar' },
};

export const MODULES: readonly ModuleInfo[] = [
  {
    key: 'CONTAINERS', group: 'buying', byDefault: true,
    name: { en: 'Containers', ur: 'کنٹینر', roman: 'Container' },
    hint: { en: 'Imported containers with their charges and landed cost.', ur: 'باہر سے آنے والے کنٹینر، ان کے خرچے اور کل لاگت۔', roman: 'Bahar se aane wale container, un ke kharche aur kul laagat.' },
  },
  {
    key: 'LOOSE_LOTS', group: 'buying', byDefault: true,
    name: { en: 'Loose lots', ur: 'کھلا مال (لاٹ)', roman: 'Khula maal (lot)' },
    hint: { en: 'Lots bought locally without a container, by weight.', ur: 'بغیر کنٹینر کے مقامی طور پر وزن سے خریدا گیا مال۔', roman: 'Baghair container ke maqami taur par wazan se khareeda gaya maal.' },
  },
  {
    key: 'READY_STOCK', group: 'buying', byDefault: true,
    name: { en: 'Ready bales', ur: 'تیار گانٹھیں', roman: 'Tayyar bale' },
    hint: { en: 'Bales bought ready to sell, without sorting.', ur: 'بغیر چھانٹی کے بیچنے کے لیے تیار گانٹھیں۔', roman: 'Baghair chhantai ke bechne ke liye tayyar bale.' },
  },
  {
    key: 'PURCHASE_ORDERS', group: 'buying', byDefault: false,
    name: { en: 'Purchase orders', ur: 'خریداری آرڈر', roman: 'Purchase order' },
    hint: { en: 'Orders to suppliers before the container ships.', ur: 'کنٹینر روانہ ہونے سے پہلے سپلائر کو آرڈر۔', roman: 'Container rawana hone se pehle supplier ko order.' },
  },
  {
    key: 'SORT', group: 'sorting', byDefault: true,
    name: { en: 'Sorting', ur: 'چھانٹی', roman: 'Chhantai' },
    hint: { en: 'Lots sorted into categories (and grades), then baled.', ur: 'مال کیٹیگری (اور گریڈ) میں چھانٹ کر گانٹھیں بنانا۔', roman: 'Maal category (aur grade) mein chhaant kar bale banana.' },
  },
  {
    key: 'WAREHOUSES', group: 'stock', byDefault: false,
    name: { en: 'More than one godown', ur: 'ایک سے زیادہ گودام', roman: 'Aik se zyada godown' },
    hint: { en: 'Stock kept in several places, moved between them.', ur: 'مال کئی جگہوں پر، ایک سے دوسری جگہ منتقل۔', roman: 'Maal kai jagahon par, aik se doosri jagah muntaqil.' },
  },
  {
    key: 'STOCK_COUNTS', group: 'stock', byDefault: true,
    name: { en: 'Stock counts and write-offs', ur: 'اسٹاک گنتی اور نقصان', roman: 'Stock ginti aur nuqsan' },
    hint: { en: 'Count what is on the shelf; approve what is short or damaged.', ur: 'موجود مال گنیں؛ کمی یا خراب مال منظور کریں۔', roman: 'Mojood maal ginein; kami ya kharab maal manzoor karein.' },
  },
  {
    key: 'PRICE_LISTS', group: 'selling', byDefault: true,
    name: { en: 'Price lists', ur: 'ریٹ لسٹ', roman: 'Rate list' },
    hint: { en: 'Wholesale and retail rates per customer group.', ur: 'گاہکوں کے گروپ کے حساب سے ہول سیل اور ریٹیل ریٹ۔', roman: 'Gahakon ke group ke hisaab se wholesale aur retail rate.' },
  },
  {
    key: 'EXPORT', group: 'selling', byDefault: false,
    name: { en: 'Export sales', ur: 'برآمدی فروخت', roman: 'Export sale' },
    hint: { en: 'Sales to buyers abroad, in other currencies.', ur: 'بیرون ملک خریداروں کو دوسری کرنسی میں فروخت۔', roman: 'Beroon mulk khareedaron ko doosri currency mein farokht.' },
  },
  {
    key: 'KHATA', group: 'selling', byDefault: true,
    name: { en: 'Khata (credit)', ur: 'کھاتہ (ادھار)', roman: 'Khata (udhaar)' },
    hint: { en: 'Selling on credit, payments, reminders and statements.', ur: 'ادھار فروخت، وصولی، یاد دہانی اور اسٹیٹمنٹ۔', roman: 'Udhaar farokht, wasooli, yaad dihani aur statement.' },
  },
  {
    key: 'EXPENSES', group: 'money', byDefault: true,
    name: { en: 'Expenses', ur: 'اخراجات', roman: 'Akhrajaat' },
    hint: { en: 'Rent, wages, transport and other running costs.', ur: 'کرایہ، اجرت، ٹرانسپورٹ اور دیگر خرچے۔', roman: 'Kiraya, ujrat, transport aur deegar kharche.' },
  },
  {
    key: 'CASH_CLOSE', group: 'money', byDefault: true,
    name: { en: 'Cash close', ur: 'کیش بند', roman: 'Cash band' },
    hint: { en: 'Count the cash drawer at the end of each day.', ur: 'ہر دن کے آخر میں دراز کی نقدی گنیں۔', roman: 'Har din ke aakhir mein daraz ki naqdi ginein.' },
  },
  {
    key: 'PNL', group: 'money', byDefault: true,
    name: { en: 'Profit and loss', ur: 'نفع نقصان', roman: 'Nafa nuqsan' },
    hint: { en: 'Monthly sales, cost, expenses and net profit.', ur: 'ماہانہ فروخت، لاگت، اخراجات اور خالص منافع۔', roman: 'Mahana farokht, laagat, akhrajaat aur khalis munafa.' },
  },
  {
    key: 'REPORTS', group: 'other', byDefault: false,
    name: { en: 'Detailed reports', ur: 'تفصیلی رپورٹس', roman: 'Tafseeli reports' },
    hint: { en: 'Reports beyond the daily ones: sorting, grading, waste, workers.', ur: 'روزانہ سے بڑھ کر رپورٹس: چھانٹی، گریڈنگ، ویسٹ، مزدور۔', roman: 'Rozana se barh kar reports: chhantai, grading, waste, mazdoor.' },
  },
  {
    key: 'STAFF', group: 'other', byDefault: true,
    name: { en: 'Staff', ur: 'عملہ', roman: 'Staff' },
    hint: { en: 'Manager, buyer, sorter, salesman and cashier, each signing in with a phone and PIN.', ur: 'منیجر، خریدار، چھانٹنے والا، سیلز مین اور کیشیئر، ہر ایک فون اور PIN سے سائن ان کرے۔', roman: 'Manager, khareedar, chhantai wala, salesman aur cashier, har aik phone aur PIN se sign in kare.' },
  },
  {
    key: 'IMPORT', group: 'other', byDefault: true,
    name: { en: 'Import from Excel', ur: 'ایکسل سے درآمد', roman: 'Excel se import' },
    hint: { en: 'Bring in customers, suppliers and opening stock from a register.', ur: 'رجسٹر سے گاہک، سپلائر اور ابتدائی اسٹاک لائیں۔', roman: 'Register se gahak, supplier aur ibtidai stock layein.' },
  },
];

export const DEFAULT_MODULES: ModuleKey[] = MODULES.filter((m) => m.byDefault).map((m) => m.key);

export const isModuleKey = (v: unknown): v is ModuleKey => typeof v === 'string' && (MODULE_KEYS as readonly string[]).includes(v);

/** Why a set of modules does not work, or null. */
export function moduleProblem(chosen: readonly string[], sortingStages: number): 'NO_BUYING' | 'SORT_NEEDS_LOTS' | null {
  if (!BUYING.some((b) => chosen.includes(b))) return 'NO_BUYING';
  if (sortingStages > 0 && !chosen.includes('CONTAINERS') && !chosen.includes('LOOSE_LOTS')) return 'SORT_NEEDS_LOTS';
  return null;
}

/**
 * The stored list for a business: the always-on three, SORT when it sorts, the chosen modules, and anything else it
 * already had that this list does not handle (kept untouched).
 */
export function storedModules(sortingStages: number, chosen: readonly string[], current: readonly string[] = []): string[] {
  const handled = new Set<string>([...ALWAYS_ON, ...MODULE_KEYS]);
  const kept = current.filter((m) => !handled.has(m) && m !== 'BILLING');
  const picked = MODULE_KEYS.filter((k) => k !== 'SORT' && chosen.includes(k));
  return [...ALWAYS_ON, ...(sortingStages > 0 ? ['SORT'] : []), ...picked, ...kept];
}

/** The catalogue as the app reads it (GET /api/modules). */
export function catalogue() {
  return {
    groups: (Object.keys(GROUP_NAMES) as ModuleGroup[]).map((g) => ({ id: g, name: GROUP_NAMES[g] })),
    modules: MODULES,
    buying: BUYING,
    defaults: DEFAULT_MODULES,
  };
}
