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

  console.log('--- TESTING PLAYBACK ADVANCE ---');
  // Click Play button
  const playBtn = await page.$('aside[aria-label="Floating Transport Dock"] button[title*="Play"], aside[aria-label="Floating Transport Dock"] button:nth-child(2)');
  console.log('Play button found:', !!playBtn);
  if (playBtn) {
    await playBtn.click();
  }

  // Poll 10 times over 2 seconds
  for (let i = 0; i < 10; i++) {
    await new Promise(r => setTimeout(r, 200));
    const state = await page.evaluate(() => {
      const dockTime = document.querySelector('aside[aria-label="Floating Transport Dock"]')?.textContent;
      const scrubInput = document.querySelector('input.transport-scrub-input');
      const scrubBar = document.querySelector('aside[aria-label="Floating Transport Dock"] div.bg-\\[\\#FF5500\\].rounded-full');
      const fullPreviewScrub = document.querySelector('section div.bg-\\[\\#FF5500\\]');
      const timelinePlayhead = document.querySelector('div[style*="left:"]');
      
      return {
        dockTime: dockTime?.slice(0, 30),
        scrubVal: scrubInput?.value,
        scrubBarWidth: scrubBar?.getAttribute('style'),
        fullPreviewScrubWidth: fullPreviewScrub?.getAttribute('style')
      };
    });
    console.log(`Poll ${i}:`, state);
  }

  await browser.close();
}

run().catch(console.error);
