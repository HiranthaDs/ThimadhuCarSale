import assert from 'node:assert/strict';
import { chromium, expect } from '@playwright/test';

const base = process.env.TEST_URL || 'http://127.0.0.1:5174';
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
const pending = [];
const errors = [];
const record = { id: 'lifecycle-fixture', headline: 'Published lifecycle fixture', description: 'Synthetic browser fixture.', image_url: `${base}/images/journey.webp`, status: 'Active' };

await context.route('https://docs.google.com/spreadsheets/d/e/**', route => route.fulfill({ contentType: 'text/csv', headers: { 'Access-Control-Allow-Origin': '*' }, body: 'id,brand,model,year,price,mileage,fuel,transmission,type,condition,availability,image1\n' }));
await context.route('https://script.google.com/macros/s/**', route => {
  const url = new URL(route.request().url());
  const kind = url.searchParams.get('type');
  if (url.searchParams.get('action') !== 'read' || !['customers', 'videos'].includes(kind)) return route.abort();
  const data = kind === 'customers' ? [record] : [];
  const body = JSON.stringify({ apiVersion: '2.1.0', status: 'success', data });
  pending.push(() => route.fulfill({ status: 200, contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*' }, body }));
});
await context.addInitScript(() => {
  const originalSet = window.setTimeout;
  const originalClear = window.clearTimeout;
  window.__storyTimeouts = new Set();
  window.setTimeout = function (callback, delay, ...args) {
    const handle = originalSet.call(window, callback, delay, ...args);
    if (delay === 10000) window.__storyTimeouts.add(handle);
    return handle;
  };
  window.clearTimeout = function (handle) {
    window.__storyTimeouts.delete(handle);
    return originalClear.call(window, handle);
  };
});

const page = await context.newPage();
page.on('pageerror', error => errors.push(error.message));
async function release(start, end) {
  await Promise.all(pending.slice(start, end).map(fulfill => fulfill()));
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
}
async function registered() {
  return page.evaluate(() => ({ timers: window.__storyTimeouts.size }));
}

try {
  await page.goto(base, { waitUntil: 'domcontentloaded' });
  await page.locator('.ex-stories').scrollIntoViewIfNeeded();
  await expect.poll(() => pending.length).toBe(2);

  await page.setViewportSize({ width: 390, height: 844 });
  await page.locator('.home-reviews').scrollIntoViewIfNeeded();
  await expect.poll(() => pending.length).toBe(4);
  await release(0, 2);
  assert.deepEqual(await registered(), { timers: 2 }, 'Only the active mobile request timers should be retained.');

  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.locator('.ex-stories').scrollIntoViewIfNeeded();
  await expect.poll(() => pending.length).toBe(6);
  await release(2, 4);
  assert.deepEqual(await registered(), { timers: 2 }, 'Only the new desktop request timers should be retained.');

  await page.locator('a[href="/services.html"]').first().evaluate(link => link.click());
  await page.waitForURL('**/services.html');
  await release(4, 6);
  await expect.poll(registered).toEqual({ timers: 0 });
  assert.deepEqual(errors, [], 'Responses settling after resizing or leaving the page must not throw.');

  await page.locator('a[href="/reviews.html"]').first().evaluate(link => link.click());
  await page.waitForURL('**/reviews.html');
  await expect.poll(() => pending.length).toBe(8);
  await release(6, 8);
  await expect(page.locator('.story-card')).toHaveCount(1);
  await expect(page.locator('.story-card h3')).toHaveText(record.headline);
  assert.deepEqual(await registered(), { timers: 0 }, 'Successful reads should release request timers.');
  assert.deepEqual(errors, []);
  console.log('Story lifecycle passed: delayed desktop/mobile API responses, navigation aborts, successful reads, and request-timer cleanup.');
} finally {
  await context.close();
  await browser.close();
}
