import { chromium } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
await mkdir('.audit/reference-current', {recursive:true});
const browser = await chromium.launch({channel:'chrome',headless:true});
const page = await browser.newPage({viewport:{width:1440,height:1000}});
await page.goto('https://driveberry.fr/', {waitUntil:'domcontentloaded',timeout:60000});
await page.waitForTimeout(7000);
await page.evaluate(()=>{document.querySelectorAll('[class*=cookie], [id*=cookie]').forEach(x=>x.remove());});
const info = await page.evaluate(()=>({height:document.body.scrollHeight,fonts:[...document.fonts].map(x=>({family:x.family,weight:x.weight,status:x.status})),headings:[...document.querySelectorAll('h1,h2')].map(n=>({text:n.textContent.trim(),class:n.className,font:getComputedStyle(n).fontFamily,size:getComputedStyle(n).fontSize,weight:getComputedStyle(n).fontWeight,y:n.getBoundingClientRect().top+scrollY})),video:[...document.querySelectorAll('video')].map(n=>({src:n.src,sources:[...n.querySelectorAll('source')].map(s=>s.src)})),scripts:[...document.scripts].map(n=>n.src).filter(Boolean)}));
await writeFile('.audit/reference-current/layout.json',JSON.stringify(info,null,2));
for(const y of [0,500,1000,1500,2100,3000,4200,5500,7000,9000,11000,14000]){await page.evaluate(y=>scrollTo({top:y,behavior:'instant'}),y);await page.waitForTimeout(750);await page.screenshot({path:`.audit/reference-current/scroll-${y}.png`});}
console.log(JSON.stringify(info,null,2));
await browser.close();
