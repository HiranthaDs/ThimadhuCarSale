import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { chromium, expect } from '@playwright/test';

const base = process.env.TEST_URL || 'http://127.0.0.1:5174';
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce' });
const errors = [];
// Synthetic records exist only inside this isolated browser session.
await context.route('https://docs.google.com/spreadsheets/d/e/**', route => route.fulfill({
  status: 200, contentType: 'text/csv', headers: { 'Access-Control-Allow-Origin': '*' },
  body: `id,brand,model,year,price,mileage,fuel,transmission,type,condition,availability,image1\nNAV-1,Toyota,Aqua,2022,5000000,40000,Hybrid,Automatic,Hatchback,Used,Available,${base}/images/hero.webp\nNAV-2,Honda,Vezel,2020,7000000,50000,Hybrid,Automatic,SUV,Used,Available,\nNAV-3,Toyota,Premio,2018,6000000,60000,Petrol,Automatic,Sedan,Used,Available,\n`,
}));
await context.route('https://wa.me/**', route => route.abort());
const page = await context.newPage();
page.on('pageerror', error => errors.push(error.message));
await mkdir('.audit/navigation', { recursive: true });

try {
  await page.goto(base + '/aboutus.html');
  await page.getByRole('button', { name: 'Our services', exact: true }).click();
  await expect(page.locator('.nav-mega-menu')).toBeVisible();
  await page.screenshot({ path: '.audit/navigation/desktop-mega-menu.png' });
  await page.keyboard.press('Escape');
  await expect(page.locator('.nav-mega-menu')).toBeHidden();

  await page.keyboard.press('Control+k');
  await expect(page.locator('.nav-search-dialog')).toBeVisible();
  await expect(page.locator('#global-vehicle-search')).toBeFocused();
  await expect(page.locator('.nav-preview-label')).toContainText('3 vehicles');
  await page.screenshot({ path: '.audit/navigation/desktop-search.png' });
  await page.getByLabel('Make', { exact: true }).selectOption('toyota');
  await page.getByLabel('Body type', { exact: true }).selectOption('hatchback');
  await expect(page.locator('.nav-result')).toHaveCount(1);
  await expect(page.locator('.nav-result')).toContainText('Aqua');
  await expect(page.locator('.nav-result-photo img')).toHaveAttribute('src', `${base}/images/hero.webp`);
  await page.getByLabel('Minimum budget in LKR').fill('6000000');
  await page.getByLabel('Maximum budget in LKR').fill('4000000');
  await expect(page.locator('#nav-range-error')).toBeVisible();
  await expect(page.locator('.nav-search-submit')).toBeDisabled();
  await page.getByLabel('Minimum budget in LKR').fill('4000000');
  await page.getByLabel('Maximum budget in LKR').fill('6000000');
  await page.getByLabel('Earliest model year').fill('2021');
  await page.getByLabel('Latest model year').fill('2023');
  await page.getByLabel('Fuel', { exact: true }).selectOption('hybrid');
  await expect(page.locator('.nav-result')).toHaveCount(1);
  await page.locator('.nav-search-submit').click();
  await page.waitForURL('**/all-vehicles.html?brand=toyota&type=hatchback&fuel=hybrid&minPrice=4000000&maxPrice=6000000&minYear=2021&maxYear=2023');
  await expect(page.locator('.vehicle-card')).toHaveCount(1);
  await expect(page.locator('.vehicle-card')).toContainText('Aqua');

  await page.getByRole('button', { name: 'Open vehicle search' }).click();
  await expect(page.getByLabel('Make', { exact: true })).toHaveValue('toyota');
  await page.locator('#global-vehicle-search').fill('no-such-car');
  await expect(page.locator('.nav-search-state h3')).toHaveText('Still out there.');
  await page.evaluate(() => {
    window.__navigationQuery = window.VehicleStore.query;
    window.VehicleStore.query = () => Promise.reject(new Error('Synthetic connection failure'));
  });
  await page.locator('.nav-search-dialog').getByRole('button', { name: 'Reset', exact: true }).click();
  await expect(page.locator('.nav-search-state h3')).toHaveText('Let’s connect you.');
  await page.evaluate(() => { window.VehicleStore.query = window.__navigationQuery; delete window.__navigationQuery; });
  await page.getByRole('button', { name: 'Try again', exact: true }).click();
  await expect(page.locator('.nav-result')).toHaveCount(3);
  await page.keyboard.press('Escape');
  assert.equal(await page.evaluate(() => document.body.style.overflow), '');

  await page.setViewportSize({ width: 390, height: 844 });
  await page.locator('.menu-toggle').click();
  await expect(page.locator('#mobile-navigation')).toBeVisible();
  await page.screenshot({ path: '.audit/navigation/mobile-menu.png' });
  assert.equal(await page.evaluate(() => document.body.style.overflow), 'hidden');
  assert.equal(await page.evaluate(() => document.querySelector('main').inert), true);
  await page.keyboard.press('Shift+Tab');
  await expect(page.locator('.menu-toggle')).toBeFocused();
  await page.keyboard.press('Shift+Tab');
  await expect(page.locator('.mobile-menu-footer>a').last()).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(page.locator('.menu-toggle')).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(page.locator('#mobile-navigation')).toBeHidden();
  assert.equal(await page.evaluate(() => document.querySelector('main').inert), false);
  await page.getByRole('button', { name: 'Open vehicle search' }).click();
  await expect(page.locator('.nav-search-dialog')).toBeVisible();
  await expect(page.locator('.nav-preview-label')).toContainText('1 vehicle');
  await page.screenshot({ path: '.audit/navigation/mobile-search.png' });
  await page.setViewportSize({ width: 320, height: 740 });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
  const dialogSize = await page.locator('.nav-search-panel').evaluate(el => ({ scroll: el.scrollWidth, width: el.clientWidth }));
  assert.equal(dialogSize.scroll <= dialogSize.width, true);
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button', { name: 'Open vehicle search' })).toBeFocused();
  assert.deepEqual(errors, []);
  console.log('PASS: real worker search filters, URL handoff, previews/images, empty/error/retry states, invalid ranges, Ctrl+K/Escape, mega-menu, mobile focus trap, body lock/inert cleanup, and 320px layout.');
} catch (error) {
  await page.screenshot({ path: '.audit/navigation/failure.png' });
  throw error;
} finally {
  await context.close();
  await browser.close();
}
