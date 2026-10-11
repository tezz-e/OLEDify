const puppeteer = require('puppeteer-core');
const path = require('path');

const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const artifactDir = 'C:\\Users\\manee\\.gemini\\antigravity\\brain\\e80ebf5e-f898-4a9f-aaaf-6c7d8373833b';

async function run() {
  const browser = await puppeteer.launch({
    executablePath: chromePath,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1 });
  await page.goto('http://localhost:5173', { waitUntil: 'networkidle0' });
  await new Promise(r => setTimeout(r, 600));

  // Load Dino to enable DitherControls
  const btns = await page.$$('button');
  for (const b of btns) {
    const text = await page.evaluate(el => el.textContent, b);
    if (text && text.includes('Try Dino')) {
      await b.click();
      break;
    }
  }
  await new Promise(r => setTimeout(r, 1200));

  // Find the Brightness knob
  const knobs = await page.$$('div[role="slider"]');
  console.log(`Found ${knobs.length} knobs`);
  if (knobs.length > 0) {
    const brightnessKnob = knobs[0];
    const parentContainer = await page.evaluateHandle(el => el.closest('div.flex.flex-col.items-center'), brightnessKnob);

    // 1. Capture at value 0
    await parentContainer.screenshot({ path: path.join(artifactDir, 'knob_zero.png') });
    console.log('Saved knob_zero.png');

    // 2. Modulate the knob: drag it up
    const box = await brightnessKnob.boundingBox();
    if (box) {
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
      await page.mouse.down();
      await page.mouse.move(box.x + box.width / 2, box.y - 50, { steps: 10 });
      await page.mouse.up();
      await new Promise(r => setTimeout(r, 300));
    }

    const valAfter = await page.evaluate(el => el.getAttribute('aria-valuenow'), brightnessKnob);
    console.log('Knob value after drag:', valAfter);

    await parentContainer.screenshot({ path: path.join(artifactDir, 'knob_modulated.png') });
    console.log('Saved knob_modulated.png');
  }

  await browser.close();
}

run().catch(console.error);
