/**
 * A stored WhatsApp number (+923452110014) the way people in Pakistan write it: 0345 2110014. Numbers from
 * other countries are shown as stored.
 */
export function localPhone(phone: string | null | undefined): string {
  if (!phone) return '';
  const m = /^\+92(3\d{2})(\d{7})$/.exec(phone.replace(/[\s-]/g, ''));
  return m ? `0${m[1]} ${m[2]}` : phone;
}

/** The wa.me link that opens a chat with this number, with the message typed in. */
export function whatsappUrl(phone: string | null | undefined, text: string): string {
  const digits = (phone ?? '').replace(/\D/g, '');
  return `https://wa.me/${digits}?text=${encodeURIComponent(text)}`;
}
