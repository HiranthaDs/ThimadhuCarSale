import assert from 'node:assert/strict';
import { chromium, expect } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';

const base = process.env.TEST_URL || 'http://127.0.0.1:5174';
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const errors = [], report = [];
const columns = ['id','brand','model','year','price','mileage','fuel','transmission','type','condition','availability','image1','image2','description'];
const rows = Array.from({length:4}, (_, i) => [`MOBILE-${i+1}`,'Toyota','Aqua',2023,7200000,20000,'Hybrid','Automatic','Hatchback','Used','Available',`${base}/images/hero.webp`,`${base}/images/journey.webp`,'Responsive test fixture.']);
const routes = ['/','/all-vehicles.html','/car-details.html?vehicle=toyota-aqua-2023-mobile-1','/car-details.html','/aboutus.html','/services.html','/reviews.html','/sell-your-vehicle-sri-lanka.html','/vehicle-sourcing-sri-lanka.html','/vehicle-information-support.html','/404.html'];
await mkdir('.audit/mobile-refresh', { recursive: true });

async function installFixtures(context) {
  await context.route('https://docs.google.com/spreadsheets/d/e/**', route => route.fulfill({contentType:'text/csv',headers:{'Access-Control-Allow-Origin':'*'},body:[columns,...rows].map(row=>row.join(',')).join('\n')}));
  await context.route('https://script.google.com/macros/s/**', route => {
    const url = new URL(route.request().url());
    const customers = Array.from({length:4},(_,i)=>({id:`story-${i}`,headline:`Published customer moment ${i+1}`,description:'A test fixture from the published story feed.',customer_name:`Customer ${i+1}`,image_url:`${base}/images/journey.webp`,status:'Active',display_order:i + 1}));
    const videos = [{id:'video-story',headline:'Published video moment',description:'A synthetic video story.',video_url:'https://www.youtube.com/watch?v=dQw4w9WgXcQ',thumbnail_url:`${base}/images/hero.webp`,platform:'YouTube',status:'Active',display_order:1}];
    route.fulfill({contentType:'application/json',headers:{'Access-Control-Allow-Origin':'*'},body:JSON.stringify({apiVersion:'2.1.0',status:'success',data:url.searchParams.get('type') === 'customers' ? customers : videos})});
  });
}

try {
  for (const device of [{width:320,height:780,touch:true},{width:390,height:844,touch:true},{width:430,height:932,touch:true},{width:768,height:1024,touch:true},{width:844,height:390,touch:true},{width:1440,height:1000,touch:false}]) {
    const context = await browser.newContext({ viewport:{width:device.width,height:device.height}, hasTouch:device.touch, isMobile:device.touch });
    await installFixtures(context);
    const page = await context.newPage();
    page.on('pageerror', e => errors.push(e.message));
    const videoRequests = [];
    page.on('request', request => { if (/\.mp4(?:\?|$)/.test(request.url())) videoRequests.push(request.url()); });
    for (const route of routes) {
      await page.goto(base + route, { waitUntil:'domcontentloaded' });
      await expect(page.locator('main h1')).toHaveCount(1);
      await expect(page.locator('.footer-credits')).toContainText('Website designed and developed by HICH WEB');
      assert.equal(await page.locator('.footer-credit-links a[href="tel:+94714112113"]').count(),1);
      const whiteLogos = await page.evaluate(() => ['.brand-footer .brand-logo', '.page-curtain-brand img'].map(selector => {
        const style = getComputedStyle(document.querySelector(selector));
        return style.mixBlendMode === 'normal' && style.filter.includes('invert(1)');
      }));
      assert.ok(whiteLogos.every(Boolean), 'Footer and transition logos must render pure white');
      if (route.includes('?vehicle=')) await expect(page.locator('.detail-heading h1')).toContainText('Aqua');
      const layout = await page.evaluate(() => ({overflow:document.documentElement.scrollWidth > innerWidth + 1,headerBottom:document.querySelector('.site-header').getBoundingClientRect().bottom,detailTop:document.querySelector('.detail-back, .detail-missing .inv-empty')?.getBoundingClientRect().top}));
      assert.equal(layout.overflow,false,`Horizontal overflow at ${device.width}: ${route}`);
      if (route.startsWith('/car-details')) assert.ok(layout.detailTop >= layout.headerBottom + 10,`Covered details ${device.width}: ${JSON.stringify(layout)}`);
      if (route === '/') {
        const sections = await page.locator('.route-content > section').evaluateAll(nodes => nodes.slice(0,3).map(n=>n.className));
        assert.match(sections[0],/hs-story/); assert.match(sections[1],/country-flags/); assert.match(sections[2],/home-inventory/);
        await expect(page.locator('.hs-opening').getByRole('heading',{level:1,name:'THIMADU AUTO TRADERS',exact:true})).toBeVisible();
        await page.locator('.country-flags').scrollIntoViewIfNeeded();
        await expect.poll(()=>page.locator('.country-flags-group').first().locator('img').evaluateAll(nodes=>nodes.every(n=>n.complete && n.naturalWidth>0))).toBe(true);
        if (device.touch) {
          assert.equal(videoRequests.length,0,'Mobile must not download hero video');
          await expect(page.locator('.hs-device')).toHaveCount(0);
          await expect(page.locator('.jt-mobile-service')).toHaveCount(3);
          await expect(page.locator('.jt-panel')).toHaveCount(0);
          await page.locator('.home-reviews').scrollIntoViewIfNeeded();
          await expect(page.locator('.home-review-card')).toHaveCount(5);
          await expect(page.locator('.home-review-card-video')).toHaveCount(1);
          await page.getByRole('button',{name:'Next customer stories',exact:true}).click();
          await expect(page.locator('.home-reviews-slide').nth(1)).toHaveAttribute('aria-hidden','false');
          const animations = await page.evaluate(()=>document.getAnimations().filter(animation=>animation.playState==='running' && !animation.effect?.target?.closest?.('.country-flags')).length);
          assert.equal(animations,0,`Unexpected mobile animation still running at ${device.width}`);
          await expect(page.locator('.country-flags-group')).toHaveCount(2);
          assert.equal(await page.locator('.country-flags-track').evaluate(n=>getComputedStyle(n).animationName),'country-flags-slide');
          await page.getByRole('button',{name:'Pause country flags',exact:true}).click();
          assert.equal(await page.locator('.country-flags-track').evaluate(n=>getComputedStyle(n).animationPlayState),'paused');
          await page.evaluate(()=>scrollTo({top:0,behavior:'instant'}));
          await page.screenshot({path:`.audit/mobile-refresh/home-${device.width}.png`});
          if (device.width === 390) {
            await page.locator('.jt-mobile').scrollIntoViewIfNeeded();
            await page.screenshot({path:'.audit/mobile-refresh/mobile-services.png'});
            await page.evaluate(()=>scrollTo({top:0,behavior:'instant'}));
            await page.screenshot({path:'.audit/mobile-refresh/mobile-full.png',fullPage:true});
          }
        } else {
          await expect(page.locator('.hs-phone-stage .hs-device')).toHaveCount(1);
          await expect(page.locator('.jt-panel')).toHaveCount(1);
          assert.equal(await page.locator('.country-flags-track').evaluate(n=>getComputedStyle(n).animationName),'country-flags-slide');
          await page.getByRole('button',{name:'Pause country flags',exact:true}).click();
          assert.equal(await page.locator('.country-flags-track').evaluate(n=>getComputedStyle(n).animationPlayState),'paused');
        }
      }
      if (route.includes('?vehicle=') && [390,1440].includes(device.width)) await page.screenshot({path:`.audit/mobile-refresh/details-${device.width}.png`});
      report.push({width:device.width,route,...layout});
    }
    await context.close();
  }
  // Resizing an already mounted page must clean up desktop animation work.
  const context=await browser.newContext({viewport:{width:1440,height:1000}});
  await installFixtures(context);
  const page=await context.newPage();
  await page.goto(base);
  await expect(page.locator('.hs-phone-stage .hs-device')).toHaveCount(1);
  await page.setViewportSize({width:390,height:844});
  await expect(page.locator('.hs-device')).toHaveCount(0);
  await expect(page.locator('.jt-mobile-service')).toHaveCount(3);
  await page.setViewportSize({width:1440,height:1000});
  await expect(page.locator('.hs-phone-stage .hs-device')).toHaveCount(1);
  await expect(page.locator('.jt-panel')).toHaveCount(1);
  await context.close();
  const reducedContext=await browser.newContext({viewport:{width:390,height:844},hasTouch:true,isMobile:true,reducedMotion:'reduce'});
  await installFixtures(reducedContext);
  const reducedPage=await reducedContext.newPage();
  await reducedPage.goto(base);
  await expect(reducedPage.locator('.country-flags-group')).toHaveCount(1);
  assert.equal(await reducedPage.locator('.country-flags-track').evaluate(n=>getComputedStyle(n).animationName),'none');
  await expect(reducedPage.locator('.country-flags-hint')).toBeVisible();
  await reducedContext.close();
  assert.deepEqual(errors,[]);
  await writeFile('.audit/mobile-refresh/report.json',JSON.stringify({report,errors},null,2));
  console.log(`PASS: ${report.length} phone/tablet/desktop route checks; mobile keeps only the country flag slideshow moving, with no animated phone or autoplay video; three service cards, published stories, details clearance, shared credits and responsive resize.`);
} finally { await browser.close(); }
