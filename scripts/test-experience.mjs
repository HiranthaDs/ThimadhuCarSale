import assert from 'node:assert/strict';
import { chromium, expect } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';

const base = process.env.TEST_URL || 'http://127.0.0.1:5174';
const browser = process.env.CDP_URL ? await chromium.connectOverCDP(process.env.CDP_URL) : await chromium.launch({ channel: 'chrome', headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'no-preference' });
const checks = [];
const errors = [];
await mkdir('.audit', { recursive: true });

// Only synthetic stories are used by this test. Nothing is written to the source.
const customerFixtures = [
  { id: 'experience-a', headline: 'Experience fixture A', description: 'Synthetic delivery story for the browser regression.', customer_name: 'Fixture A', location: 'Colombo', image_url: `${base}/images/journey.webp`, status: 'Active', display_order: 1 },
  { id: 'experience-b', headline: 'Experience fixture B', description: 'Second synthetic delivery story for carousel verification.', customer_name: 'Fixture B', location: 'Kandy', image_url: `${base}/images/hero.webp`, status: 'Active', display_order: 2 },
  { id: 'experience-hidden', headline: 'Unpublished experience fixture', description: 'This record must not appear.', customer_name: 'Hidden fixture', image_url: `${base}/images/journey.webp`, status: 'Inactive', display_order: 0 },
];
const videoFixtures = [
  { id: 'experience-video', headline: 'Experience video fixture', description: 'Synthetic video story for mixed homepage coverage.', video_url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', thumbnail_url: `${base}/images/hero.webp`, platform: 'YouTube', status: 'Active', display_order: 1 },
];
await context.route('https://script.google.com/macros/s/**', async (route) => {
  const url = new URL(route.request().url());
  const records = url.searchParams.get('type') === 'customers' ? customerFixtures : videoFixtures;
  await route.fulfill({
    contentType: 'application/json',
    headers: { 'Access-Control-Allow-Origin': '*' },
    body: JSON.stringify({ apiVersion: '2.1.0', status: 'success', data: records }),
  });
});
await context.route('https://docs.google.com/spreadsheets/d/e/**', (route) => route.fulfill({ status: 200, contentType: 'text/csv', headers: { 'Access-Control-Allow-Origin': '*' }, body: 'id,brand,model,year,price,mileage,fuel,transmission,type,condition,availability,image1\n' }));
// External communication is never performed. Footer draft URLs are captured below.
await context.route('https://wa.me/**', (route) => route.abort());
await context.addInitScript(() => {
  window.__experienceDrafts = [];
  window.open = (...args) => { window.__experienceDrafts.push(args); return null; };
});
const page = await context.newPage();
page.on('pageerror', (error) => errors.push(error.message));

async function check(name, run) {
  try {
    await run();
    checks.push({ name, passed: true });
  } catch (error) {
    checks.push({ name, passed: false, error: error.message });
    await page.screenshot({ path: `.audit/experience-failure-${checks.length}.png` }).catch(() => {});
  }
}

async function scrollTo(selector, fraction = 0, inset = 0) {
  await page.locator(selector).first().evaluate((node, { fraction, inset }) => {
    const travel = Math.max(0, node.offsetHeight - innerHeight);
    window.scrollTo({ top: scrollY + node.getBoundingClientRect().top + travel * fraction - inset, behavior: 'instant' });
  }, { fraction, inset });
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
}

async function inViewport(locator) {
  return locator.evaluate((node) => {
    const box = node.getBoundingClientRect();
    return box.left >= -1 && box.right <= innerWidth + 1 && box.top >= -1 && box.bottom <= innerHeight + 1;
  });
}

try {
  await page.goto(base, { waitUntil: 'domcontentloaded' });
  await check('The opening and phone experience remain usable without a scroll trap', async () => {
    await expect(page.locator('.hs-intro h1')).toBeVisible();
    const openingLink = page.locator('.hs-intro a[href="/all-vehicles.html"]').first();
    await expect(openingLink).toBeVisible();
    assert.ok(await inViewport(openingLink), 'The collection action should be reachable in the opening viewport.');
    await expect(page.locator('.hs-video')).toHaveAttribute('src', '/Videos/hero1.mp4');
    assert.match(await page.locator('.hs-intro h1').evaluate(node => getComputedStyle(node).fontFamily), /Ubuntu/);
    const logo = await page.locator('.premium-header .brand-logo').evaluate(node => ({ radius: getComputedStyle(node).borderRadius, background: getComputedStyle(node).backgroundColor }));
    assert.equal(logo.radius, '0px');
    assert.equal(logo.background, 'rgba(0, 0, 0, 0)');
    await scrollTo('.hs-story', .75);
    await expect(page.locator('.hs-phone-scene')).toBeVisible();
    const phone = page.locator('.hs-phone-scene');
    await phone.getByRole('button', { name: 'Preview sell your vehicle', exact: true }).click();
    await expect(phone.locator('.hs-screen-page-title h3')).toHaveText('Sell your vehicle.');
    await expect(phone.locator('.hs-screen-cta')).toHaveAttribute('href', '/sell-your-vehicle-sri-lanka.html');
    assert.ok(await page.locator('.hs-story').evaluate(node => node.offsetHeight < innerHeight * 3.5), 'The hero should not require a long empty scroll sequence.');
  });

  await check('All four full service chapters alternate and tabs work with keyboard and pointer', async () => {
    await expect(page.locator('.jt-step-row')).toHaveCount(4);
    await page.getByRole('tab', { name: 'Sell your vehicle', exact: false }).click();
    await expect(page.getByRole('tabpanel').getByRole('link', { name: 'Start selling your vehicle', exact: true })).toBeVisible();
    await expect(page.locator('.jt-chapter-copy')).toHaveCount(4);
    const chapterGeometry = await page.locator('.jt-chapter').evaluateAll(rows => rows.map(row => ({ visual: row.querySelector('.jt-chapter-visual').getBoundingClientRect().left, copy: row.querySelector('.jt-chapter-copy').getBoundingClientRect().left })));
    assert.ok(chapterGeometry[0].visual < chapterGeometry[0].copy);
    assert.ok(chapterGeometry[1].visual > chapterGeometry[1].copy);
    await expect(page.getByRole('link', { name: 'Prepare your vehicle details', exact: true })).toBeVisible();
    await page.getByRole('tab', { name: 'Sell your vehicle', exact: false }).focus();
    await page.keyboard.press('ArrowRight');
    await expect(page.getByRole('tab', { name: 'Find something specific', exact: false })).toHaveAttribute('aria-selected', 'true');
    await page.keyboard.press('End');
    await expect(page.getByRole('tab', { name: 'Vehicle support', exact: false })).toBeFocused();
    await page.keyboard.press('Home');
    await expect(page.getByRole('tab', { name: 'Find your vehicle', exact: false })).toBeFocused();
  });

  await check('Navigation animates between pages, preserves filters and supports Back', async () => {
    await page.locator('.premium-desktop-nav > a[href="/all-vehicles.html"]').click();
    await expect(page.locator('.page-curtain')).toHaveClass(/curtain-covering|curtain-revealing/);
    await expect(page.locator('.page-hero h1')).toContainText('Find the car.');
    await expect(page.locator('.page-curtain')).toHaveClass(/curtain-idle/);
    await page.goBack();
    await expect(page.locator('.hs-intro h1')).toBeVisible();
    await expect(page.locator('.page-curtain')).toHaveClass(/curtain-idle/);
    assert.equal(await page.evaluate(() => document.body.style.overflow), '');
  });

  await check('The Sri Lanka map selects accurate destinations and composes an enquiry', async () => {
    await expect(page.locator('.sl-map-city')).toHaveCount(17);
    await page.getByRole('button', { name: 'Choose Kandy, Central Province, for a vehicle enquiry', exact: true }).click();
    await expect(page.locator('.sl-destination-place h3')).toHaveText('Kandy');
    const href = await page.locator('.sl-destination-link').getAttribute('href');
    assert.equal(new URL(href).pathname, '/94771813928');
    assert.match(new URL(href).searchParams.get('text'), /Kandy/);
    await expect(page.locator('.sl-map-coastline')).toHaveAttribute('src', '/maps/sri-lanka.svg');
  });

  await check('The welcome card and a curated photo/video mix cycle while unpublished records stay hidden', async () => {
    await scrollTo('.ex-stories', 0, 30);
    await expect(page.locator('.ex-story-card h3')).toContainText('Your story');
    await page.getByRole('button', { name: 'Next customer story', exact: true }).click();
    await expect(page.locator('.ex-story-card h3')).toHaveText('Experience fixture A');
    await page.getByRole('button', { name: 'Next customer story', exact: true }).click();
    await expect(page.locator('.ex-story-card h3')).toHaveText('Experience video fixture');
    await page.getByRole('button', { name: 'Previous customer story', exact: true }).click();
    await expect(page.locator('.ex-story-card h3')).toHaveText('Experience fixture A');
    assert.equal(await page.locator('.ex-portrait-rail button').count(), 3);
    assert.ok(!(await page.locator('.ex-stories').innerText()).includes('Unpublished experience fixture'));
  });

  await check('Horizontal conversation follows scrolling and both links are keyboard reachable', async () => {
    await scrollTo('.ex-conversation', 0);
    const startX = await page.locator('.ex-conversation-track').evaluate((node) => new DOMMatrix(getComputedStyle(node).transform).m41);
    await scrollTo('.ex-conversation', 1);
    const endX = await page.locator('.ex-conversation-track').evaluate((node) => new DOMMatrix(getComputedStyle(node).transform).m41);
    assert.ok(endX < startX - 300, 'Scrolling must bring the second photo into view.');
    const first = page.locator('.ex-conversation-panel').first().getByRole('link');
    const second = page.locator('.ex-conversation-panel').nth(1).getByRole('link');
    await first.focus();
    await expect(first).toBeFocused();
    await expect.poll(() => inViewport(first)).toBe(true);
    await page.keyboard.press('Tab');
    await expect(second).toBeFocused();
    await expect.poll(() => inViewport(second)).toBe(true);
    assert.equal(await second.getAttribute('href'), '/vehicle-information-support.html');
  });

  await check('Editorial cards expand on hover and keyboard focus', async () => {
    const cards = page.locator('.ex-guide-card');
    await cards.nth(1).hover();
    await expect.poll(async () => (await cards.nth(1).boundingBox()).width - (await cards.first().boundingBox()).width).toBeGreaterThan(30);
    await cards.nth(2).focus();
    await expect(cards.nth(2)).toHaveClass(/is-active/);
    await expect.poll(async () => (await cards.nth(2).boundingBox()).width - (await cards.first().boundingBox()).width).toBeGreaterThan(30);
    assert.equal(await cards.nth(2).getAttribute('href'), '/vehicle-sourcing-sri-lanka.html');
  });

  await check('Footer validates fields and creates a reviewable WhatsApp draft', async () => {
    const submit = page.locator('.footer-enquiry-form button[type=submit]');
    await submit.click();
    assert.equal(await page.evaluate(() => window.__experienceDrafts.length), 0);
    await page.getByLabel('What are you looking for?', { exact: true }).fill('   ');
    await page.getByLabel('Your city', { exact: true }).fill('   ');
    await submit.click();
    assert.equal(await page.evaluate(() => window.__experienceDrafts.length), 0, 'Whitespace-only fields must not open a draft.');
    await page.getByLabel('What are you looking for?', { exact: true }).fill('  Toyota Aqua  ');
    await page.getByLabel('Your city', { exact: true }).fill('  Kandy  ');
    await submit.click();
    const drafts = await page.evaluate(() => window.__experienceDrafts);
    assert.equal(drafts.length, 1);
    const [address, target, features] = drafts[0];
    const url = new URL(address);
    assert.equal(url.origin, 'https://wa.me');
    assert.equal(url.pathname, '/94771813928');
    assert.match(url.searchParams.get('text'), /looking for Toyota Aqua\. My location is Kandy\./);
    assert.equal(target, '_blank');
    assert.match(features, /noopener/);
    assert.match(await page.locator('.footer-enquiry-form').innerText(), /review and send/i);
  });

  await check('Mobile content offers compact services, a static hero and published reviews', async () => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(base, { waitUntil: 'domcontentloaded' });
    await expect(page.locator('.hs-intro h1')).toBeVisible();
    await expect(page.locator('img.hs-video')).toHaveAttribute('src', '/images/hero1-poster.webp');
    await expect(page.locator('video.hs-video,.hs-device,.hs-phone-scene')).toHaveCount(0);
    await expect(page.locator('.jt-mobile-service')).toHaveCount(3);
    await expect(page.locator('.jt-chapter,.jt-motion-ready')).toHaveCount(0);
    await expect(page.getByRole('tablist', { name: 'Choose your vehicle journey' })).toHaveCount(0);
    await expect(page.getByRole('combobox', { name: 'Choose your vehicle journey' })).toHaveCount(0);
    const serviceLinks = page.locator('.jt-mobile-services .btn');
    assert.deepEqual(await serviceLinks.evaluateAll(links => links.map(link => link.getAttribute('href'))), ['/all-vehicles.html', '/sell-your-vehicle-sri-lanka.html', '/vehicle-sourcing-sri-lanka.html']);
    await page.locator('.jt-mobile-services').getByRole('link', { name: 'Start selling', exact: true }).click();
    await expect(page).toHaveURL(`${base}/sell-your-vehicle-sri-lanka.html`);
    await expect(page.locator('.page-hero h1')).toBeVisible();
    await page.goBack();
    await expect(page.locator('.jt-mobile-services')).toBeVisible();
    await scrollTo('.home-reviews', 0, 100);
    await expect(page.locator('.home-review-card h3')).toHaveText(['Experience fixture A', 'Experience video fixture', 'Experience fixture B']);
    assert.ok(!(await page.locator('.home-reviews').innerText()).includes('Unpublished experience fixture'));
    await expect(page.locator('.home-reviews-more')).toHaveAttribute('href', '/reviews.html');
    assert.deepEqual(await page.locator('.home-review-link').evaluateAll(links => links.map(link => link.getAttribute('href'))), ['/reviews.html?tab=photos', '/reviews.html?tab=videos', '/reviews.html?tab=photos']);
    await page.getByRole('button', { name: 'Next customer stories', exact: true }).click();
    await expect(page.locator('.home-reviews-slide').nth(1)).toHaveAttribute('aria-hidden', 'false');
    const conversation = await page.locator('.ex-conversation-panel').evaluateAll(panels => panels.map(panel => panel.getBoundingClientRect().toJSON()));
    assert.ok(conversation[1].top >= conversation[0].bottom, 'Conversation photos must stack on mobile.');
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
  });

  await check('Reduced motion keeps content and navigation usable without a curtain', async () => {
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto(base, { waitUntil: 'domcontentloaded' });
    await expect(page.locator('.hs-intro h1')).toBeVisible();
    const motion = await page.evaluate(() => ({ conversationPosition: getComputedStyle(document.querySelector('.ex-conversation-sticky')).position, conversationTransform: getComputedStyle(document.querySelector('.ex-conversation-track')).transform }));
    assert.notEqual(motion.conversationPosition, 'sticky');
    assert.equal(motion.conversationTransform, 'none');
    await page.locator('.premium-desktop-nav > a[href="/all-vehicles.html"]').click();
    await expect(page.locator('.page-hero h1')).toContainText('Find the car.');
    await expect(page.locator('.page-curtain')).toBeHidden();
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
  });

} finally {
  const report = { checks, errors, externalMessagesSent: 0 };
  await writeFile('.audit/experience-report.json', JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
  await context.close();
  await browser.close();
  if (checks.some((item) => !item.passed) || errors.length) process.exitCode = 1;
}
