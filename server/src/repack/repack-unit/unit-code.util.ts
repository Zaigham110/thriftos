export function tokenFromName(name: string, maxLen: number): string {
  const cleaned = (name || '')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '')
    .slice(0, maxLen);
  return cleaned || 'NA';
}

export function formatYYYYMMDD(date: Date): string {
  const yyyy = date.getUTCFullYear().toString();
  const mm = (date.getUTCMonth() + 1).toString().padStart(2, '0');
  const dd = date.getUTCDate().toString().padStart(2, '0');
  return `${yyyy}${mm}${dd}`;
}

export function formatSeq(seq: number, width = 4): string {
  return seq.toString().padStart(width, '0');
}


