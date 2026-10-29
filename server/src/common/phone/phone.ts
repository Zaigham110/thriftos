/**
 * WhatsApp numbers are stored in E.164 (+923001234567). People type them the local way, so
 * Pakistani formats are accepted: 0300-1234567, 92 300 1234567, 3001234567, 0092300...
 * The same rules are used by migration v2_02 for existing customers.
 */
export function toE164(input: string): string | null {
  let p = input.replace(/[^\d+]/g, '');
  if (p.startsWith('00')) p = `+${p.slice(2)}`;
  else if (/^0\d{10}$/.test(p)) p = `+92${p.slice(1)}`;
  else if (/^92\d{10}$/.test(p)) p = `+${p}`;
  else if (/^3\d{9}$/.test(p)) p = `+92${p}`;
  if (!/^\+[1-9]\d{7,14}$/.test(p)) return null;
  if (p.startsWith('+92') && !/^\+92\d{10}$/.test(p)) return null;
  return p;
}
