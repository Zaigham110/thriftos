import { DecimalLike, dec } from '../costing/costing';
import { Language, Texts, toLanguage } from '../common/language/language';

/**
 * WhatsApp messages as plain wa.me links with prefilled text (no paid WhatsApp API), in every language ThriftOS
 * speaks (common/language), from the request or the tenant's default language.
 */
export type { Language };

export function language(value: string | undefined, fallback: string): Language {
  return toLanguage(value, fallback);
}

/** "Rs 12,345" / "Rs 12,345.50", the way traders write amounts on both languages' bills. */
export function rupees(amount: DecimalLike): string {
  const value = dec(amount).toDecimalPlaces(2);
  const [whole, paisa] = value.abs().toFixed(2).split('.');
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return `${value.isNegative() ? '-' : ''}Rs ${grouped}${paisa === '00' ? '' : `.${paisa}`}`;
}

/** wa.me wants the number in international form without "+"; with no number WhatsApp asks whom to send to. */
export function whatsappLink(phone: string | null, text: string): string {
  const number = phone ? phone.replace(/\D/g, '') : '';
  return `https://wa.me/${number}?text=${encodeURIComponent(text)}`;
}

export function billMessage(
  lang: Language,
  bill: { business: string; contact?: string | null; customer: string; saleNumber: string; total: DecimalLike; paid: DecimalLike; due: DecimalLike; url: string },
): string {
  const due = dec(bill.due);
  const t: Texts<{ head: string; total: string; paid: string; due: string; see: string }> = {
    en: { head: `Bill ${bill.saleNumber} for ${bill.customer}`, total: 'Total', paid: 'Paid', due: 'Due', see: 'See bill' },
    ur: { head: `${bill.customer} صاحب، بل نمبر ${bill.saleNumber}`, total: 'کل رقم', paid: 'ادا شدہ', due: 'باقی', see: 'بل دیکھیں' },
    roman: { head: `${bill.customer} sahib, bill number ${bill.saleNumber}`, total: 'Kul raqam', paid: 'Ada shuda', due: 'Baqi', see: 'Bill dekhein' },
  };
  const w = t[lang];
  return [
    `${bill.business}`,
    ...(bill.contact ? [bill.contact] : []),
    w.head,
    `${w.total}: ${rupees(bill.total)}`,
    `${w.paid}: ${rupees(bill.paid)}`,
    ...(due.greaterThan(0) ? [`${w.due}: ${rupees(due)}`] : []),
    `${w.see}: ${bill.url}`,
  ].join('\n');
}

export function reminderMessage(lang: Language, reminder: { business: string; contact?: string | null; customer: string; balance: DecimalLike }): string {
  const amount = rupees(reminder.balance);
  const t: Texts<string> = {
    en: `Assalam-o-alaikum ${reminder.customer},\nyour balance with ${reminder.business} is ${amount}.\nPlease pay at your earliest. Thank you.`,
    ur: `السلام علیکم ${reminder.customer} صاحب،\n${reminder.business} کے کھاتے میں آپ کی باقی رقم ${amount} ہے۔\nبراہ کرم جلد ادائیگی کر دیں۔ شکریہ۔`,
    roman: `Assalam-o-alaikum ${reminder.customer} sahib,\n${reminder.business} ke khate mein aap ki baqi raqam ${amount} hai.\nBaraye meharbani jald adaigi kar dein. Shukriya.`,
  };
  // The business's phone and address under the message, so the customer knows whom to call (v2 review: Settings).
  return reminder.contact ? `${t[lang]}\n${reminder.business} · ${reminder.contact}` : t[lang];
}
