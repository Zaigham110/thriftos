import { DecimalLike, dec } from '../costing/costing';

/**
 * WhatsApp messages as plain wa.me links with prefilled text (no paid WhatsApp API).
 * Urdu or English, from the request or the tenant's default language. Roman Urdu people get the English text
 * (Urdu script is only for 'ur').
 */
export type Language = 'ur' | 'en';

export function language(value: string | undefined, fallback: string): Language {
  const lang = value ?? fallback;
  return lang === 'en' || lang === 'roman' ? 'en' : 'ur';
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
  bill: { business: string; customer: string; saleNumber: string; total: DecimalLike; paid: DecimalLike; due: DecimalLike; url: string },
): string {
  const due = dec(bill.due);
  if (lang === 'en') {
    return [
      `${bill.business}`,
      `Bill ${bill.saleNumber} for ${bill.customer}`,
      `Total: ${rupees(bill.total)}`,
      `Paid: ${rupees(bill.paid)}`,
      ...(due.greaterThan(0) ? [`Due: ${rupees(due)}`] : []),
      `See bill: ${bill.url}`,
    ].join('\n');
  }
  return [
    `${bill.business}`,
    `${bill.customer} صاحب، بل نمبر ${bill.saleNumber}`,
    `کل رقم: ${rupees(bill.total)}`,
    `ادا شدہ: ${rupees(bill.paid)}`,
    ...(due.greaterThan(0) ? [`باقی: ${rupees(due)}`] : []),
    `بل دیکھیں: ${bill.url}`,
  ].join('\n');
}

export function reminderMessage(lang: Language, reminder: { business: string; customer: string; balance: DecimalLike }): string {
  if (lang === 'en') {
    return `Assalam-o-alaikum ${reminder.customer},\nyour balance with ${reminder.business} is ${rupees(reminder.balance)}.\nPlease pay at your earliest. Thank you.`;
  }
  return `السلام علیکم ${reminder.customer} صاحب،\n${reminder.business} کے کھاتے میں آپ کی باقی رقم ${rupees(reminder.balance)} ہے۔\nبراہ کرم جلد ادائیگی کر دیں۔ شکریہ۔`;
}
