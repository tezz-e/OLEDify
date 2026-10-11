const puppeteer = require('puppeteer-core');
const path = require('path');

const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const artifactDir = 'C:\\Users\\manee\\.gemini\\antigravity\\brain\\e80ebf5e-f898-4a9f-aaaf-6c7d8373833b';

async function main() {
  const browser = await puppeteer.launch({
    executablePath: chromePath,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1 });
  await page.goto('http://localhost:5173', { waitUntil: 'networkidle0' });
  await new Promise(r => setTimeout(r, 600));

  // Screenshot empty state (blue standby on OLED preview)
  await page.screenshot({ path: path.join(artifactDir, 'oled_blue_empty_1440x900.png') });

  // Load Dino
  await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    const b = btns.find(x => x.textContent.includes('Try Dino'));
    if (b) b.click();
  });
  await new Promise(r => setTimeout(r, 1000));

  // Screenshot loaded state with blue OLED preview
  await page.screenshot({ path: path.join(artifactDir, 'oled_blue_loaded_1440x900.png') });

  await browser.close();
  console.log('Blue OLED screenshots captured successfully.');
}

main().catch(console.error);
