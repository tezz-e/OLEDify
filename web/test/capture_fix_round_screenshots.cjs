const puppeteer = require('puppeteer-core');
const path = require('path');

const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const artifactDir = 'C:\\Users\\manee\\.gemini\\antigravity\\brain\\e80ebf5e-f898-4a9f-aaaf-6c7d8373833b';

async function run() {
  console.log('=== CAPTURING FIX ROUND SCREENSHOTS ===');
  const browser = await puppeteer.launch({
    executablePath: chromePath,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1 });
  await page.goto('http://localhost:5173', { waitUntil: 'networkidle0' });
  await new Promise(r => setTimeout(r, 800));

  // 1. OLED Screen Empty Standby (Neutral palette: lit #FFFFFF, unlit #0E0E10, text neutral grey)
  const oledBezel = await page.$('.oled-bezel, div.rounded-\\[12px\\]');
  if (oledBezel) {
    await oledBezel.screenshot({ path: path.join(artifactDir, 'oled_neutral_empty.png') });
    console.log('Saved oled_neutral_empty.png');
  }

  // Knob at value 0 (empty state: knobs are all at default 0)
  const knobEl = await page.$('div[role="slider"]');
  if (knobEl) {
    // Capture the entire knob component container (parent or slider)
    const knobContainer = await page.evaluateHandle(el => el.closest('div.flex.flex-col.items-center') || el, knobEl);
    await knobContainer.screenshot({ path: path.join(artifactDir, 'knob_zero.png') });
    console.log('Saved knob_zero.png');
  }

  // Load Dino
  const btns = await page.$$('button');
  for (const b of btns) {
    const text = await page.evaluate(el => el.textContent, b);
    if (text && text.includes('Try Dino')) {
      await b.click();
      break;
    }
  }
  await new Promise(r => setTimeout(r, 1200));

  // 2. OLED Screen Loaded State (Neutral lit white pixels)
  const loadedOledBezel = await page.$('div.rounded-\\[12px\\]');
  if (loadedOledBezel) {
    await loadedOledBezel.screenshot({ path: path.join(artifactDir, 'oled_neutral_loaded.png') });
    console.log('Saved oled_neutral_loaded.png');
  }

  // 3. Clip label check: Long clip
  const clipBlock = await page.$('div[data-clip-id]');
  if (clipBlock) {
    await clipBlock.screenshot({ path: path.join(artifactDir, 'clip_long.png') });
    console.log('Saved clip_long.png');
  }

  // Create a short clip by trimming or adding a short clip
  // We can trim the clip by executing trim or setting clip duration
  await page.evaluate(() => {
    // We can also find the clip title element and measure its left padding
    const label = document.querySelector('div[data-clip-id] span.truncate');
    if (label) {
      const parent = label.parentElement;
      return {
        paddingLeft: window.getComputedStyle(parent).paddingLeft,
        paddingRight: window.getComputedStyle(parent).paddingRight
      };
    }
  });

  // Split clip or resize clip to make it short
  // Press 's' to split at current playhead or step forward and split
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('s');
  await new Promise(r => setTimeout(r, 500));

  const clips = await page.$$('div[data-clip-id]');
  if (clips.length > 0) {
    // First clip is now short (~5-10 frames)
    await clips[0].screenshot({ path: path.join(artifactDir, 'clip_short.png') });
    console.log('Saved clip_short.png');
  }

  // 4. Knob Modulated (non-zero value)
  // Let's drag or set a knob value (e.g. brightness or contrast)
  const knobSliders = await page.$$('div[role="slider"]');
  if (knobSliders.length > 0) {
    const box = await knobSliders[0].boundingBox();
    if (box) {
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
      await page.mouse.down();
      await page.mouse.move(box.x + box.width / 2, box.y - 40, { steps: 5 });
      await page.mouse.up();
      await new Promise(r => setTimeout(r, 300));
    }
    const knobContainer = await page.evaluateHandle(el => el.closest('div.flex.flex-col.items-center') || el, knobSliders[0]);
    await knobContainer.screenshot({ path: path.join(artifactDir, 'knob_modulated.png') });
    console.log('Saved knob_modulated.png');
  }

  // Full UI screenshots for both empty and loaded state at 1440x900
  await page.screenshot({ path: path.join(artifactDir, 'final_loaded_1440x900.png') });
  console.log('Saved final_loaded_1440x900.png');

  await browser.close();
}

run().catch(console.error);
