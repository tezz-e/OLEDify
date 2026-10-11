const puppeteer = require('puppeteer-core');
const path = require('path');

const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const artifactDir = 'C:\\Users\\manee\\.gemini\\antigravity\\brain\\e80ebf5e-f898-4a9f-aaaf-6c7d8373833b';

async function main() {
  console.log('--- Running Complete Stage and Visual Verification Suite ---');
  const browser = await puppeteer.launch({
    executablePath: chromePath,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();

  // 1. EMPTY STATE RESPONSIVENESS AT 1280x720, 1440x900, 1920x1080
  const viewports = [
    { width: 1280, height: 720, name: 'empty_state_1280x720.png' },
    { width: 1440, height: 900, name: 'empty_state_1440x900.png' },
    { width: 1920, height: 1080, name: 'empty_state_1920x1080.png' }
  ];

  for (const vp of viewports) {
    await page.setViewport({ width: vp.width, height: vp.height, deviceScaleFactor: 1 });
    await page.goto('http://localhost:5173', { waitUntil: 'networkidle0' });
    await new Promise(r => setTimeout(r, 800));

    const dropZoneRect = await page.evaluate(() => {
      const el = document.querySelector('label[class*="border-dashed"]');
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { top: Math.round(r.top), bottom: Math.round(r.bottom), height: Math.round(r.height), windowH: window.innerHeight };
    });
    console.log(`Viewport ${vp.width}x${vp.height} DropZone bounding box:`, dropZoneRect);
    await page.screenshot({ path: path.join(artifactDir, vp.name) });
    console.log(`Saved screenshot: ${vp.name}`);
  }

  // 2. LOAD DINO AT 1440x900
  await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1 });
  await page.goto('http://localhost:5173', { waitUntil: 'networkidle0' });
  await new Promise(r => setTimeout(r, 800));

  console.log('Loading Dino sample...');
  await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    const b = btns.find(x => x.textContent.includes('Try Dino'));
    if (b) b.click();
  });
  await new Promise(r => setTimeout(r, 1200));

  // 3. CAPTURE BENCH THIN STRIP (showing persistent hardware pipeline above clips)
  await page.screenshot({ path: path.join(artifactDir, 'bench_thin_strip.png') });
  console.log('Saved screenshot: bench_thin_strip.png');

  // 4. CAPTURE LOADED STATE AT 1X, 2X, 4X, FIT
  await page.screenshot({ path: path.join(artifactDir, 'loaded_state_1x.png') });
  console.log('Saved screenshot: loaded_state_1x.png');

  // 2x
  await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    const b = btns.find(x => x.textContent.trim() === '2×');
    if (b) b.click();
  });
  await new Promise(r => setTimeout(r, 400));
  await page.screenshot({ path: path.join(artifactDir, 'loaded_state_2x.png') });
  console.log('Saved screenshot: loaded_state_2x.png');

  // 4x
  await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    const b = btns.find(x => x.textContent.trim() === '4×');
    if (b) b.click();
  });
  await new Promise(r => setTimeout(r, 400));
  await page.screenshot({ path: path.join(artifactDir, 'loaded_state_4x.png') });
  console.log('Saved screenshot: loaded_state_4x.png');

  // Fit
  await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    const b = btns.find(x => x.textContent.trim() === 'Fit');
    if (b) b.click();
  });
  await new Promise(r => setTimeout(r, 400));
  await page.screenshot({ path: path.join(artifactDir, 'loaded_state_fit.png') });
  console.log('Saved screenshot: loaded_state_fit.png');

  // Reset to 1x for modal captures
  await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    const b = btns.find(x => x.textContent.trim() === '1×');
    if (b) b.click();
  });
  await new Promise(r => setTimeout(r, 300));

  // 5. OPEN SETTINGS MODAL
  console.log('Opening Settings Modal...');
  await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    const settingsBtn = btns.find(b => b.title === 'Hardware & Settings' || b.getAttribute('aria-label') === 'Settings');
    if (settingsBtn) settingsBtn.click();
  });
  await new Promise(r => setTimeout(r, 600));
  await page.screenshot({ path: path.join(artifactDir, 'phase3_settings_modal.png') });
  console.log('Saved screenshot: phase3_settings_modal.png');

  // Close Settings Modal
  await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    const closeBtn = btns.find(b => b.textContent.includes('Close') || b.textContent.includes('Cancel') || b.querySelector('svg.lucide-x'));
    if (closeBtn) closeBtn.click();
  });
  await new Promise(r => setTimeout(r, 400));

  // 6. OPEN EXPORT MODAL (Compile)
  console.log('Opening Export Modal (Compile)...');
  await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    const compileBtn = btns.find(b => b.textContent.includes('Compile') || b.textContent.includes('Export'));
    if (compileBtn) compileBtn.click();
  });
  await new Promise(r => setTimeout(r, 1200));
  await page.screenshot({ path: path.join(artifactDir, 'phase3_export_modal.png') });
  console.log('Saved screenshot: phase3_export_modal.png');

  await browser.close();
  console.log('--- Verification Suite Finished Successfully! ---');
}

main().catch(err => {
  console.error('Error during suite execution:', err);
  process.exit(1);
});
