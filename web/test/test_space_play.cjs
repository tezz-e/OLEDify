const puppeteer = require('puppeteer-core');

const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

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

  // Load Dino
  const btns = await page.$$('button');
  for (const b of btns) {
    const text = await page.evaluate(el => el.textContent, b);
    if (text && text.includes('Try Dino')) {
      await b.click();
      break;
    }
  }
  await new Promise(r => setTimeout(r, 1000));

  console.log('--- TESTING PLAYBACK WITH SPACE KEY ---');
  await page.keyboard.press('Space');
  await new Promise(r => setTimeout(r, 100));

  for (let i = 0; i < 5; i++) {
    await new Promise(r => setTimeout(r, 300));
    const state = await page.evaluate(() => {
      const scrubInput = document.querySelector('input.transport-scrub-input');
      const scrubDot = document.querySelector('aside[aria-label="Floating Transport Dock"] div.rounded-full.bg-\\[\\#FAFAFA\\]');
      const timecodeText = document.querySelector('aside[aria-label="Floating Transport Dock"] div.border-x span.text-\\[\\#FAFAFA\\]')?.textContent;
      const playBtn = document.querySelector('aside[aria-label="Floating Transport Dock"] button[title*="Space"]');
      
      return {
        playTitle: playBtn?.getAttribute('title'),
        scrubVal: scrubInput?.value,
        scrubDotLeft: scrubDot?.getAttribute('style'),
        timecodeText
      };
    });
    console.log(`Poll ${i}:`, state);
  }

  await browser.close();
}

run().catch(console.error);
