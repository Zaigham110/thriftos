import { APIRequestContext, Page, expect } from '@playwright/test';

/** The owner the browser tests sign in as (the demo config switches it to the Al-Madina owner). */
export const DEMO = { email: process.env['PW_OWNER_EMAIL'] || 'admin@demo.thriftos.com', password: process.env['PW_OWNER_PASSWORD'] || 'admin123' };

/** A signed-in API client for the demo tenant (for setting up data and checking what was saved). */
export async function apiAs(request: APIRequestContext, who = DEMO) {
  const res = await request.post('/api/auth/login', { data: who });
  expect(res.ok()).toBeTruthy();
  const token = (await res.json()).accessToken as string;
  const headers = { Authorization: `Bearer ${token}` };
  return {
    get: async (url: string) => {
      const r = await request.get(`/api${url}`, { headers });
      expect(r.ok(), `${url} → ${r.status()}`).toBeTruthy();
      return r.json();
    },
    post: async (url: string, data: object) => {
      const r = await request.post(`/api${url}`, { headers, data });
      expect(r.ok(), `${url} → ${r.status()} ${await r.text()}`).toBeTruthy();
      return r.json();
    },
  };
}

/** Signs in; the language is picked on the phone first (the demo tenant's default is Urdu). */
export async function signIn(page: Page, who = DEMO, lang: 'en' | 'ur' = 'en'): Promise<void> {
  await page.addInitScript((l) => {
    if (!localStorage.getItem('thriftos.lang')) localStorage.setItem('thriftos.lang', l);
  }, lang);
  await page.goto('/auth/login');
  // The Owner tab (second chip), whichever way this phone signed in last.
  await page.locator('.who .chip').nth(1).click();
  await page.fill('input[type=email]', who.email);
  await page.fill('input[type=password]', who.password);
  await page.click('button[type=submit]');
  await page.waitForURL('**/home');
}

/** Waits until the service worker controls the page, so screens and cached data work offline. */
export async function waitForOfflineReady(page: Page): Promise<void> {
  await page.evaluate(() => navigator.serviceWorker.ready);
  if (!(await page.evaluate(() => !!navigator.serviceWorker.controller))) await page.reload();
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);
}
