const puppeteer = require('puppeteer-core');
const path = require('path');

const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const artifactDir = 'C:\\Users\\manee\\.gemini\\antigravity\\brain\\e80ebf5e-f898-4a9f-aaaf-6c7d8373833b';

async function main() {
  console.log('Launching Chrome...');
  const browser = await puppeteer.launch({
    executablePath: chromePath,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1440,900']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 2 });

  console.log('Navigating to http://localhost:5173 ...');
  await page.goto('http://localhost:5173', { waitUntil: 'networkidle0' });

  // Wait 1.5 seconds for all canvas fonts and renders to stabilize
  await new Promise(r => setTimeout(r, 1500));

  const emptyStatePath = path.join(artifactDir, 'oled_studio_empty_state.png');
  await page.screenshot({ path: emptyStatePath });
  console.log('Saved empty state screenshot to:', emptyStatePath);

  // Click "Try Dino" button to load sample
  const buttons = await page.$$('button');
  let clicked = false;
  for (const b of buttons) {
    const text = await page.evaluate(el => el.textContent, b);
    if (text && text.includes('Try Dino')) {
      console.log('Found "Try Dino" button, clicking...');
      await b.click();
      clicked = true;
      break;
    }
  }

  if (clicked) {
    await new Promise(r => setTimeout(r, 2000));
    const loadedStatePath = path.join(artifactDir, 'oled_studio_loaded_state.png');
    await page.screenshot({ path: loadedStatePath });
    console.log('Saved loaded state screenshot to:', loadedStatePath);
  }

  await browser.close();
  console.log('Done!');
}

main().catch(err => {
  console.error('Error taking screenshot:', err);
  process.exit(1);
});
