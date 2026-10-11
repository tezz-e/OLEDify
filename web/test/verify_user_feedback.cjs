const puppeteer = require('puppeteer-core');
const path = require('path');

const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const artifactDir = 'C:\\Users\\manee\\.gemini\\antigravity\\brain\\e80ebf5e-f898-4a9f-aaaf-6c7d8373833b';

async function run() {
  console.log('=== VERIFYING USER FEEDBACK FIXES ===');
  const browser = await puppeteer.launch({
    executablePath: chromePath,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1 });
  await page.goto('http://localhost:5173', { waitUntil: 'networkidle0' });
  await new Promise(r => setTimeout(r, 800));

  // 1. Load Dino
  const btns = await page.$$('button');
  for (const b of btns) {
    const text = await page.evaluate(el => el.textContent, b);
    if (text && text.includes('Try Dino')) {
      await b.click();
      break;
    }
  }
  await new Promise(r => setTimeout(r, 1200));

  // Screenshot phosphor blue OLED screen
  const oledBezel = await page.$('div.rounded-\\[12px\\]');
  if (oledBezel) {
    await oledBezel.screenshot({ path: path.join(artifactDir, 'oled_phosphor_blue.png') });
    console.log('Saved oled_phosphor_blue.png');
  }

  // 2. Test Scale 4x button (confirm it is enabled, clickable, and grows canvas)
  console.log('\n--- TESTING 4X SCALE BUTTON ---');
  const scale4xResult = await page.evaluate(() => {
    const buttons = Array.from(document.querySelectorAll('div.flex.items-center.gap-1.p-0\\.5 button'));
    const btn4x = buttons.find(b => b.textContent.trim() === '4×');
    if (!btn4x) return { error: '4x button not found' };
    const wasDisabled = btn4x.disabled;
    btn4x.click();
    return {
      wasDisabled,
      className: btn4x.className
    };
  });
  console.log('4x button click result:', scale4xResult);
  await new Promise(r => setTimeout(r, 400));

  const metrics4x = await page.evaluate(() => {
    const canvas = document.querySelector('canvas.oled-screen');
    const caption = document.querySelectorAll('p.text-\\[11px\\].text-\\[var\\(--hw-text-secondary\\)\\]')[1]?.textContent;
    return {
      caption,
      canvasRect: canvas ? { width: canvas.getBoundingClientRect().width, height: canvas.getBoundingClientRect().height } : null
    };
  });
  console.log('4x metrics:', metrics4x);

  if (oledBezel) {
    await oledBezel.screenshot({ path: path.join(artifactDir, 'oled_4x_state.png') });
    console.log('Saved oled_4x_state.png');
  }

  // Switch back to 1x for standard view
  await page.evaluate(() => {
    const buttons = Array.from(document.querySelectorAll('div.flex.items-center.gap-1.p-0\\.5 button'));
    buttons.find(b => b.textContent.trim() === '1×')?.click();
  });
  await new Promise(r => setTimeout(r, 300));

  // 3. Test Full Preview scrubber drag
  console.log('\n--- TESTING FULL PREVIEW SCRUBBER DRAG ---');
  const fullScrubber = await page.$('section div.cursor-pointer.group');
  if (fullScrubber) {
    const box = await fullScrubber.boundingBox();
    if (box) {
      // Drag to 60% of width
      await page.mouse.move(box.x + 10, box.y + box.height / 2);
      await page.mouse.down();
      await page.mouse.move(box.x + box.width * 0.6, box.y + box.height / 2, { steps: 5 });
      await page.mouse.up();
      await new Promise(r => setTimeout(r, 200));

      const frameAfterDrag = await page.evaluate(() => {
        const timecodeEl = document.querySelector('section div.text-\\[11px\\].font-mono');
        const orangeBar = document.querySelector('section div.cursor-pointer.group div.bg-\\[\\#FF5500\\]');
        return {
          timecode: timecodeEl?.textContent,
          barStyle: orangeBar?.getAttribute('style')
        };
      });
      console.log('Frame after dragging scrubber to 60%:', frameAfterDrag);
    }
  }

  // 4. Test Playback and Verify Real-time Playbar Movement
  console.log('\n--- TESTING REAL-TIME PLAYBACK ADVANCE ---');
  // Reset to 0 first
  const resetBtn = await page.$('aside[aria-label="Floating Transport Dock"] button[title*="origin"]');
  if (resetBtn) await resetBtn.click();
  await new Promise(r => setTimeout(r, 200));

  // Hit Space to play
  await page.keyboard.press('Space');
  await new Promise(r => setTimeout(r, 100));

  const playbackSamples = [];
  for (let i = 0; i < 6; i++) {
    await new Promise(r => setTimeout(r, 250));
    const sample = await page.evaluate(() => {
      const dockTime = document.querySelector('aside[aria-label="Floating Transport Dock"] div.border-x span')?.textContent;
      const dockScrubDot = document.querySelector('aside[aria-label="Floating Transport Dock"] div.rounded-full.bg-\\[\\#FAFAFA\\]');
      const fullScrubBar = document.querySelector('section div.cursor-pointer.group div.bg-\\[\\#FF5500\\]');
      return {
        dockTime,
        dockScrubLeft: dockScrubDot?.getAttribute('style'),
        fullScrubWidth: fullScrubBar?.getAttribute('style')
      };
    });
    playbackSamples.push(sample);
  }
  console.log('Playback real-time samples:');
  playbackSamples.forEach((s, idx) => console.log(`  Sample ${idx}:`, s));

  // 5. Test Hovering over Dock to activate Liquid Glass Specular Spotlight
  const dockEl = await page.$('aside[aria-label="Floating Transport Dock"]');
  if (dockEl) {
    const dockBox = await dockEl.boundingBox();
    if (dockBox) {
      await page.mouse.move(dockBox.x + dockBox.width * 0.4, dockBox.y + dockBox.height / 2);
      await new Promise(r => setTimeout(r, 300));
      await dockEl.screenshot({ path: path.join(artifactDir, 'dock_liquid_glass.png') });
      console.log('Saved dock_liquid_glass.png');
    }
  }

  await page.screenshot({ path: path.join(artifactDir, 'ui_playback_active.png') });
  console.log('Saved ui_playback_active.png');

  await browser.close();
}

run().catch(console.error);
