import puppeteer from 'puppeteer';

const url = process.argv[2] ?? 'http://localhost:4173/';
const out = process.argv[3] ?? 'shot';

const browser = await puppeteer.launch();
const page = await browser.newPage();
await page.setViewport({ width: 1440, height: 1000, deviceScaleFactor: 2 });
await page.goto(url, { waitUntil: 'networkidle0' });
await new Promise((r) => setTimeout(r, 600));

await page.screenshot({ path: `${out}-top.png` });
await page.screenshot({ path: `${out}-full.png`, fullPage: true });

await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2 });
await new Promise((r) => setTimeout(r, 400));
await page.screenshot({ path: `${out}-mobile.png`, fullPage: true });

// Surface the headline result as text so we can sanity-check the maths in situ.
const verdict = await page.evaluate(() => {
  const h = document.querySelector('#verdict-heading')?.parentElement;
  return h ? h.innerText.replace(/\n{2,}/g, '\n') : 'NO VERDICT FOUND';
});
console.log('--- VERDICT ---\n' + verdict);

await browser.close();
