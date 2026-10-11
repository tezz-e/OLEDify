const puppeteer = require('puppeteer-core');
const path = require('path');

const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const artifactDir = 'C:\\Users\\manee\\.gemini\\antigravity\\brain\\e80ebf5e-f898-4a9f-aaaf-6c7d8373833b';

async function main() {
  console.log('--- Measuring Stage and Canvas Across All Scales ---');
  const browser = await puppeteer.launch({
    executablePath: chromePath,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1 });
  await page.goto('http://localhost:5173', { waitUntil: 'networkidle0' });
  await new Promise(r => setTimeout(r, 1000));

  // Load Dino
  console.log('Clicking "Try Dino"...');
  await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    const b = btns.find(x => x.textContent.includes('Try Dino'));
    if (b) b.click();
  });
  await new Promise(r => setTimeout(r, 1500));

  async function measure(label) {
    const data = await page.evaluate(() => {
      const fullPane = Array.from(document.querySelectorAll('h3')).find(h => h.textContent.includes('Full preview'))?.closest('div[class*="flex-1 min-w-0"]');
      const oledPane = Array.from(document.querySelectorAll('h3')).find(h => h.textContent.includes('OLED preview'))?.closest('div[class*="shrink-0 w-auto"]');
      const oledCanvas = document.querySelector('canvas.oled-screen');

      const fR = fullPane ? fullPane.getBoundingClientRect() : null;
      const oR = oledPane ? oledPane.getBoundingClientRect() : null;
      const cR = oledCanvas ? oledCanvas.getBoundingClientRect() : null;

      return {
        fullPane: fR ? { width: Math.round(fR.width), height: Math.round(fR.height), left: Math.round(fR.left), right: Math.round(fR.right) } : null,
        oledPane: oR ? { width: Math.round(oR.width), height: Math.round(oR.height), left: Math.round(oR.left), right: Math.round(oR.right) } : null,
        canvas: cR ? { width: Math.round(cR.width), height: Math.round(cR.height) } : null,
      };
    });
    console.log(`[${label}] Measurements:`, JSON.stringify(data, null, 2));
    return data;
  }

  // 1. Default (1x)
  const m1 = await measure('1× (Default)');
  await page.screenshot({ path: path.join(artifactDir, 'loaded_state_1x.png') });

  // 2. Click 2x
  await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    const b = btns.find(x => x.textContent.trim() === '2×');
    if (b) b.click();
  });
  await new Promise(r => setTimeout(r, 400));
  const m2 = await measure('2×');
  await page.screenshot({ path: path.join(artifactDir, 'loaded_state_2x.png') });

  // 3. Click 4x
  await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    const b = btns.find(x => x.textContent.trim() === '4×');
    if (b) b.click();
  });
  await new Promise(r => setTimeout(r, 400));
  const m4 = await measure('4×');
  await page.screenshot({ path: path.join(artifactDir, 'loaded_state_4x.png') });

  // 4. Click Fit
  await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    const b = btns.find(x => x.textContent.trim() === 'Fit');
    if (b) b.click();
  });
  await new Promise(r => setTimeout(r, 400));
  const mFit = await measure('Fit');
  await page.screenshot({ path: path.join(artifactDir, 'loaded_state_fit.png') });

  // 5. Check Full Preview >= OLED preview at default (1x)
  console.log(`Validation at default (1x):`);
  console.log(`Full preview width: ${m1.fullPane?.width}px, OLED preview width: ${m1.oledPane?.width}px`);
  console.log(`Full preview >= OLED preview? ${m1.fullPane?.width >= m1.oledPane?.width}`);
  console.log(`Canvas at 1x is 128x64? width=${m1.canvas?.width}, height=${m1.canvas?.height}`);
  console.log(`Canvas at 2x is 256x128? width=${m2.canvas?.width}, height=${m2.canvas?.height}`);
  console.log(`Canvas at 4x is 512x256? width=${m4.canvas?.width}, height=${m4.canvas?.height}`);

  await browser.close();
  console.log('--- Done ---');
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
