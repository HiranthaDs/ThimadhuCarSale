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
await context.route('https://docs.google.com/spreadsheets/d/*/gviz/**', async (route) => {
  const url = new URL(route.request().url());
  const callback = url.searchParams.get('tqx')?.split('responseHandler:')[1];
  if (!callback || !/^[\w$]+$/.test(callback)) return route.continue();
  const records = url.searchParams.get('gid') === '1902933500' ? customerFixtures : [];
  const keys = Object.keys(customerFixtures[0]);
  await route.fulfill({ contentType: 'text/javascript', body: `${callback}(${JSON.stringify({ status: 'ok', table: { cols: keys.map((label) => ({ label })), rows: records.map((record) => ({ c: keys.map((key) => ({ v: record[key] ?? '' })) })) } })});` });
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
    await page.getByRole('button', { name: 'Choose Kandy for a vehicle enquiry', exact: true }).click();
    await expect(page.locator('.sl-destination-place h3')).toHaveText('Kandy');
    const href = await page.locator('.sl-destination-link').getAttribute('href');
    assert.equal(new URL(href).pathname, '/94771813928');
    assert.match(new URL(href).searchParams.get('text'), /Kandy/);
    await expect(page.locator('.sl-map-coastline')).toHaveAttribute('src', '/maps/sri-lanka.svg');
  });

  await check('Published customer stories load, cycle, and omit unpublished records', async () => {
    await scrollTo('.ex-stories', 0, 30);
    await expect(page.locator('.ex-story-card h3')).toHaveText('Experience fixture A');
    await page.getByRole('button', { name: 'Next customer story', exact: true }).click();
    await expect(page.locator('.ex-story-card h3')).toHaveText('Experience fixture B');
    await page.getByRole('button', { name: 'Previous customer story', exact: true }).click();
    await expect(page.locator('.ex-story-card h3')).toHaveText('Experience fixture A');
    assert.equal(await page.locator('.ex-portrait-rail button').count(), 2);
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

  await check('Mobile content fits and service selection remains usable', async () => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(base, { waitUntil: 'domcontentloaded' });
    await expect(page.locator('.hs-intro h1')).toBeVisible();
    await page.getByRole('combobox', { name: 'Choose your vehicle journey' }).selectOption({ label: 'Sell your vehicle' });
    await expect(page.getByRole('tabpanel').getByRole('link', { name: 'Start selling your vehicle', exact: true })).toBeVisible();
    assert.equal(await page.getByRole('tablist', { name: 'Choose your vehicle journey' }).isVisible(), false);
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
