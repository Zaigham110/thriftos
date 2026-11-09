import { localPhone } from '../common/phone/phone';

/** "0300 1234567 · Shop 12, Landa Bazaar · Lahore": the line under the business name on bills and messages. */
export function businessContact(t: { phone: string | null; address: string | null; city: string | null }): string | null {
  const parts = [t.phone ? localPhone(t.phone) : null, t.address?.trim() || null, t.city?.trim() || null].filter(Boolean);
  return parts.length ? parts.join(' · ') : null;
}
