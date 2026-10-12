import { chromium } from 'playwright';

async function run() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 960 } });
  const page = await context.newPage();

  console.log('Navigating to http://localhost:5173 ...');
  await page.goto('http://localhost:5173', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2000);

  // Load Dino
  const dinoBtn = page.getByRole('button', { name: /Try Dino/i });
  await dinoBtn.click({ timeout: 5000 });
  await page.waitForTimeout(1500);

  // Click OLED SIMULATOR toggle
  console.log('Clicking OLED SIMULATOR...');
  const simBtn = page.getByRole('button', { name: /OLED SIMULATOR/i });
  if (await simBtn.isVisible()) {
    await simBtn.click();
    await page.waitForTimeout(1500);
  }

  // Click Play in transport dock
  console.log('Clicking Play...');
  const playBtn = page.getByRole('button', { name: /^Play$/i }).or(page.locator('button:has(svg.lucide-play)'));
  if (await playBtn.first().isVisible()) {
    await playBtn.first().click();
    await page.waitForTimeout(1000);
  }

  await page.screenshot({ path: 'D:/espprojects/oled/screenshot_5_simulator_playback.png' });
  console.log('Saved screenshot_5_simulator_playback.png');

  await browser.close();
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
