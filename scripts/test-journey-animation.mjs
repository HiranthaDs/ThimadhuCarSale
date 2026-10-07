import { chromium } from '@playwright/test';

const baseURL = process.env.TEST_URL || 'http://127.0.0.1:4174';
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

try {
  await page.goto(`${baseURL}/`, { waitUntil: 'networkidle' });
  const firstChapter = page.locator('.jt-chapter').first();
  await firstChapter.waitFor();

  const before = await firstChapter.evaluate(element => ({
    motionReady: element.closest('.jt-panel').classList.contains('jt-motion-ready'),
    visible: element.classList.contains('is-visible'),
    opacity: getComputedStyle(element.querySelector('.jt-chapter-visual')).opacity,
  }));
  if (!before.motionReady || before.visible || before.opacity !== '0') {
    throw new Error(`Chapter did not begin in its motion-ready state: ${JSON.stringify(before)}`);
  }

  await firstChapter.scrollIntoViewIfNeeded();
  await page.waitForTimeout(1400);
  const revealed = await firstChapter.evaluate(element => ({
    visible: element.classList.contains('is-visible'),
    visualOpacity: getComputedStyle(element.querySelector('.jt-chapter-visual')).opacity,
    copyOpacity: getComputedStyle(element.querySelector('.jt-chapter-copy')).opacity,
    phoneOpacity: getComputedStyle(element.querySelector('.jt-chapter-phone')).opacity,
    proofOpacity: getComputedStyle(element.querySelector('.jt-proof-first')).opacity,
  }));
  if (!revealed.visible || Object.values(revealed).some(value => value === '0')) {
    throw new Error(`Chapter did not complete its reveal: ${JSON.stringify(revealed)}`);
  }

  const cardOffsets = async () => firstChapter.evaluate(element => {
    const offset = selector => new DOMMatrix(getComputedStyle(element.querySelector(selector)).transform).m42;
    return { visual: offset('.jt-chapter-visual'), copy: offset('.jt-chapter-copy') };
  });
  const offsetsBeforeScroll = await cardOffsets();
  await page.mouse.wheel(0, 420);
  await page.waitForTimeout(350);
  const offsetsAfterScroll = await cardOffsets();
  const visualDelta = offsetsAfterScroll.visual - offsetsBeforeScroll.visual;
  const copyDelta = offsetsAfterScroll.copy - offsetsBeforeScroll.copy;
  if (Math.abs(visualDelta) < 3 || Math.abs(copyDelta) < 3 || Math.sign(visualDelta) === Math.sign(copyDelta)) {
    throw new Error(`Cards did not move independently with scroll: ${JSON.stringify({ offsetsBeforeScroll, offsetsAfterScroll })}`);
  }

  await page.locator('#jt-tab-sell').click();
  await page.waitForTimeout(1400);
  const replayed = await page.locator('.jt-chapter').first().evaluate(element => ({
    ready: element.closest('.jt-panel').classList.contains('jt-motion-ready'),
    visible: element.classList.contains('is-visible'),
    copyOpacity: getComputedStyle(element.querySelector('.jt-chapter-copy')).opacity,
  }));
  if (!replayed.ready || !replayed.visible || replayed.copyOpacity !== '1') {
    throw new Error(`Journey change did not replay the reveal: ${JSON.stringify(replayed)}`);
  }

  await page.screenshot({ path: '.audit/current/journey-card-animation.png' });
  console.log('PASS journey cards: entrance reveal, independent scroll movement, staggered contents, and tab-change replay');
} finally {
  await browser.close();
}
