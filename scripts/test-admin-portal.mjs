import assert from 'node:assert/strict';
import { chromium, expect } from '@playwright/test';

const base = process.env.TEST_URL || 'http://127.0.0.1:5174';
const endpoint = 'https://script.google.com/macros/s/**';
const validToken = 'synthetic-admin-test-token';
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const errors = [];

function response(body, contentType = 'application/json') {
  return { status: 200, contentType, headers: { 'Access-Control-Allow-Origin': '*' }, body: typeof body === 'string' ? body : JSON.stringify(body) };
}

try {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const videos = [];
  await context.route(endpoint, async route => {
    const request = route.request();
    if (request.method() === 'GET') {
      return route.fulfill(response({ status: 'success', apiVersion: '2.1.0', version: '2.1.0' }));
    }

    const payload = JSON.parse(request.postData() || '{}');
    if (payload.action === 'auth') {
      return route.fulfill(response(payload.token === validToken
        ? { status: 'success', apiVersion: '2.1.0', message: 'Authenticated' }
        : { status: 'error', apiVersion: '2.1.0', code: 'UNAUTHORIZED', message: 'Invalid admin password' }));
    }
    if (payload.token !== validToken) {
      return route.fulfill(response({ status: 'error', apiVersion: '2.1.0', code: 'UNAUTHORIZED', message: 'Invalid admin password' }));
    }
    if (payload.action === 'read_admin') {
      return route.fulfill(response({ status: 'success', apiVersion: '2.1.0', data: { vehicles: [], customers: [], videos } }));
    }
    if (payload.action === 'create' && payload.resource === 'videos') {
      videos.push({ id: 'VID-TEST', headline: payload.headline, description: payload.description, video_url: payload.video_url, thumbnail_url: '', display_order: 0, status: 'Active', posted_date: '2026-10-09' });
      return route.fulfill(response({ status: 'success', apiVersion: '2.1.0', message: 'Video created successfully.' }));
    }
    return route.fulfill(response({ status: 'error', apiVersion: '2.1.0', code: 'INVALID_ACTION', message: 'Unexpected test action' }));
  });

  const page = await context.newPage();
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(`${base}/ADMIN-THIMADU.html`, { waitUntil: 'domcontentloaded' });
  await expect(page.locator('#apiStatus')).toHaveAttribute('data-state', 'ready');
  await expect(page.locator('#apiStatusText')).toContainText('API 2.1.0');

  await page.locator('#passwordInput').fill('wrong-password');
  await page.locator('#loginBtn').click();
  await expect(page.locator('#loginError')).toContainText('Invalid admin password');
  await expect(page.locator('#app')).toHaveClass(/hidden/);

  await page.locator('#passwordInput').fill(validToken);
  await page.locator('#loginBtn').click();
  await expect(page.locator('#loginOverlay')).toHaveClass(/hidden/);
  await expect(page.locator('#app')).not.toHaveClass(/hidden/);
  await expect(page.locator('#countVehicles')).toHaveText('0');

  await page.locator('[data-section-link="videos"]').first().click();
  await page.locator('#videoForm [name="headline"]').fill('Admin portal test video');
  await page.locator('#videoForm [name="description"]').fill('Synthetic browser-only fixture.');
  await page.locator('#videoForm [name="video_url"]').fill('https://www.youtube.com/watch?v=dQw4w9WgXcQ');
  await page.locator('#videoSubmitBtn').click();
  await expect(page.locator('#videoList')).toContainText('Admin portal test video');
  await expect(page.locator('#countVideos')).toHaveText('1');
  assert.deepEqual(errors, []);
  await context.close();

  const incompatibleContext = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await incompatibleContext.route(endpoint, route => route.fulfill(response('Autoxo Admin API is Online.', 'text/plain')));
  const incompatiblePage = await incompatibleContext.newPage();
  await incompatiblePage.goto(`${base}/ADMIN-THIMADU.html`, { waitUntil: 'domcontentloaded' });
  await expect(incompatiblePage.locator('#apiStatus')).toHaveAttribute('data-state', 'error');
  await expect(incompatiblePage.locator('#apiStatusText')).toContainText('not the Thimadu Admin API');
  await incompatibleContext.close();

  console.log('PASS: admin API compatibility, rejected login, authenticated dashboard load, video create/refresh, and wrong-deployment diagnostics.');
} finally {
  await browser.close();
}
