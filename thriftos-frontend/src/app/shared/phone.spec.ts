import { localPhone, whatsappUrl } from './phone';

describe('localPhone', () => {
  it('writes a Pakistani mobile number the local way', () => {
    expect(localPhone('+923452110014')).toBe('0345 2110014');
  });
  it('leaves other numbers and empty values alone', () => {
    expect(localPhone('+971501234567')).toBe('+971501234567');
    expect(localPhone(null)).toBe('');
  });
  it('builds a WhatsApp link with the text', () => {
    expect(whatsappUrl('+923001234567', 'Rs 5,000 due')).toBe('https://wa.me/923001234567?text=Rs%205%2C000%20due');
  });
});
