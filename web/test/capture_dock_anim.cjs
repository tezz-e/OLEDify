const puppeteer = require('puppeteer-core');

(async () => {
  const browser = await puppeteer.launch({
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });
  await page.goto('http://localhost:5173', { waitUntil: 'networkidle0' });

  // Start playback to capture dynamic island EQ + expanding pulse halo
  await page.keyboard.press('Space');
  await new Promise(r => setTimeout(r, 600));

  const dock = await page.$('aside[aria-label="Floating Transport Dock"]');
  if (dock) {
    await dock.screenshot({ path: 'C:/Users/manee/.gemini/antigravity/brain/e80ebf5e-f898-4a9f-aaaf-6c7d8373833b/dock_animated_active.png' });
  }
  await page.screenshot({ path: 'C:/Users/manee/.gemini/antigravity/brain/e80ebf5e-f898-4a9f-aaaf-6c7d8373833b/ui_animated_dock.png' });
  await browser.close();
  console.log('Dock animation screenshot saved.');
})();
