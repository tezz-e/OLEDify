const puppeteer = require('puppeteer-core');

const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

async function run() {
  const browser = await puppeteer.launch({
    executablePath: chromePath,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 720, deviceScaleFactor: 1 });
  await page.goto('http://localhost:5173', { waitUntil: 'networkidle0' });
  await new Promise(r => setTimeout(r, 800));

  console.log('=== MEASURING 1280x720 SCALE ACCEPTANCE (EMPTY STATE) ===');
  let metricsEmpty = await measureStageMetrics(page);
  console.log(JSON.stringify(metricsEmpty, null, 2));

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

  console.log('\n=== MEASURING 1280x720 SCALE ACCEPTANCE (LOADED STATE) ===');
  let metricsLoaded = await measureStageMetrics(page);
  console.log(JSON.stringify(metricsLoaded, null, 2));

  console.log('\n=== TESTING BUTTON CLICKS FOR EACH SCALE AT 1280x720 ===');
  for (const scaleLabel of ['1×', '2×', '4×', 'Fit']) {
    console.log(`\n--- Attempting to click ${scaleLabel} ---`);
    const clickResult = await page.evaluate((targetLabel) => {
      const toggleContainer = document.querySelector('div.flex.items-center.gap-1.p-0\\.5');
      if (!toggleContainer) return { error: 'Toggle container not found' };
      const buttons = Array.from(toggleContainer.querySelectorAll('button'));
      const btn = buttons.find(b => b.textContent.trim() === targetLabel);
      if (!btn) return { error: `Button ${targetLabel} not found` };
      
      const wasDisabled = btn.disabled;
      if (!wasDisabled) {
        btn.click();
      }
      return {
        targetLabel,
        disabled: wasDisabled,
        title: btn.getAttribute('title')
      };
    }, scaleLabel);
    console.log('Click result:', clickResult);
    await new Promise(r => setTimeout(r, 300));

    const postMetrics = await measureStageMetrics(page);
    console.log(`Canvas rect after clicking ${scaleLabel}:`, postMetrics.canvasRect);
    console.log(`Selected button:`, postMetrics.buttonStates.find(b => b.selected)?.label);
  }

  // Also test at 1536x730 to confirm 2x click measurably changes canvas when enabled!
  console.log('\n=== TESTING 1536x730 TO CONFIRM 2x CLICK VISIBLY CHANGES CANVAS ===');
  await page.setViewport({ width: 1536, height: 730, deviceScaleFactor: 1 });
  await new Promise(r => setTimeout(r, 500));
  
  // Click 1x
  await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('div.flex.items-center.gap-1.p-0\\.5 button'));
    btns.find(b => b.textContent.trim() === '1×')?.click();
  });
  await new Promise(r => setTimeout(r, 300));
  let m1x = await measureStageMetrics(page);
  console.log('1536x730 at 1x - Canvas rect:', m1x.canvasRect, 'Selected:', m1x.buttonStates.find(b => b.selected)?.label);

  // Click 2x
  await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('div.flex.items-center.gap-1.p-0\\.5 button'));
    btns.find(b => b.textContent.trim() === '2×')?.click();
  });
  await new Promise(r => setTimeout(r, 300));
  let m2x = await measureStageMetrics(page);
  console.log('1536x730 at 2x - Canvas rect:', m2x.canvasRect, 'Selected:', m2x.buttonStates.find(b => b.selected)?.label);

  await browser.close();
}

async function measureStageMetrics(page) {
  return await page.evaluate(() => {
    const frameArea = document.querySelector('div[class*="flex-1 min-h-0 min-w-0 flex items-center justify-center"]');
    const canvas = document.querySelector('canvas.oled-screen');
    const toggleContainer = document.querySelector('div.flex.items-center.gap-1.p-0\\.5');
    const headerTitle = document.querySelector('h3.font-sans.font-semibold.text-xs.tracking-tight');
    const captionEl = document.querySelectorAll('p.text-\\[11px\\].text-\\[var\\(--hw-text-secondary\\)\\]')[1] || document.querySelector('div.text-center.mb-2 p');

    const buttons = toggleContainer ? Array.from(toggleContainer.querySelectorAll('button')).map(b => ({
      label: b.textContent.trim(),
      disabled: b.disabled,
      selected: b.className.includes('bg-white/10'),
      title: b.getAttribute('title')
    })) : [];

    const cR = canvas ? canvas.getBoundingClientRect() : null;
    const fR = frameArea ? frameArea.getBoundingClientRect() : null;

    return {
      frameAreaClientHeight: frameArea ? frameArea.clientHeight : null,
      frameAreaRect: fR ? { top: Math.round(fR.top), bottom: Math.round(fR.bottom), height: Math.round(fR.height), width: Math.round(fR.width) } : null,
      canvasRect: cR ? { top: Math.round(cR.top), bottom: Math.round(cR.bottom), width: Math.round(cR.width), height: Math.round(cR.height) } : null,
      buttonStates: buttons
    };
  });
}

run().catch(console.error);
