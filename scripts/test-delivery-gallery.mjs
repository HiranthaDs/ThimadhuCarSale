import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium, expect } from '@playwright/test';

const base = process.env.TEST_URL || 'http://127.0.0.1:5174';
const artifacts = '.audit/delivery-redesign';
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce' });
const errors = [];
const checks = [];
const delayedResponses = [];
let feed = 'ready';

// These illustrations and records exist only in this isolated browser session.
// They are deliberately labeled as fixtures and never saved as customer media.
const photoFixtures = Array.from({ length: 14 }, (_, index) => ({
  id: `delivery-photo-${index + 1}`,
  headline: `Customer delivery ${String(index + 1).padStart(2, '0')}`,
  description: 'A synthetic record used only to verify the delivery gallery.',
  customer_name: `Fixture customer ${index + 1}`,
  location: index % 2 ? 'Kandy' : 'Colombo',
  image_url: `${base}/__fixtures/delivery-${index + 1}.svg`,
  status: 'Active',
  display_order: index + 1,
  posted_date: `2026-10-${String(index + 1).padStart(2, '0')}`,
}));
const videoFixtures = [
  { id: 'direct-video', headline: 'Direct delivery video', description: 'Synthetic record using the supplied local film to exercise video controls.', video_url: `${base}/Videos/hero1.mp4?fixture=delivery`, thumbnail_url: `${base}/__fixtures/delivery-15.svg`, status: 'Active', display_order: 1, posted_date: '2026-09-30' },
  { id: 'facebook-video', headline: 'Facebook delivery video', description: 'Synthetic external video link.', video_url: 'https://www.facebook.com/watch/?v=123456789', thumbnail_url: `${base}/__fixtures/delivery-16.svg`, platform: 'Facebook', status: 'Active', display_order: 2, posted_date: '2026-09-29' },
];
const hiddenPhoto = { ...photoFixtures[0], id: 'hidden-photo', headline: 'Unpublished delivery fixture', status: 'Inactive', display_order: -1 };

await mkdir(artifacts, { recursive: true });
await context.route('**/__fixtures/delivery-*.svg', route => {
  const index = Number(new URL(route.request().url()).pathname.match(/delivery-(\d+)/)?.[1] || 1);
  const palettes = [['#c8d7d1', '#ecf0e9', '#315b54'], ['#cad6de', '#e7edf1', '#36556c'], ['#decdbb', '#f2e9df', '#76614c']];
  const [background, car, ink] = palettes[index % palettes.length];
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="900" height="700" viewBox="0 0 900 700"><rect width="900" height="700" fill="${background}"/><rect y="490" width="900" height="210" fill="${ink}" opacity=".14"/><path d="M145 405h87l73-109h288l95 109h61v118H145z" fill="${car}"/><path d="m329 318-50 88h326l-70-88z" fill="${ink}" opacity=".6"/><circle cx="284" cy="517" r="45" fill="${ink}"/><circle cx="637" cy="517" r="45" fill="${ink}"/><text x="50" y="78" fill="${ink}" font-family="sans-serif" font-size="25" letter-spacing="3">TEST PHOTO ${String(index).padStart(2, '0')}</text><text x="50" y="645" fill="${ink}" font-family="sans-serif" font-size="20">Browser fixture · not a customer photograph</text></svg>`;
  return route.fulfill({ contentType: 'image/svg+xml', body: svg });
});
await context.route('https://docs.google.com/spreadsheets/d/e/**', route => route.fulfill({
  contentType: 'text/csv', headers: { 'Access-Control-Allow-Origin': '*' },
  body: `id,brand,model,year,price,mileage,fuel,transmission,type,condition,availability,image1\nGALLERY-1,Toyota,Aqua,2023,7200000,20000,Hybrid,Automatic,Hatchback,Used,Available,${base}/__fixtures/delivery-1.svg\n`,
}));
await context.route('https://script.google.com/macros/s/**', route => {
  const url = new URL(route.request().url());
  const kind = url.searchParams.get('type');
  assert.equal(url.searchParams.get('action'), 'read', 'The gallery must make read-only requests.');
  assert.ok(['customers', 'videos'].includes(kind));
  if (feed === 'error' || (feed === 'partial' && kind === 'videos')) return route.abort();
  const data = feed === 'empty' ? [] : kind === 'customers' ? [...photoFixtures, hiddenPhoto] : videoFixtures;
  const response = { contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify({ apiVersion: '2.1.0', status: 'success', data }) };
  if (feed === 'delayed') { delayedResponses.push(() => route.fulfill(response)); return; }
  return route.fulfill(response);
});
await context.route('https://wa.me/**', route => route.abort());
await context.route('https://www.facebook.com/**', route => route.abort());
await context.addInitScript(() => {
  const schedule = window.setTimeout;
  const clear = window.clearTimeout;
  window.__deliveryRequestTimers = new Set();
  window.setTimeout = function (callback, delay, ...args) {
    const handle = schedule.call(window, callback, delay, ...args);
    if (delay === 10000) window.__deliveryRequestTimers.add(handle);
    return handle;
  };
  window.clearTimeout = function (handle) {
    window.__deliveryRequestTimers.delete(handle);
    return clear.call(window, handle);
  };
});

const page = await context.newPage();
page.on('pageerror', error => errors.push(error.message));
const homeGallery = () => page.locator('.home-reviews');
const cards = (scope = page) => scope.locator('.story-card');
const dialog = () => page.locator('dialog[open]');

async function check(name, run) {
  try {
    await run();
    checks.push({ name, passed: true });
    console.log(`PASS: ${name}`);
  } catch (error) {
    checks.push({ name, passed: false, error: error.message });
    console.error(`FAIL: ${name}\n${error.message}`);
    await page.screenshot({ path: `${artifacts}/failure-${checks.length}.png`, fullPage: true }).catch(() => {});
    await page.keyboard.press('Escape').catch(() => {});
  }
}

async function openHome() {
  await page.goto(base, { waitUntil: 'domcontentloaded' });
  await homeGallery().scrollIntoViewIfNeeded();
}

async function assertNoOverflow(label) {
  const result = await page.evaluate(() => ({ viewport: innerWidth, content: document.documentElement.scrollWidth }));
  assert.ok(result.content <= result.viewport + 1, `${label}: ${JSON.stringify(result)}`);
}

try {
  await check('Homepage presents a mixed media grid directly after the hero', async () => {
    await openHome();
    await expect(homeGallery().locator('.story-card-photo').first()).toBeVisible();
    await expect(homeGallery().locator('.story-card-video').first()).toBeVisible();
    const placement = await homeGallery().evaluate(node => Array.from(node.parentElement.children).indexOf(node));
    assert.equal(placement, 1, 'Customer deliveries should be the first section after the hero.');
    assert.ok(await cards(homeGallery()).count() >= 3, 'Several delivery moments should be available together.');
    await expect(homeGallery().locator('[aria-roledescription="carousel"]')).toHaveCount(0);
    await expect(homeGallery().getByText(hiddenPhoto.headline, { exact: true })).toHaveCount(0);
    await expect(homeGallery().getByRole('button', { name: /^(Like|Comment|Share)$/i })).toHaveCount(0);
    await expect(homeGallery().locator('video, iframe')).toHaveCount(0);
    await page.screenshot({ path: `${artifacts}/home-desktop.png`, fullPage: true });
  });

  await check('Homepage photo and video filters show the requested media', async () => {
    await homeGallery().getByRole('button', { name: /^Photos(?:\s*\d+)?$/ }).click();
    await expect(homeGallery().locator('.story-card-video')).toHaveCount(0);
    assert.ok(await homeGallery().locator('.story-card-photo').count() > 0);
    await homeGallery().getByRole('button', { name: /^Videos(?:\s*\d+)?$/ }).click();
    await expect(homeGallery().locator('.story-card-photo')).toHaveCount(0);
    await expect(homeGallery().locator('.story-card-video')).toHaveCount(2);
  });

  await check('Direct video opens with usable controls and external video retains its source link', async () => {
    const trigger = homeGallery().getByRole('button', { name: 'Watch Direct delivery video', exact: true });
    await trigger.click();
    await expect(dialog()).toBeVisible();
    await expect(dialog().locator('video')).toHaveAttribute('controls', '');
    assert.equal(await dialog().locator('video').evaluate(video => video.paused), true, 'Opening a delivery must not autoplay it.');
    await dialog().locator('video').evaluate(video => video.play());
    await expect.poll(() => dialog().locator('video').evaluate(video => !video.paused && video.currentTime > 0)).toBe(true);
    await page.keyboard.press('Escape');
    await expect(dialog()).toHaveCount(0);
    await expect(trigger).toBeFocused();
    assert.notEqual(await page.evaluate(() => getComputedStyle(document.body).overflow), 'hidden');
    await homeGallery().getByRole('button', { name: 'Watch Facebook delivery video', exact: true }).click();
    const source = dialog().getByRole('link', { name: 'Open original video', exact: true });
    await expect(source).toHaveAttribute('href', videoFixtures[1].video_url);
    await expect(source).toHaveAttribute('rel', /noopener/);
    await expect(dialog().locator('iframe, video')).toHaveCount(0);
    await page.keyboard.press('Escape');
  });

  await check('Photos enlarge and Escape restores the opening control', async () => {
    await homeGallery().getByRole('button', { name: /^Photos(?:\s*\d+)?$/ }).click();
    const trigger = homeGallery().getByRole('button', { name: /^View Customer delivery/ }).first();
    await trigger.click();
    await expect(dialog().locator('.delivery-viewer-media img')).toBeVisible();
    await expect.poll(() => dialog().locator('.delivery-viewer-media img').evaluate(img => img.complete && img.naturalWidth > 0)).toBe(true);
    await page.screenshot({ path: `${artifacts}/photo-viewer-desktop.png` });
    const originalTitle = await dialog().getByRole('heading', { level: 2 }).innerText();
    await dialog().getByRole('button', { name: 'Next delivery', exact: true }).click();
    await expect(dialog().getByRole('heading', { level: 2 })).not.toHaveText(originalTitle);
    await page.keyboard.press('ArrowLeft');
    await expect(dialog().getByRole('heading', { level: 2 })).toHaveText(originalTitle);
    await page.keyboard.press('Escape');
    await expect(dialog()).toHaveCount(0);
    await expect(trigger).toBeFocused();
  });

  await check('Full collection supports pagination, URL filters, search, and sorting', async () => {
    await page.goto(`${base}/reviews.html`, { waitUntil: 'domcontentloaded' });
    await expect(cards()).toHaveCount(12);
    await page.getByRole('button', { name: /more happy moments|load more|more deliveries/i }).click();
    await expect(cards()).toHaveCount(16);
    await page.getByRole('button', { name: /^Photos(?:\s*\d+)?$/ }).click();
    await expect(page).toHaveURL(/tab=photos/);
    await expect(cards()).toHaveCount(12);
    await page.getByRole('searchbox', { name: 'Search customer stories', exact: true }).fill('Customer delivery 02');
    await expect(cards()).toHaveCount(1);
    await expect(cards().first()).toContainText('Customer delivery 02');
    await page.getByRole('button', { name: 'Clear search', exact: true }).click();
    await page.getByRole('combobox', { name: 'Sort stories', exact: true }).selectOption('oldest');
    await expect(cards().first()).toContainText('Customer delivery 01');
    await page.getByRole('combobox', { name: 'Sort stories', exact: true }).selectOption('newest');
    await expect(cards().first()).toContainText('Customer delivery 14');
    await page.getByRole('button', { name: /^Videos(?:\s*\d+)?$/ }).click();
    await expect(page).toHaveURL(/tab=videos/);
    await expect(cards()).toHaveCount(2);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(cards()).toHaveCount(2);
    await expect(page.getByRole('button', { name: /^Videos(?:\s*\d+)?$/ })).toHaveAttribute('aria-pressed', 'true');
  });

  await check('Partial and failed collections recover without fabricated media', async () => {
    feed = 'partial';
    await openHome();
    await expect(homeGallery().locator('.story-card-photo').first()).toBeVisible();
    await expect(homeGallery().locator('.story-card-video')).toHaveCount(0);
    await expect(homeGallery()).toContainText(/video.*temporarily unavailable/i);
    feed = 'ready';
    await homeGallery().getByRole('button', { name: /try.*again|retry/i }).click();
    await expect(homeGallery().locator('.story-card-video').first()).toBeVisible();
    feed = 'error';
    await openHome();
    await expect(homeGallery().getByRole('alert')).toBeVisible();
    await expect(cards(homeGallery())).toHaveCount(0);
    feed = 'ready';
    await homeGallery().getByRole('button', { name: /try.*again|retry/i }).click();
    await expect(homeGallery().locator('.story-card-video').first()).toBeVisible();
    feed = 'empty';
    await openHome();
    await expect(homeGallery()).toContainText(/no.*deliver|no.*publish|appear.*publish|moments.*way|adding.*deliver|delivery moments will appear/i);
    await expect(cards(homeGallery())).toHaveCount(0);
    feed = 'ready';
  });

  await check('Gallery and viewer fit small phones and tablets', async () => {
    feed = 'ready';
    for (const width of [320, 390, 768]) {
      await page.setViewportSize({ width, height: width === 768 ? 1024 : 844 });
      await openHome();
      await expect(homeGallery().locator('.story-card-video').first()).toBeVisible();
      await assertNoOverflow(`Home at ${width}px`);
      const trigger = homeGallery().getByRole('button', { name: /^View Customer delivery/ }).first();
      await trigger.click();
      await expect(dialog()).toBeVisible();
      const bounds = await dialog().boundingBox();
      assert.ok(bounds.x >= -1 && bounds.x + bounds.width <= width + 1, `Dialog escapes ${width}px viewport.`);
      await assertNoOverflow(`Viewer at ${width}px`);
      await page.keyboard.press('Escape');
      await expect(trigger).toBeFocused();
      await page.screenshot({ path: `${artifacts}/gallery-${width}.png` });
      if (width === 390) {
        await page.evaluate(() => scrollTo({ top: 0, behavior: 'instant' }));
        await page.screenshot({ path: `${artifacts}/home-mobile.png`, fullPage: true });
      }
      await page.goto(`${base}/reviews.html?tab=videos`, { waitUntil: 'domcontentloaded' });
      await expect(cards()).toHaveCount(2);
      await assertNoOverflow(`Full gallery at ${width}px`);
    }
  });

  await check('Resizing preserves an in-flight feed and navigation releases its request timers', async () => {
    feed = 'delayed';
    await page.setViewportSize({ width: 1440, height: 1000 });
    await openHome();
    await expect.poll(() => delayedResponses.length).toBe(2);
    await expect.poll(() => page.evaluate(() => window.__deliveryRequestTimers.size)).toBe(2);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    assert.equal(delayedResponses.length, 2, 'Resizing should preserve the same collection request.');
    await page.locator('.site-header a[href="/all-vehicles.html"]').first().evaluate(link => link.click());
    await page.waitForURL('**/all-vehicles.html');
    await Promise.allSettled(delayedResponses.map(release => release()));
    await expect.poll(() => page.evaluate(() => window.__deliveryRequestTimers.size)).toBe(0);
    feed = 'ready';
  });
  assert.deepEqual(errors, [], 'Gallery browsing must not throw browser errors.');
} finally {
  await writeFile(`${artifacts}/report.json`, JSON.stringify({ checks, errors }, null, 2));
  await context.close();
  await browser.close();
}

if (checks.some(check => !check.passed) || errors.length) process.exitCode = 1;
else console.log(`Passed ${checks.length} delivery gallery checks. Test media existed only in the browser; no external message was sent.`);
