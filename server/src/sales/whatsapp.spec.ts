import { billMessage, language, reminderMessage, rupees, whatsappLink } from './whatsapp';

describe('whatsapp', () => {
  it('formats rupees with thousands and only real paisa', () => {
    expect(rupees('1234567')).toBe('Rs 1,234,567');
    expect(rupees('950.5')).toBe('Rs 950.50');
    expect(rupees('-6001')).toBe('-Rs 6,001');
    expect(rupees(0)).toBe('Rs 0');
  });

  it('builds wa.me links with the number and the encoded text', () => {
    expect(whatsappLink('+923001234567', 'Bill 1\nRs 5,000')).toBe('https://wa.me/923001234567?text=Bill%201%0ARs%205%2C000');
    expect(whatsappLink(null, 'Hi')).toBe('https://wa.me/?text=Hi');
  });

  it('picks the language from the request, else the tenant default (Urdu unless English)', () => {
    expect(language('en', 'ur')).toBe('en');
    expect(language(undefined, 'en')).toBe('en');
    expect(language(undefined, 'ur')).toBe('ur');
    expect(language('fr', 'ur')).toBe('ur');
  });

  const bill = { business: 'Al-Madina Traders', customer: 'Ali', saleNumber: 'SAL-2026-0007', total: '60000', paid: '4000', due: '56000', url: 'https://app/bill/t' };

  it('writes the bill in English and Urdu, with the due line only when something is due', () => {
    expect(billMessage('en', bill)).toBe('Al-Madina Traders\nBill SAL-2026-0007 for Ali\nTotal: Rs 60,000\nPaid: Rs 4,000\nDue: Rs 56,000\nSee bill: https://app/bill/t');
    expect(billMessage('en', { ...bill, paid: '60000', due: '0' })).not.toContain('Due');
    const ur = billMessage('ur', bill);
    expect(ur).toContain('بل نمبر SAL-2026-0007');
    expect(ur).toContain('باقی: Rs 56,000');
    expect(billMessage('ur', { ...bill, due: 0 })).not.toContain('باقی');
  });

  it('writes the payment reminder in English and Urdu', () => {
    expect(reminderMessage('en', { business: 'Al-Madina Traders', customer: 'Ali', balance: '18000' })).toContain('your balance with Al-Madina Traders is Rs 18,000');
    expect(reminderMessage('ur', { business: 'Al-Madina Traders', customer: 'Ali', balance: '18000' })).toContain('باقی رقم Rs 18,000');
  });
});
