import { chromium } from 'playwright';

async function run() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 960 } });
  const page = await context.newPage();

  console.log('Navigating to http://localhost:5173 ...');
  await page.goto('http://localhost:5173', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2000);

  // 1. Capture flat assembled cassette with NO labels
  await page.screenshot({ path: 'D:/espprojects/oled/verify_1_flat_cassette_no_labels.png' });
  console.log('Saved verify_1_flat_cassette_no_labels.png');

  // 2. Load Dino media
  console.log('Loading Try Dino sample media...');
  const dinoBtn = page.getByRole('button', { name: /Try Dino/i });
  await dinoBtn.click({ timeout: 5000 });
  await page.waitForTimeout(1500);

  // 3. Test sliding gooey segmented control on Dither Algorithm
  console.log('Sliding gooey selector across algorithms...');
  const algoContainer = page.locator('[data-gooey="true"]').first();
  const box = await algoContainer.boundingBox();
  if (box) {
    // Click & drag smoothly across from left to right
    await page.mouse.move(box.x + box.width * 0.1, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width * 0.65, box.y + box.height / 2, { steps: 10 });
    await page.waitForTimeout(300);
    await page.screenshot({ path: 'D:/espprojects/oled/verify_2_gooey_slider_dragging.png' });
    console.log('Saved verify_2_gooey_slider_dragging.png');
    await page.mouse.up();
    await page.waitForTimeout(400);
  }

  // 4. Test Bicubic Smoothing metal toggle switch
  console.log('Flipping Bicubic Smoothing toggle...');
  const smoothingBtn = page.getByTitle(/Toggle bicubic interpolation filter/i);
  await smoothingBtn.click({ timeout: 5000 });
  await page.waitForTimeout(600);
  await page.screenshot({ path: 'D:/espprojects/oled/verify_3_bicubic_smoothing_toggle.png' });
  console.log('Saved verify_3_bicubic_smoothing_toggle.png');

  await browser.close();
  console.log('Final verification completed!');
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
