import {chromium} from '@playwright/test';
import {mkdir,writeFile} from 'node:fs/promises';
const base=process.env.TEST_URL||'http://127.0.0.1:5174';
await mkdir('.audit/current',{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true});
const page=await browser.newPage({viewport:{width:1440,height:1000}});
const errors=[];page.on('pageerror',error=>errors.push(error.message));
await page.goto(base,{waitUntil:'domcontentloaded'});await page.evaluate(()=>document.fonts.ready);await page.waitForTimeout(1500);
await page.screenshot({path:'.audit/current/hero-desktop.png'});
for(const [name,y] of [['phone-morph',650],['phone-desktop',1600]]){await page.evaluate(y=>scrollTo({top:y,behavior:'instant'}),y);await page.waitForTimeout(650);await page.screenshot({path:`.audit/current/${name}.png`});}
for(const [name,selector] of [['gauge','.confidence-gauge'],['services','.jt-chapter'],['services-second','.jt-chapter:nth-child(2)'],['map','.sl-network'],['footer','.footer-enquiry']]){await page.locator(selector).first().evaluate(n=>scrollTo({top:scrollY+n.getBoundingClientRect().top-110,behavior:'instant'}));await page.waitForTimeout(700);await page.screenshot({path:`.audit/current/${name}.png`});}
await page.setViewportSize({width:390,height:844});await page.goto(base,{waitUntil:'domcontentloaded'});await page.waitForTimeout(1200);await page.screenshot({path:'.audit/current/hero-mobile.png'});
await page.locator('.hs-phone-stage').evaluate(n=>scrollTo({top:scrollY+n.getBoundingClientRect().top-100,behavior:'instant'}));await page.waitForTimeout(700);await page.screenshot({path:'.audit/current/phone-mobile.png'});
await page.locator('.jt-chapter-copy').first().evaluate(n=>scrollTo({top:scrollY+n.getBoundingClientRect().top-100,behavior:'instant'}));await page.waitForTimeout(400);await page.screenshot({path:'.audit/current/services-mobile.png'});
await writeFile('.audit/current/visual-report.json',JSON.stringify({errors,overflow:await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth)},null,2));
console.log(JSON.stringify({errors,completed:true}));await browser.close();
