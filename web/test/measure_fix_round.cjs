const puppeteer = require('puppeteer-core');
const path = require('path');
const fs = require('fs');

const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const artifactDir = 'C:\\Users\\manee\\.gemini\\antigravity\\brain\\e80ebf5e-f898-4a9f-aaaf-6c7d8373833b';

const viewports = [
  { width: 1280, height: 720 },
  { width: 1536, height: 730 },
  { width: 1440, height: 900 },
  { width: 1920, height: 1080 }
];

const scales = ['1x', '2x', '4x', 'Fit'];

async function run() {
  console.log('=== STARTING FIX ROUND VERIFICATION ===');
  const browser = await puppeteer.launch({
    executablePath: chromePath,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();

  // -------------------------------------------------------------
  // TASK 4 VERIFICATION: SVG illustration vs Floating Transport Dock Overlap
  // -------------------------------------------------------------
  console.log('\n--- TASK 4: Timeline illustration vs Transport Dock (Empty state) ---');
  const task4Results = [];

  for (const vp of viewports) {
    await page.setViewport({ width: vp.width, height: vp.height, deviceScaleFactor: 1 });
    await page.goto('http://localhost:5173', { waitUntil: 'networkidle0' });
    await new Promise(r => setTimeout(r, 600));

    const res = await page.evaluate(() => {
      const svg = document.querySelector('div[data-hairline="oled-bench"] svg');
      const dock = document.querySelector('aside[aria-label="Floating Transport Dock"]');
      const statusLine = document.querySelector('div[data-hairline="oled-bench"]')?.parentElement?.parentElement?.querySelector('span[class*="text-[11px]"]');

      if (!svg || !dock) return { error: 'SVG or Dock not found', svgFound: !!svg, dockFound: !!dock };

      const sR = svg.getBoundingClientRect();
      const dR = dock.getBoundingClientRect();

      // Check overlap
      const overlap = !(
        sR.right < dR.left ||
        sR.left > dR.right ||
        sR.bottom < dR.top ||
        sR.top > dR.bottom
      );

      const statusVisible = statusLine ? (statusLine.getBoundingClientRect().height > 0 && statusLine.getBoundingClientRect().width > 0) : false;

      return {
        svgRect: { top: Math.round(sR.top), bottom: Math.round(sR.bottom), left: Math.round(sR.left), right: Math.round(sR.right), height: Math.round(sR.height) },
        dockRect: { top: Math.round(dR.top), bottom: Math.round(dR.bottom), left: Math.round(dR.left), right: Math.round(dR.right), height: Math.round(dR.height) },
        overlap,
        statusVisible
      };
    });

    task4Results.push({
      viewport: `${vp.width}x${vp.height}`,
      svgBottom: res.svgRect?.bottom,
      dockTop: res.dockRect?.top,
      gap: (res.dockRect?.top - res.svgRect?.bottom),
      overlap: res.overlap,
      statusVisible: res.statusVisible
    });
  }

  console.table(task4Results);

  // -------------------------------------------------------------
  // TASK 1 VERIFICATION: Scale toggle must never get clipped
  // -------------------------------------------------------------
  console.log('\n--- TASK 1: Scale toggle clipping check across viewports, states & scales ---');
  const task1Results = [];

  for (const vp of viewports) {
    for (const state of ['empty', 'loaded']) {
      await page.setViewport({ width: vp.width, height: vp.height, deviceScaleFactor: 1 });
      await page.goto('http://localhost:5173', { waitUntil: 'networkidle0' });
      await new Promise(r => setTimeout(r, 600));

      if (state === 'loaded') {
        // Load dino
        await page.evaluate(() => {
          const btns = Array.from(document.querySelectorAll('button'));
          const b = btns.find(x => x.textContent.includes('Try Dino'));
          if (b) b.click();
        });
        await new Promise(r => setTimeout(r, 800));
      }

      for (const scale of scales) {
        // Click scale button if not already active
        await page.evaluate((targetScale) => {
          const label = targetScale === 'Fit' ? 'Fit' : targetScale.replace('x', '×');
          const btns = Array.from(document.querySelectorAll('button'));
          const btn = btns.find(b => b.textContent.trim() === label);
          if (btn && !btn.disabled) {
            btn.click();
          }
        }, scale);
        await new Promise(r => setTimeout(r, 300));

        const metrics = await page.evaluate(() => {
          const stage = document.querySelector('section');
          const oledPaneHeader = Array.from(document.querySelectorAll('h3')).find(h => h.textContent.includes('OLED preview'))?.parentElement;
          const frame = document.querySelector('div[class*="rounded-[12px]"][class*="border"]');
          const toggle = Array.from(document.querySelectorAll('button')).find(b => b.textContent.trim() === 'Fit')?.parentElement;
          const dropZone = document.querySelector('label[class*="border-dashed"]');

          if (!stage || !oledPaneHeader || !frame || !toggle) {
            return { error: 'elements not found', stage: !!stage, header: !!oledPaneHeader, frame: !!frame, toggle: !!toggle };
          }

          const sR = stage.getBoundingClientRect();
          const cR = oledPaneHeader.getBoundingClientRect();
          const fR = frame.getBoundingClientRect();
          const tR = toggle.getBoundingClientRect();
          const dR = dropZone ? dropZone.getBoundingClientRect() : null;

          // Inside stage rect check (with 1px tolerance)
          const captionInside = cR.top >= sR.top - 1 && cR.bottom <= sR.bottom + 1 && cR.left >= sR.left - 1 && cR.right <= sR.right + 1;
          const toggleInside = tR.top >= sR.top - 1 && tR.bottom <= sR.bottom + 1 && tR.left >= sR.left - 1 && tR.right <= sR.right + 1;

          // Non-overlapping check
          const noCaptionFrameOverlap = cR.bottom <= fR.top + 1;
          const noToggleFrameOverlap = tR.top >= fR.bottom - 1;
          
          let noDropZoneOverlap = true;
          if (dR) {
            // Horizontal separation check: dropZone is in Pane 1, frame and toggle are in Pane 2
            const horizSeparated = dR.right <= fR.left + 1 && dR.right <= tR.left + 1;
            noDropZoneOverlap = horizSeparated;
          }

          const allValid = captionInside && toggleInside && noCaptionFrameOverlap && noToggleFrameOverlap && noDropZoneOverlap;

          return {
            captionRect: { top: Math.round(cR.top), bottom: Math.round(cR.bottom), height: Math.round(cR.height) },
            toggleRect: { top: Math.round(tR.top), bottom: Math.round(tR.bottom), height: Math.round(tR.height) },
            frameRect: { top: Math.round(fR.top), bottom: Math.round(fR.bottom), height: Math.round(fR.height) },
            stageRect: { top: Math.round(sR.top), bottom: Math.round(sR.bottom), height: Math.round(sR.height) },
            allValid
          };
        });

        task1Results.push({
          viewport: `${vp.width}x${vp.height}`,
          state,
          scale,
          captionTop: metrics.captionRect?.top,
          captionBottom: metrics.captionRect?.bottom,
          frameTop: metrics.frameRect?.top,
          frameBottom: metrics.frameRect?.bottom,
          toggleTop: metrics.toggleRect?.top,
          toggleBottom: metrics.toggleRect?.bottom,
          stageBottom: metrics.stageRect?.bottom,
          allValid: metrics.allValid
        });
      }
    }
  }

  console.table(task1Results);

  // -------------------------------------------------------------
  // TASK 2 VERIFICATION: Full preview video canvas vs OLED screen canvas
  // -------------------------------------------------------------
  console.log('\n--- TASK 2: Full preview video element vs OLED screen canvas (Loaded Dino) ---');
  const task2Results = [];

  for (const vp of [ { width: 1440, height: 900 }, { width: 1536, height: 730 } ]) {
    await page.setViewport({ width: vp.width, height: vp.height, deviceScaleFactor: 1 });
    await page.goto('http://localhost:5173', { waitUntil: 'networkidle0' });
    await new Promise(r => setTimeout(r, 600));

    // Load dino
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const b = btns.find(x => x.textContent.includes('Try Dino'));
      if (b) b.click();
    });
    await new Promise(r => setTimeout(r, 800));

    // Default scale is 1x for OLED
    for (const testScale of ['1x', '2x']) {
      await page.evaluate((targetScale) => {
        const label = targetScale.replace('x', '×');
        const btns = Array.from(document.querySelectorAll('button'));
        const btn = btns.find(b => b.textContent.trim() === label);
        if (btn && !btn.disabled) {
          btn.click();
        }
      }, testScale);
      await new Promise(r => setTimeout(r, 300));

      const rects = await page.evaluate(() => {
        // Full preview canvas
        const fullCanvas = document.querySelector('div[class*="overflow-auto"] canvas');
        // OLED canvas
        const oledCanvas = document.querySelector('canvas.oled-screen');

        if (!fullCanvas || !oledCanvas) {
          return { error: 'canvases not found', fullCanvas: !!fullCanvas, oledCanvas: !!oledCanvas };
        }

        const vR = fullCanvas.getBoundingClientRect();
        const oR = oledCanvas.getBoundingClientRect();

        const videoArea = Math.round(vR.width * vR.height);
        const oledArea = Math.round(oR.width * oR.height);
        const ratio = (videoArea / oledArea).toFixed(2);

        return {
          videoRect: { width: Math.round(vR.width), height: Math.round(vR.height), area: videoArea },
          oledRect: { width: Math.round(oR.width), height: Math.round(oR.height), area: oledArea },
          ratio: parseFloat(ratio),
          areaGte1_5: videoArea >= 1.5 * oledArea
        };
      });

      task2Results.push({
        viewport: `${vp.width}x${vp.height}`,
        oledScale: testScale,
        videoW: rects.videoRect?.width,
        videoH: rects.videoRect?.height,
        videoArea: rects.videoRect?.area,
        oledW: rects.oledRect?.width,
        oledH: rects.oledRect?.height,
        oledArea: rects.oledRect?.area,
        ratio: `${rects.ratio}x`,
        passesCriterion: rects.areaGte1_5
      });
    }
  }

  console.table(task2Results);

  // Take visual screenshots for artifacts
  await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1 });
  await page.goto('http://localhost:5173', { waitUntil: 'networkidle0' });
  await page.screenshot({ path: path.join(artifactDir, 'fix_empty_1440x900.png') });

  // Load Dino
  await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    const b = btns.find(x => x.textContent.includes('Try Dino'));
    if (b) b.click();
  });
  await new Promise(r => setTimeout(r, 1000));
  await page.screenshot({ path: path.join(artifactDir, 'fix_loaded_1440x900.png') });

  // 1536x730
  await page.setViewport({ width: 1536, height: 730, deviceScaleFactor: 1 });
  await page.screenshot({ path: path.join(artifactDir, 'fix_loaded_1536x730.png') });

  // 1280x720
  await page.setViewport({ width: 1280, height: 720, deviceScaleFactor: 1 });
  await page.screenshot({ path: path.join(artifactDir, 'fix_loaded_1280x720.png') });

  await browser.close();
  console.log('=== VERIFICATION COMPLETE ===');
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
