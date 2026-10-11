const puppeteer = require('puppeteer-core');

const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

async function run() {
  const browser = await puppeteer.launch({
    executablePath: chromePath,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1473, height: 738, deviceScaleFactor: 1.25 });
  await page.goto('http://localhost:5173', { waitUntil: 'networkidle0' });
  await new Promise(r => setTimeout(r, 1000));

  console.log('--- EMPTY STATE AT 1473x738 (125% DPI) ---');
  let info = await page.evaluate(() => {
    const h1 = document.querySelector('header h1');
    const h1Rect = h1 ? h1.getBoundingClientRect() : null;
    return {
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
      bodyScrollWidth: document.body.scrollWidth,
      bodyClientWidth: document.body.clientWidth,
      windowScrollX: window.scrollX,
      h1Rect: h1Rect ? { left: Math.round(h1Rect.left), right: Math.round(h1Rect.right), width: Math.round(h1Rect.width) } : null,
      headerRect: document.querySelector('header') ? { left: Math.round(document.querySelector('header').getBoundingClientRect().left), width: Math.round(document.querySelector('header').getBoundingClientRect().width) } : null
    };
  });
  console.log('Empty state info:', JSON.stringify(info, null, 2));

  // Click Try Dino
  const btns = await page.$$('button');
  for (const b of btns) {
    const text = await page.evaluate(el => el.textContent, b);
    if (text && text.includes('Try Dino')) {
      await b.click();
      break;
    }
  }
  await new Promise(r => setTimeout(r, 1500));

  console.log('--- LOADED STATE AT 1473x738 (125% DPI) ---');
  info = await page.evaluate(() => {
    const h1 = document.querySelector('header h1');
    const h1Rect = h1 ? h1.getBoundingClientRect() : null;
    return {
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
      bodyScrollWidth: document.body.scrollWidth,
      bodyClientWidth: document.body.clientWidth,
      windowScrollX: window.scrollX,
      h1Rect: h1Rect ? { left: Math.round(h1Rect.left), right: Math.round(h1Rect.right), width: Math.round(h1Rect.width) } : null,
      headerRect: document.querySelector('header') ? { left: Math.round(document.querySelector('header').getBoundingClientRect().left), width: Math.round(document.querySelector('header').getBoundingClientRect().width) } : null
    };
  });
  console.log('Loaded state info:', JSON.stringify(info, null, 2));

  await browser.close();
}

run().catch(console.error);
