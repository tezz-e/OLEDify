import { chromium } from 'playwright';

async function run() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 960 } });
  const page = await context.newPage();

  console.log('Navigating to http://localhost:5173 ...');
  await page.goto('http://localhost:5173', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2000);

  // 1. Load Dino media first
  console.log('Loading Try Dino sample media...');
  const dinoBtn = page.getByRole('button', { name: /Try Dino/i });
  await dinoBtn.click({ timeout: 5000 });
  await page.waitForTimeout(2000);
  await page.screenshot({ path: 'D:/espprojects/oled/screenshot_1_dino_active.png' });
  console.log('Saved screenshot_1_dino_active.png');

  // 2. Open Inspect Kernel deck
  console.log('Clicking Inspect Kernel...');
  const inspectBtn = page.getByRole('button', { name: /Inspect Kernel/i });
  await inspectBtn.click({ timeout: 5000 });
  await page.waitForTimeout(600);
  await page.screenshot({ path: 'D:/espprojects/oled/screenshot_2_atkinson_kernel.png' });
  console.log('Saved screenshot_2_atkinson_kernel.png');

  // 3. Switch to Bayer 4x4 matrix
  console.log('Switching to Bayer 4x4...');
  const bayerBtn = page.getByRole('button', { name: /Bayer 4×4/i });
  await bayerBtn.click({ timeout: 5000 });
  await page.waitForTimeout(600);
  await page.screenshot({ path: 'D:/espprojects/oled/screenshot_3_bayer4_kernel.png' });
  console.log('Saved screenshot_3_bayer4_kernel.png');

  // 4. Flip Invert Colors Toggle Switch
  console.log('Flipping Invert Colors mechanical toggle...');
  const invertBtn = page.getByTitle(/Toggle 1-bit monochrome polarity/i);
  await invertBtn.click({ timeout: 5000 });
  await page.waitForTimeout(600);
  await page.screenshot({ path: 'D:/espprojects/oled/screenshot_4_inverted_colors.png' });
  console.log('Saved screenshot_4_inverted_colors.png');

  await browser.close();
  console.log('Test run successfully completed!');
}

run().catch((err) => {
  console.error('Test run failed:', err);
  process.exit(1);
});
