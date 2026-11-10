/** How a business sorts, in the console's words. The modules themselves come from the server (module-picker). */
export const BUSINESS_TYPES: { stages: number; label: string; hint: string }[] = [
  { stages: 2, label: 'Sorts by category and grade', hint: 'Lots are sorted into categories, then grades (A, B, C…), then baled.' },
  { stages: 1, label: 'Sorts by category', hint: 'Lots are sorted into categories, then baled. No grades.' },
  { stages: 0, label: 'Trading only', hint: 'Buys ready bales and sells them. No Sorting tab.' },
];

export const typeLabel = (stages: number | null | undefined): string => BUSINESS_TYPES.find((t) => t.stages === (stages ?? 2))?.label ?? '—';
