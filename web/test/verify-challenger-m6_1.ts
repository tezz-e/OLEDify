/**
 * Empirical Verification & Adversarial Stress Harness for M6 React Bits Integration
 * Challenger: challenger_m6_1 (Performance & Resource Challenger)
 * 
 * Verifies:
 * 1. Build artifacts & manual chunk separation (three, motion, index)
 * 2. LiquidEther WebGL lifecycle, event listeners, observers, RAF pause on hidden/unmount
 * 3. ClickSpark RAF loop behavior (expiration termination vs continuous loop)
 * 4. OptionWheel RAF settled termination & scroll listener cleanup
 * 5. Component count and aesthetic invariants
 */

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const WEB_DIR = path.resolve('D:/espprojects/oled/web');
const DIST_DIR = path.join(WEB_DIR, 'dist');
const ASSETS_DIR = path.join(DIST_DIR, 'assets');
const SRC_DIR = path.join(WEB_DIR, 'src');

console.log('================================================================');
console.log('  CHALLENGER M6_1 PERFORMANCE & RESOURCE VERIFICATION HARNESS  ');
console.log('================================================================\n');

let findings: { level: 'PASS' | 'WARN' | 'FAIL'; component: string; message: string }[] = [];

// -----------------------------------------------------------------------------
// Test 1: Bundle Analysis & manualChunks verification
// -----------------------------------------------------------------------------
console.log('--- Test 1: Bundle Analysis & manualChunks Verification ---');
{
  assert.ok(fs.existsSync(DIST_DIR), 'dist directory exists');
  assert.ok(fs.existsSync(ASSETS_DIR), 'dist/assets directory exists');

  const assetFiles = fs.readdirSync(ASSETS_DIR);
  
  const threeChunk = assetFiles.find(f => f.startsWith('three-') && f.endsWith('.js'));
  const motionChunk = assetFiles.find(f => f.startsWith('motion-') && f.endsWith('.js'));
  const indexChunk = assetFiles.find(f => f.startsWith('index-') && f.endsWith('.js'));

  console.log(`- Three chunk: ${threeChunk || 'NOT FOUND'}`);
  console.log(`- Motion chunk: ${motionChunk || 'NOT FOUND'}`);
  console.log(`- Index chunk: ${indexChunk || 'NOT FOUND'}`);

  assert.ok(threeChunk, 'Three chunk was successfully split out into vendor chunk');
  assert.ok(motionChunk, 'Motion chunk was successfully split out into vendor chunk');
  assert.ok(indexChunk, 'Index chunk exists');

  const threeSizeKb = fs.statSync(path.join(ASSETS_DIR, threeChunk)).size / 1024;
  const motionSizeKb = fs.statSync(path.join(ASSETS_DIR, motionChunk)).size / 1024;
  const indexSizeKb = fs.statSync(path.join(ASSETS_DIR, indexChunk)).size / 1024;

  console.log(`  three: ${threeSizeKb.toFixed(2)} KB`);
  console.log(`  motion: ${motionSizeKb.toFixed(2)} KB`);
  console.log(`  index: ${indexSizeKb.toFixed(2)} KB`);

  // Verify none exceeds Vite limit
  assert.ok(threeSizeKb < 1200, 'Three chunk under chunkSizeWarningLimit (1200 KB)');
  assert.ok(motionSizeKb < 1200, 'Motion chunk under chunkSizeWarningLimit (1200 KB)');
  assert.ok(indexSizeKb < 1200, 'Index chunk under chunkSizeWarningLimit (1200 KB)');

  // Verify that three.js code is in threeChunk and not bundled into indexChunk
  const threeContent = fs.readFileSync(path.join(ASSETS_DIR, threeChunk), 'utf-8');

  // Check for WebGLRenderer definition in three chunk
  assert.ok(threeContent.includes('WebGLRenderer'), 'WebGLRenderer is located in three chunk');
  
  findings.push({
    level: 'PASS',
    component: 'vite.config.ts / Build',
    message: `Chunks cleanly separated: three (${threeSizeKb.toFixed(1)} KB), motion (${motionSizeKb.toFixed(1)} KB), index (${indexSizeKb.toFixed(1)} KB). Zero warning threshold breaches.`
  });
}

// -----------------------------------------------------------------------------
// Test 2: LiquidEther WebGL Cleanup & Lifecycle
// -----------------------------------------------------------------------------
console.log('\n--- Test 2: LiquidEther WebGL Cleanup & Lifecycle ---');
{
  const liquidEtherPath = path.join(SRC_DIR, 'components/reactbits/LiquidEther.tsx');
  assert.ok(fs.existsSync(liquidEtherPath), 'LiquidEther.tsx exists');
  const src = fs.readFileSync(liquidEtherPath, 'utf-8');

  // Check renderer dispose & forceContextLoss
  const hasRendererDispose = src.includes('Common.renderer.dispose()');
  const hasForceContextLoss = src.includes('Common.renderer.forceContextLoss()');
  const hasCanvasRemoval = src.includes('canvas.parentNode.removeChild(canvas)');
  console.log(`- Renderer dispose present: ${hasRendererDispose}`);
  console.log(`- forceContextLoss present: ${hasForceContextLoss}`);
  console.log(`- Canvas DOM removal present: ${hasCanvasRemoval}`);
  assert.ok(hasRendererDispose && hasForceContextLoss && hasCanvasRemoval, 'Renderer cleanup releases context and removes DOM canvas');

  // Check event listeners cleanup
  const hasResizeRemove = src.includes("window.removeEventListener('resize', this._resize)");
  const hasVisibilityRemove = src.includes("document.removeEventListener('visibilitychange', this._onVisibility)");
  const hasMouseDispose = src.includes('Mouse.dispose()');
  console.log(`- Resize listener cleanup: ${hasResizeRemove}`);
  console.log(`- Visibility listener cleanup: ${hasVisibilityRemove}`);
  console.log(`- Mouse listeners cleanup: ${hasMouseDispose}`);
  assert.ok(hasResizeRemove && hasVisibilityRemove && hasMouseDispose, 'All window & document event listeners are cleaned up');

  // Check observers disconnect
  const hasRoDisconnect = src.includes('resizeObserverRef.current.disconnect()');
  const hasIoDisconnect = src.includes('intersectionObserverRef.current.disconnect()');
  console.log(`- ResizeObserver disconnect: ${hasRoDisconnect}`);
  console.log(`- IntersectionObserver disconnect: ${hasIoDisconnect}`);
  assert.ok(hasRoDisconnect && hasIoDisconnect, 'ResizeObserver and IntersectionObserver disconnect on unmount');

  // Check RAF loop pause on hidden tab
  const hasVisibilityPause = src.includes('if (document.hidden) {') && src.includes('this.pause()');
  console.log(`- Hidden tab RAF pause: ${hasVisibilityPause}`);
  assert.ok(hasVisibilityPause, 'LiquidEther pauses RAF rendering loop when tab is hidden');

  // Check IntersectionObserver pause when scrolled out
  const hasIoPause = src.includes('webglRef.current.pause()');
  console.log(`- Out-of-viewport RAF pause: ${hasIoPause}`);
  assert.ok(hasIoPause, 'LiquidEther pauses RAF rendering loop when out of viewport');

  // Check individual FBO dispose check
  const hasFboDispose = src.includes('.fbos[key]?.dispose()') || src.includes('this.fbos.vel_0.dispose');
  console.log(`- Explicit fbo.dispose() loop: ${hasFboDispose}`);
  if (!hasFboDispose) {
    findings.push({
      level: 'WARN',
      component: 'LiquidEther',
      message: 'FBO render targets rely on WebGLRenderer.forceContextLoss() and garbage collection rather than iterating this.fbos to call .dispose(). forceContextLoss() successfully frees GPU context, but explicit FBO disposal is recommended best practice.'
    });
  } else {
    findings.push({
      level: 'PASS',
      component: 'LiquidEther',
      message: 'Full WebGL context disposal, observer disconnects, event cleanup, and hidden-tab RAF pausing verified.'
    });
  }
}

// -----------------------------------------------------------------------------
// Test 3: ClickSpark Canvas Cleanup & RAF Loop Behavior
// -----------------------------------------------------------------------------
console.log('\n--- Test 3: ClickSpark Canvas Cleanup & RAF Loop Behavior ---');
{
  const clickSparkPath = path.join(SRC_DIR, 'components/reactbits/ClickSpark.tsx');
  assert.ok(fs.existsSync(clickSparkPath), 'ClickSpark.tsx exists');
  const src = fs.readFileSync(clickSparkPath, 'utf-8');

  // Check canvas 2D context
  const has2DContext = src.includes("canvas.getContext('2d')");
  console.log(`- 2D Canvas context: ${has2DContext}`);
  assert.ok(has2DContext, '2D Canvas context requested');

  // Check ResizeObserver cleanup
  const hasRoDisconnect = src.includes('ro.disconnect()');
  console.log(`- ResizeObserver cleanup: ${hasRoDisconnect}`);
  assert.ok(hasRoDisconnect, 'ResizeObserver disconnected in ClickSpark');

  // Check unmount cancellation
  const hasUnmountCancel = src.includes('cancelAnimationFrame(animationId)');
  console.log(`- Unmount RAF cancellation: ${hasUnmountCancel}`);
  assert.ok(hasUnmountCancel, 'cancelAnimationFrame called on unmount');

  // Adversarial Check: Does the RAF loop stop when all sparks expire?
  // In lines 94-131:
  // animationId = requestAnimationFrame(draw);
  // draw() { ... animationId = requestAnimationFrame(draw); }
  const drawMethodMatch = src.match(/const draw = \([\s\S]*?\};\s*animationId = requestAnimationFrame\(draw\);/);
  assert.ok(drawMethodMatch, 'draw loop found');

  const drawBody = drawMethodMatch[0];
  const hasConditionalRaf = drawBody.includes('if (sparksRef.current.length > 0)') || 
                           drawBody.includes('if (sparksRef.current.length === 0) return');

  console.log(`- Conditional RAF termination on particle expiration: ${hasConditionalRaf}`);

  if (!hasConditionalRaf) {
    findings.push({
      level: 'WARN',
      component: 'ClickSpark',
      message: 'ClickSpark runs a continuous requestAnimationFrame loop (calling clearRect every frame at 60/120Hz) even when sparksRef.current is empty (idle state). While cancelAnimationFrame runs on unmount, during normal idle mount it consumes unnecessary RAF CPU cycles.'
    });
  } else {
    findings.push({
      level: 'PASS',
      component: 'ClickSpark',
      message: 'ClickSpark properly sleeps RAF loop when sparks array is empty.'
    });
  }
}

// -----------------------------------------------------------------------------
// Test 4: OptionWheel RAF Settled Termination & Scroll Listener Cleanup
// -----------------------------------------------------------------------------
console.log('\n--- Test 4: OptionWheel RAF Settled & Listener Cleanup ---');
{
  const optionWheelPath = path.join(SRC_DIR, 'components/reactbits/OptionWheel.tsx');
  assert.ok(fs.existsSync(optionWheelPath), 'OptionWheel.tsx exists');
  const src = fs.readFileSync(optionWheelPath, 'utf-8');

  // Check settled termination
  const hasSettledCheck = src.includes('const settled = Math.abs(target - next) < 0.001');
  const hasSettledRafStop = src.includes('rafRef.current = settled ? null : requestAnimationFrame(runFrame)');
  console.log(`- Settled condition check: ${hasSettledCheck}`);
  console.log(`- RAF terminates when settled: ${hasSettledRafStop}`);
  assert.ok(hasSettledCheck && hasSettledRafStop, 'OptionWheel terminates RAF loop when animation settles');

  // Check unmount cancellation
  const hasUnmountCancel = src.includes('if (rafRef.current != null) cancelAnimationFrame(rafRef.current)');
  console.log(`- Unmount cancelAnimationFrame: ${hasUnmountCancel}`);
  assert.ok(hasUnmountCancel, 'OptionWheel cancels pending RAF on unmount');

  // Check wheel listener cleanup
  const hasWheelRemove = src.includes("el.removeEventListener('wheel', onWheel)");
  const hasTimerClear = src.includes('clearTimeout(wheelTimerRef.current)');
  console.log(`- Wheel event listener remove: ${hasWheelRemove}`);
  console.log(`- Wheel timer clear: ${hasTimerClear}`);
  assert.ok(hasWheelRemove && hasTimerClear, 'OptionWheel removes wheel listener and clears wheel timer');

  // Check audio pause
  const hasAudioPause = src.includes('audioRef.current?.pause()');
  console.log(`- Audio pause on unmount: ${hasAudioPause}`);
  assert.ok(hasAudioPause, 'OptionWheel pauses audio on unmount');

  findings.push({
    level: 'PASS',
    component: 'OptionWheel',
    message: 'OptionWheel correctly terminates RAF when settled, removes wheel listener from container, clears timers, and pauses audio.'
  });
}

// -----------------------------------------------------------------------------
// Test 5: Integration Audit & Aesthetic Conformance
// -----------------------------------------------------------------------------
console.log('\n--- Test 5: Integration Audit & Aesthetic Conformance ---');
{
  const appPath = path.join(SRC_DIR, 'App.tsx');
  const appSrc = fs.readFileSync(appPath, 'utf-8');

  const componentsUsed = [
    { name: 'LiquidEther', used: appSrc.includes('<LiquidEther') },
    { name: 'OptionWheel', used: fs.readFileSync(path.join(SRC_DIR, 'components/DitherControls.tsx'), 'utf-8').includes('<OptionWheel') },
    { name: 'ClickSpark', used: fs.readFileSync(path.join(SRC_DIR, 'components/Header.tsx'), 'utf-8').includes('<ClickSpark') },
    { name: 'DecryptedText', used: appSrc.includes('<DecryptedText') },
    { name: 'CountUp', used: appSrc.includes('<CountUp') },
    { name: 'GlassSurface', used: fs.readFileSync(path.join(SRC_DIR, 'components/ExportModal.tsx'), 'utf-8').includes('<GlassSurface') }
  ];

  console.log('React Bits Components in Active Use:');
  let activeCount = 0;
  for (const c of componentsUsed) {
    console.log(`  - ${c.name}: ${c.used ? 'ACTIVE' : 'NOT FOUND'}`);
    if (c.used) activeCount++;
  }
  assert.ok(activeCount >= 4, `At least 4 React Bits components active (found: ${activeCount})`);

  // Check Blueprint aesthetic: Sharp borders, font-mono, #1A1A1A, #E85D2A
  const indexCss = fs.readFileSync(path.join(SRC_DIR, 'index.css'), 'utf-8');
  assert.ok(indexCss.includes('font-family') && indexCss.includes('IBM Plex Mono'), 'IBM Plex Mono font specified');
  assert.ok(indexCss.includes('#1A1A1A'), 'Ink black #1A1A1A present');
  assert.ok(indexCss.includes('#E85D2A'), 'Accent orange #E85D2A present');

  findings.push({
    level: 'PASS',
    component: 'App Integration & Blueprint Aesthetic',
    message: `${activeCount} React Bits components verified active with IBM Plex Mono and sharp brutalist palette preserved.`
  });
}

console.log('\n================================================================');
console.log('                    VERIFICATION SUMMARY                        ');
console.log('================================================================');
for (const f of findings) {
  console.log(`[${f.level}] [${f.component}] ${f.message}`);
}

const hasFails = findings.some(f => f.level === 'FAIL');
console.log(`\nOVERALL VERDICT: ${hasFails ? 'REJECT' : 'APPROVE'}`);
process.exit(hasFails ? 1 : 0);
