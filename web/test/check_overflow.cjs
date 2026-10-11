const puppeteer = require('puppeteer-core');

const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

const viewports = [
  { width: 1280, height: 720 },
  { width: 1473, height: 738 },
  { width: 1536, height: 730 },
  { width: 1920, height: 1080 }
];

async function run() {
  const browser = await puppeteer.launch({
    executablePath: chromePath,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();

  console.log('--- CHECKING HORIZONTAL OVERFLOW & SCROLLWIDTH VS CLIENTWIDTH ---');
  for (const vp of viewports) {
    await page.setViewport({ width: vp.width, height: vp.height, deviceScaleFactor: 1 });
    await page.goto('http://localhost:5173', { waitUntil: 'networkidle0' });
    await new Promise(r => setTimeout(r, 600));

    const metrics = await page.evaluate(() => {
      const docEl = document.documentElement;
      const body = document.body;
      const scrollWidth = docEl.scrollWidth;
      const clientWidth = docEl.clientWidth;
      const bodyScrollWidth = body.scrollWidth;
      const bodyClientWidth = body.clientWidth;
      const scrollX = window.scrollX;
      
      // Find any elements whose bounding rect right > clientWidth or left < 0
      const overflowingElements = [];
      document.querySelectorAll('*').forEach(el => {
        const r = el.getBoundingClientRect();
        if (r.right > clientWidth + 1 || r.left < -1) {
          overflowingElements.push({
            tag: el.tagName,
            id: el.id,
            className: (el.className || '').toString().slice(0, 50),
            left: Math.round(r.left),
            right: Math.round(r.right),
            width: Math.round(r.width)
          });
        }
      });

      const headerH1 = document.querySelector('header h1');
      const h1Rect = headerH1 ? headerH1.getBoundingClientRect() : null;

      return {
        scrollWidth,
        clientWidth,
        bodyScrollWidth,
        bodyClientWidth,
        scrollX,
        h1Left: h1Rect ? Math.round(h1Rect.left) : null,
        overflowingCount: overflowingElements.length,
        sampleOverflow: overflowingElements.slice(0, 5)
      };
    });

    console.log(`Viewport ${vp.width}x${vp.height}:`);
    console.log(`  scrollWidth: ${metrics.scrollWidth}, clientWidth: ${metrics.clientWidth}, hasOverflow: ${metrics.scrollWidth > metrics.clientWidth}`);
    console.log(`  body.scrollWidth: ${metrics.bodyScrollWidth}, body.clientWidth: ${metrics.bodyClientWidth}`);
    console.log(`  h1 Left: ${metrics.h1Left}px, scrollX: ${metrics.scrollX}`);
    if (metrics.sampleOverflow.length > 0) {
      console.log(`  Overflowing elements:`, JSON.stringify(metrics.sampleOverflow, null, 2));
    }
  }

  await browser.close();
}

run().catch(console.error);
