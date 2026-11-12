import { ExpenseCategory } from '@prisma/client';

/**
 * The sections of Profit and loss an expense falls under (owner, 2026-11-12: employee costs, running expenses and
 * petty cash apart). Every category is in exactly one section; the expense form groups its choices the same way.
 */
export const EXPENSE_SECTIONS = {
  employee: [ExpenseCategory.SALARY, ExpenseCategory.LABOUR],
  running: [
    ExpenseCategory.RENT, ExpenseCategory.ELECTRICITY, ExpenseCategory.TRANSPORT, ExpenseCategory.FUEL, ExpenseCategory.LOADING,
    ExpenseCategory.PACKING, ExpenseCategory.PHONE, ExpenseCategory.REPAIRS, ExpenseCategory.CUSTOMS,
  ],
  petty: [ExpenseCategory.TEA_FOOD, ExpenseCategory.OTHER],
} as const satisfies Record<string, readonly ExpenseCategory[]>;

export type ExpenseSection = keyof typeof EXPENSE_SECTIONS;
export const EXPENSE_SECTION_KEYS = Object.keys(EXPENSE_SECTIONS) as ExpenseSection[];
