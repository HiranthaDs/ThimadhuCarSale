import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { chromium, expect } from '@playwright/test';

const base = process.env.TEST_URL || 'http://127.0.0.1:5174';
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce' });
const errors = [];
let outage = 'video';
await context.route('https://docs.google.com/spreadsheets/d/e/**', route => route.fulfill({
  contentType: 'text/csv', headers: { 'Access-Control-Allow-Origin': '*' },
  body: `id,brand,model,year,price,mileage,fuel,transmission,type,condition,availability,image1,image2\nCHECK-1,Toyota,Aqua,2022,5000000,40000,Hybrid,Automatic,Hatchback,Used,Available,${base}/images/hero.webp,${base}/images/journey.webp\n`,
}));
await context.route('https://docs.google.com/spreadsheets/d/*/gviz/**', route => {
  const url = new URL(route.request().url());
  const video = url.searchParams.get('gid') === '1018172779';
  if (outage === 'all' || (outage === 'video' && video)) return route.abort();
  const callback = url.searchParams.get('tqx').split('responseHandler:')[1];
  const record = video ? { id: 'video-check', headline: 'A video moment', video_url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', status: 'Active' } : { id: 'photo-check', headline: 'A customer moment', description: 'Synthetic browser fixture.', image_url: `${base}/images/journey.webp`, status: 'Active' };
  const keys = Object.keys(record);
  return route.fulfill({ contentType: 'text/javascript', body: `${callback}(${JSON.stringify({ status: 'ok', table: { cols: keys.map(label => ({ label })), rows: [{ c: keys.map(key => ({ v: record[key] })) }] } })})` });
});
await context.route('https://script.google.com/macros/**', route => route.abort());
await context.route('https://wa.me/**', route => route.abort());
const page = await context.newPage();
page.on('pageerror', error => errors.push(error.message));

try {
  await page.goto(`${base}/a-page-that-does-not-exist`);
  await expect(page.locator('.not-found-copy h1')).toHaveText('New roads.Still ahead.');
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', 'noindex,follow');
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    assert.equal(await page.locator('h1').count(), 1);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false, `404 overflow at ${width}px`);
  }
  await mkdir('.audit/recovery', { recursive: true });
  await page.screenshot({ path: '.audit/recovery/404-desktop.png' });
  await page.locator('#recovery-search').fill('Aqua');
  await page.getByRole('button', { name: 'Search the collection' }).click();
  await page.waitForURL('**/all-vehicles.html?q=Aqua');
  await expect(page.locator('.inv-results .vehicle-card')).toHaveCount(1);
  const filters = page.locator('.inv-filter-desktop');
  await filters.getByLabel('Min price', { exact: true }).fill('8000000');
  await filters.getByLabel('Max price', { exact: true }).fill('4000000');
  await expect(filters.locator('[role="alert"]')).toContainText('Maximum price must be at least');
  await expect(filters.getByLabel('Max price', { exact: true })).toHaveAttribute('aria-invalid', 'true');
  await filters.getByRole('button', { name: 'Reset', exact: true }).click();
  await expect(page.locator('.inv-results .vehicle-card')).toHaveCount(1);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('button', { name: /^Filters/ }).click();
  assert.equal(await page.evaluate(() => getComputedStyle(document.body).overflow), 'hidden');
  await page.keyboard.press('Escape');
  assert.notEqual(await page.evaluate(() => getComputedStyle(document.body).overflow), 'hidden');

  await page.evaluate(() => {
    const listeners = new Set();
    const item = { id: 'CHECK-1', slug: 'toyota-aqua-2022-check-1', brand: 'Toyota', model: 'Aqua', year: 2022, price: 5000000, availability: 'Available', image: `${location.origin}/images/hero.webp`, images: [`${location.origin}/images/hero.webp`, `${location.origin}/images/journey.webp`] };
    let cached = true;
    window.VehicleStore = { ...window.VehicleStore, detail: async () => ({ item: { ...item } }), related: async () => ({ items: [] }), getState: () => ({ source: cached ? 'cache' : 'network' }), on: (name, callback) => { if (name === 'update') listeners.add(callback); return () => listeners.delete(callback); } };
    window.__auditRefresh = () => { cached = false; item.price = 4800000; item.availability = 'Reserved'; listeners.forEach(callback => callback()); };
  });
  await page.locator('.inv-results .vehicle-card').click();
  await expect(page.locator('.detail-heading h1')).toContainText('Aqua');
  await expect(page.locator('.detail-body .inv-saved-note')).toBeVisible();
  await page.evaluate(() => window.__auditRefresh());
  await expect(page.locator('.detail-price')).toHaveText('LKR 4,800,000');
  await expect(page.locator('.detail-main-photo .vehicle-status')).toHaveText('Reserved');
  await expect(page.locator('.detail-body .inv-saved-note')).toHaveCount(0);
  const breadcrumbCount = await page.evaluate(() => {
    const schemas = JSON.parse(document.querySelector('#site-schema').textContent);
    return schemas.flatMap(item => [item, ...(item['@graph'] || [])]).filter(item => item['@type'] === 'BreadcrumbList').length;
  });
  assert.equal(breadcrumbCount, 1);
  await page.getByRole('button', { name: /Enlarge photo 1/ }).click();
  assert.equal(await page.evaluate(() => getComputedStyle(document.body).overflow), 'hidden');
  await page.keyboard.press('Escape');
  assert.notEqual(await page.evaluate(() => getComputedStyle(document.body).overflow), 'hidden');
  await expect(page.getByRole('button', { name: /Enlarge photo 1/ })).toBeFocused();
  await page.getByRole('link', { name: /Have a question about the details/ }).click();
  await expect(page.locator('#support-reference')).toHaveValue('CHECK-1');

  await page.goto(`${base}/reviews.html`);
  await expect(page.locator('.story-card')).toHaveCount(1);
  await expect(page.locator('.reviews-partial-notice')).toContainText('Video stories are temporarily unavailable');
  outage = 'all';
  await page.locator('.reviews-partial-notice button').click();
  await expect(page.locator('.reviews-empty[role="alert"]')).toBeVisible();
  outage = '';
  await page.getByRole('button', { name: 'Try again', exact: true }).click();
  await expect(page.locator('.story-card')).toHaveCount(2);
  await expect(page.locator('.reviews-partial-notice')).toHaveCount(0);
  assert.deepEqual(errors, []);
  console.log('PASS: responsive 404 recovery/search, inventory range validation, modal scroll/focus restoration, live detail refresh/cache disclosure, unique breadcrumbs, contextual support inquiry, partial/full review outage and retry. No messages sent.');
} finally {
  await context.close();
  await browser.close();
}
