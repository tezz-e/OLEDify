import { chromium } from 'playwright';

async function run() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 960 } });
  const page = await context.newPage();

  console.log('Navigating to http://localhost:5173 ...');
  await page.goto('http://localhost:5173', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2000);

  console.log('Setting initial dark theme and reloading...');
  await page.evaluate(() => {
    localStorage.setItem('oled_studio_theme', 'dark');
    document.documentElement.setAttribute('data-theme', 'dark');
    document.documentElement.classList.add('dark');
  });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1500);

  // Capture Dark mode
  await page.screenshot({ path: 'D:/espprojects/oled/theme_verify_1_dark.png' });
  console.log('Saved theme_verify_1_dark.png');

  // Find theme toggle button in main header
  const themeToggle = page.locator('header').first().locator('button[role="switch"]');
  console.log('Clicking ThemeToggle switch in main header to switch to light mode...');
  await themeToggle.click();
  await page.waitForTimeout(1000);

  const lightThemeAttr = await page.evaluate(() => document.documentElement.getAttribute('data-theme'));
  console.log('Theme after toggle:', lightThemeAttr);

  // Capture Light mode (empty state)
  await page.screenshot({ path: 'D:/espprojects/oled/theme_verify_2_light_empty.png' });
  console.log('Saved theme_verify_2_light_empty.png');

  // Load sample media in Light mode
  console.log('Clicking Try Dino in Light mode...');
  const dinoBtn = page.getByRole('button', { name: /Try Dino/i });
  await dinoBtn.click({ timeout: 5000 });
  await page.waitForTimeout(1500);

  // Capture Light mode (active media state)
  await page.screenshot({ path: 'D:/espprojects/oled/theme_verify_3_light_active.png' });
  console.log('Saved theme_verify_3_light_active.png');

  // Toggle back to Dark mode
  console.log('Toggling back to dark mode...');
  await themeToggle.click();
  await page.waitForTimeout(1000);
  const backToDark = await page.evaluate(() => document.documentElement.getAttribute('data-theme'));
  console.log('Theme after second toggle:', backToDark);

  await browser.close();
  console.log('Theme test complete!');
}

run().catch(err => {
  console.error('Test error:', err);
  process.exit(1);
});
