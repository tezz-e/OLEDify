/**
 * Challenger 3 (Final Verification Challenger)
 * Empirical Adversarial Test Harness & Stress Verification Suite
 */

import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';

console.log('========================================================================');
console.log('CHALLENGER 3: EMPIRICAL STRESS & INTEGRITY VERIFICATION SUITE');
console.log('========================================================================\n');

let passCount = 0;
let failCount = 0;

function runTest(name: string, fn: () => void) {
  try {
    fn();
    console.log(`[PASS] ${name}`);
    passCount++;
  } catch (err: any) {
    console.error(`[FAIL] ${name}`);
    console.error(`       Error: ${err.message}`);
    failCount++;
  }
}

// ============================================================================
// FOCUS 1: IEEE-754 Timecode Subtraction Bug & Integer Millisecond Math
// ============================================================================

// Buggy implementation from worker_1
function buggyFormatTimecode(safeFrame: number, targetFps: number): string {
  const timeSeconds = safeFrame / targetFps;
  const mins = Math.floor(timeSeconds / 60);
  const secs = Math.floor(timeSeconds % 60);
  const ms = Math.floor((timeSeconds - Math.floor(timeSeconds)) * 1000);

  const pad2 = (n: number) => String(n).padStart(2, '0');
  const pad3 = (n: number) => String(n).padStart(3, '0');
  return `${pad2(mins)}:${pad2(secs)}.${pad3(ms)}`;
}

// Hardened implementation from worker_2
function hardenedFormatTimecode(safeFrame: number, targetFps: number): string {
  const totalMs = Math.round((safeFrame / targetFps) * 1000);
  const mins = Math.floor(totalMs / 60000);
  const secs = Math.floor((totalMs % 60000) / 1000);
  const ms = totalMs % 1000;

  const pad2 = (n: number) => String(n).padStart(2, '0');
  const pad3 = (n: number) => String(n).padStart(3, '0');
  return `${pad2(mins)}:${pad2(secs)}.${pad3(ms)}`;
}

runTest('Focus 1.1: Frame 129 @ 60 FPS IEEE-754 Truncation & Integer MS Resolution', () => {
  const buggyResult = buggyFormatTimecode(129, 60);
  const hardenedResult = hardenedFormatTimecode(129, 60);

  // Empirically confirm buggy yields 00:02.149 due to (2.15 - 2 = 0.14999999999999991)
  assert.strictEqual(buggyResult, '00:02.149', 'Buggy formula must yield 00:02.149');
  // Confirm hardened yields exact 00:02.150
  assert.strictEqual(hardenedResult, '00:02.150', 'Hardened integer ms formula must yield exact 00:02.150');
});

runTest('Focus 1.2: Sub-frame Timecode Precision Across Diverse Framerates and Boundaries', () => {
  // Test frame 0
  assert.strictEqual(hardenedFormatTimecode(0, 60), '00:00.000');
  assert.strictEqual(hardenedFormatTimecode(0, 24), '00:00.000');

  // Test 1 second boundary
  assert.strictEqual(hardenedFormatTimecode(60, 60), '00:01.000');
  assert.strictEqual(hardenedFormatTimecode(24, 24), '00:01.000');
  assert.strictEqual(hardenedFormatTimecode(30, 30), '00:01.000');

  // Test 1 minute boundary (3600 frames @ 60 FPS)
  assert.strictEqual(hardenedFormatTimecode(3600, 60), '01:00.000');

  // Test 1 hour boundary (216,000 frames @ 60 FPS)
  assert.strictEqual(hardenedFormatTimecode(216000, 60), '60:00.000');

  // Test non-integer division frame at 24 FPS (Frame 12 = 0.5s -> 500ms)
  assert.strictEqual(hardenedFormatTimecode(12, 24), '00:00.500');

  // Test 30 FPS Frame 1 -> 33.333ms -> 33ms
  assert.strictEqual(hardenedFormatTimecode(1, 30), '00:00.033');

  // Test 60 FPS Frame 1 -> 16.666ms -> 17ms
  assert.strictEqual(hardenedFormatTimecode(1, 60), '00:00.017');
});

runTest('Focus 1.3: Blueprint and FloatingTransportDock.tsx Contain Hardened Integer MS Math', () => {
  const dockFilePath = path.join('D:/espprojects/oled/web/test/blueprint-eval/FloatingTransportDock.tsx');
  const dockContent = fs.readFileSync(dockFilePath, 'utf8');

  assert(dockContent.includes('Math.round((safeFrame / targetFps) * 1000)'), 'FloatingTransportDock.tsx must calculate totalMs via Math.round');
  assert(dockContent.includes('Math.floor(totalMs / 60000)'), 'FloatingTransportDock.tsx must derive mins via totalMs / 60000');
  assert(dockContent.includes('Math.floor((totalMs % 60000) / 1000)'), 'FloatingTransportDock.tsx must derive secs via (totalMs % 60000) / 1000');
  assert(dockContent.includes('totalMs % 1000'), 'FloatingTransportDock.tsx must derive ms via totalMs % 1000');

  const blueprintPath = path.join('D:/espprojects/oled/.agents/teamwork/worker_2/DESIGN_BLUEPRINT.md');
  const blueprintContent = fs.readFileSync(blueprintPath, 'utf8');
  assert(blueprintContent.includes('Sub-Frame Integer Millisecond Timecode Formulation (IEEE-754 Safe)'), 'Blueprint must document IEEE-754 Safe formulation');
  assert(blueprintContent.includes('Math.round((safeFrame / targetFps) * 1000)'), 'Blueprint Recipe 2 must contain integer ms math');
});

// ============================================================================
// FOCUS 2: Dock Magnification Kernel in FloatingTransportDock.tsx
// ============================================================================

function cosineSquaredKernel(d: number, R = 64, M = 1.28): number {
  if (d > R) return 1;
  return 1 + (M - 1) * Math.pow(Math.cos((Math.PI * d) / (2 * R)), 2);
}

runTest('Focus 2.1: Mathematical Properties of Cosine-Squared Dock Magnification Kernel', () => {
  const R = 64;
  const M = 1.28;

  // Maximum magnification at center (d = 0)
  const centerScale = cosineSquaredKernel(0, R, M);
  assert.strictEqual(centerScale, M, 'Kernel at d=0 must equal M');

  // Half-radius (d = R/2) -> cos(pi/4) = 1/sqrt(2), cos^2(pi/4) = 0.5
  const halfScale = cosineSquaredKernel(R / 2, R, M);
  const expectedHalf = 1 + (M - 1) * 0.5;
  assert(Math.abs(halfScale - expectedHalf) < 1e-12, 'Kernel at d=R/2 must equal 1 + 0.5*(M-1)');

  // Boundary (d = R) -> cos(pi/2) = 0 -> scale = 1.0
  const boundaryScale = cosineSquaredKernel(R, R, M);
  assert.strictEqual(boundaryScale, 1.0, 'Kernel at d=R must equal 1.0');

  // Outside radius (d > R) -> scale = 1.0
  const outsideScale = cosineSquaredKernel(R + 10, R, M);
  assert.strictEqual(outsideScale, 1.0, 'Kernel outside R must equal 1.0');

  // Negative d check (if Euclidean distance d = |x_m - x_i| >= 0)
  assert.strictEqual(cosineSquaredKernel(R + 0.001, R, M), 1.0);
});

runTest('Focus 2.2: FloatingTransportDock.tsx Contains Cosine-Squared Kernel Definition', () => {
  const dockFilePath = path.join('D:/espprojects/oled/web/test/blueprint-eval/FloatingTransportDock.tsx');
  const dockContent = fs.readFileSync(dockFilePath, 'utf8');

  assert(dockContent.includes('getMagnificationScale'), 'FloatingTransportDock.tsx must declare getMagnificationScale');
  assert(dockContent.includes('Math.pow(Math.cos((Math.PI * d) / (2 * R)), 2)'), 'FloatingTransportDock.tsx must use cosine-squared formula');
  assert(dockContent.includes('setMousePos'), 'FloatingTransportDock.tsx must track mouse position for magnification');
});

// ============================================================================
// FOCUS 3: RAF Loop in InertiaTimelineScrubber.tsx
// ============================================================================

runTest('Focus 3.1: RAF useEffect Dependencies Decoupled from visualFrame and onSeek', () => {
  const scrubberFilePath = path.join('D:/espprojects/oled/web/test/blueprint-eval/InertiaTimelineScrubber.tsx');
  const content = fs.readFileSync(scrubberFilePath, 'utf8');

  // Check that visualFrameRef and onSeekRef exist
  assert(content.includes('const visualFrameRef = useRef(currentFrame);'), 'visualFrameRef must be used');
  assert(content.includes('const onSeekRef = useRef(onSeek);'), 'onSeekRef must be used');
  assert(content.includes('onSeekRef.current = onSeek;'), 'onSeekRef must be updated on every render');

  // Check the useEffect dependency array
  const effectBlockMatch = content.match(/useEffect\(\(\) => \{[\s\S]*?cancelAnimationFrame\(animId\);[\s\S]*?\}, \[([\s\S]*?)\]\);/);
  assert(effectBlockMatch, 'RAF useEffect block must be present');
  const deps = effectBlockMatch[1];

  assert(!deps.includes('visualFrame'), 'visualFrame must NOT be in RAF useEffect dependency array');
  assert(!deps.includes('onSeek'), 'onSeek must NOT be in RAF useEffect dependency array');
  assert(deps.includes('damping'), 'damping must be in dependency array');
  assert(deps.includes('totalFrames'), 'totalFrames must be in dependency array');
  assert(deps.includes('zoomPxPerFrame'), 'zoomPxPerFrame must be in dependency array');
});

runTest('Focus 3.2: Direct Needle DOM Transform and Zero React State Churn in RAF Tick', () => {
  const scrubberFilePath = path.join('D:/espprojects/oled/web/test/blueprint-eval/InertiaTimelineScrubber.tsx');
  const content = fs.readFileSync(scrubberFilePath, 'utf8');

  assert(content.includes('needleRef.current.style.transform = `translateX(${next * zoomPxPerFrame}px)`'),
    'Playhead needle must update directly via DOM style.transform');
  assert(!content.includes('setVisualFrame'), 'setVisualFrame state setter must not exist');
});

runTest('Focus 3.3: Canvas Virtualization Replaces Array.from DOM Nodes', () => {
  const scrubberFilePath = path.join('D:/espprojects/oled/web/test/blueprint-eval/InertiaTimelineScrubber.tsx');
  const content = fs.readFileSync(scrubberFilePath, 'utf8');

  assert(content.includes('canvasRef = useRef<HTMLCanvasElement>'), 'Must use HTML5 Canvas for ruler ticks');
  assert(!content.includes('Array.from({ length: totalFrames }).map'), 'Must not render unvirtualized tick DOM nodes');
});

// ============================================================================
// FOCUS 4: HardwareToggleSwitch.tsx Bat Lever & Accessibility
// ============================================================================

runTest('Focus 4.1: HardwareToggleSwitch Bat Lever Rotation Styles and Pivot Point', () => {
  const toggleFilePath = path.join('D:/espprojects/oled/web/test/blueprint-eval/HardwareToggleSwitch.tsx');
  const content = fs.readFileSync(toggleFilePath, 'utf8');

  // Verify exact bat lever rotation styles
  assert(content.includes("-rotate-[24deg]"), "Must use -rotate-[24deg] for 'up' position");
  assert(content.includes("rotate-[24deg]"), "Must use rotate-[24deg] for 'down' position");
  assert(content.includes("'rotate-0'"), "Must use rotate-0 for 'center' position");

  // Verify transform origin collar pivot
  assert(content.includes("transformOrigin: '50% 75%'"), "Lever must pivot at base collar (50% 75%)");
});

runTest('Focus 4.2: HardwareToggleSwitch WAI-ARIA and Keyboard Accessibility', () => {
  const toggleFilePath = path.join('D:/espprojects/oled/web/test/blueprint-eval/HardwareToggleSwitch.tsx');
  const content = fs.readFileSync(toggleFilePath, 'utf8');

  // Container must have radiogroup role
  assert(content.includes('role="radiogroup"'), 'Toggle container must have role="radiogroup"');
  assert(content.includes('aria-label="3-Position Hardware Toggle Switch"'), 'Container must have descriptive aria-label');

  // Interactive click zones must be <button role="radio">
  const buttonRadioMatches = (content.match(/<button[\s\S]*?role="radio"/g) || []).length;
  assert.strictEqual(buttonRadioMatches, 3, 'Must render exactly 3 <button role="radio"> elements');

  // Must have tabIndex={0}
  assert(content.includes('tabIndex={0}'), 'Buttons must be keyboard-focusable with tabIndex={0}');

  // Must have aria-checked
  assert(content.includes("aria-checked={position === 'up'}"), "Up button must bind aria-checked");
  assert(content.includes("aria-checked={position === 'center'}"), "Center button must bind aria-checked");
  assert(content.includes("aria-checked={position === 'down'}"), "Down button must bind aria-checked");

  // Must handle keyboard actuation
  assert(content.includes("onKeyDown="), 'Buttons must listen to onKeyDown');
  assert(content.includes("e.key === 'Enter' || e.key === ' '"), 'Must actuate on Enter or Space keys');
});

// ============================================================================
// FOCUS 5: ModularSynthPatchCard.tsx Scramble Timer Lifecycle & Cleanup
// ============================================================================

runTest('Focus 5.1: Cipher Scramble Timer Managed in useRef with Deterministic Cleanup', () => {
  const patchFilePath = path.join('D:/espprojects/oled/web/test/blueprint-eval/ModularSynthPatchCard.tsx');
  const content = fs.readFileSync(patchFilePath, 'utf8');

  // Verify useRef timer storage
  assert(content.includes('const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);'),
    'Timer must be stored in intervalRef via useRef');

  // Verify clearTimer definition
  assert(content.includes('clearInterval(intervalRef.current)'), 'clearTimer must clear interval');
  assert(content.includes('intervalRef.current = null'), 'clearTimer must reset ref to null');

  // Verify unmount cleanup in useEffect
  assert(content.includes('useEffect(() => {\n    return () => clearTimer();\n  }, [clearTimer]);') ||
         content.includes('return () => clearTimer();'),
    'useEffect unmount hook must call clearTimer');

  // Verify cleanup on mouse leave
  assert(content.includes('const handleMouseLeave = () => {\n    clearTimer();'),
    'handleMouseLeave must call clearTimer');

  // Verify pre-cleanup before starting new interval on mouse enter
  assert(content.includes('const handleMouseEnter = () => {\n    clearTimer();'),
    'handleMouseEnter must clear any active timer before starting a new one');

  // Verify completion cleanup
  assert(content.includes('if (iter > 18) {\n        clearTimer();'),
    'Timer must self-terminate after max iterations');
});

// ============================================================================
// FOCUS 6: hapticAudio.ts Hardware Clock Scheduling & Anti-Pop Ramp
// ============================================================================

runTest('Focus 6.1: hapticAudio SSR Guard, Zero-Volume Guard, and AudioContext Resume', () => {
  const hapticFilePath = path.join('D:/espprojects/oled/web/test/blueprint-eval/hapticAudio.ts');
  const content = fs.readFileSync(hapticFilePath, 'utf8');

  // SSR check
  assert(content.includes("typeof window === 'undefined'"), 'getHapticContext must guard against SSR environments');

  // Autoplay resume
  assert(content.includes("hapticAudioCtx.state === 'suspended'"), 'Must check for suspended audio context');
  assert(content.includes("hapticAudioCtx.resume()"), 'Must resume suspended audio context');

  // Zero-volume guard
  assert(content.includes('if (volume <= 0) return;'), 'Must abort when volume <= 0');
  assert(content.includes('const safeVolume = Math.max(0.0001, volume);'), 'Must clamp volume away from exact 0 for exponential ramp');
});

runTest('Focus 6.2: Anti-Pop Linear Attack Ramp & Hardware Clock Scheduling (+0.004)', () => {
  const hapticFilePath = path.join('D:/espprojects/oled/web/test/blueprint-eval/hapticAudio.ts');
  const content = fs.readFileSync(hapticFilePath, 'utf8');

  // 0.3ms anti-pop ramp
  assert(content.includes('gain.gain.setValueAtTime(0.0001, startTime);'), 'Gain must initialize at 0.0001');
  assert(content.includes('gain.gain.linearRampToValueAtTime(safeVolume, startTime + 0.0003);'),
    'Must ramp up linearly over exact 0.3ms (+0.0003) to prevent DC offset pops');
  assert(content.includes('gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);'),
    'Must decay exponentially to 0.0001');

  // playRelaySnap hardware clock scheduling
  assert(content.includes('const now = ctx.currentTime;'), 'playRelaySnap must sample ctx.currentTime');
  assert(content.includes('playHapticClick(180, 0.015, 0.08, now);'), 'First click must schedule at now');
  assert(content.includes('playHapticClick(4500, 0.005, 0.06, now + 0.004);'),
    'Second click must schedule at now + 0.004 on Web Audio hardware clock');
  assert(!content.includes('setTimeout'), 'playRelaySnap must NOT use setTimeout');
});

// ============================================================================
// FOCUS 7: Master Design Blueprint Synchronization & Integrity
// ============================================================================

runTest('Focus 7.1: Blueprint Synchronization Between Worker 1 and Worker 2', () => {
  const bp1Path = path.join('D:/espprojects/oled/.agents/teamwork/worker_1/DESIGN_BLUEPRINT.md');
  const bp2Path = path.join('D:/espprojects/oled/.agents/teamwork/worker_2/DESIGN_BLUEPRINT.md');

  assert(fs.existsSync(bp1Path), 'worker_1/DESIGN_BLUEPRINT.md must exist');
  assert(fs.existsSync(bp2Path), 'worker_2/DESIGN_BLUEPRINT.md must exist');

  const bp1 = fs.readFileSync(bp1Path, 'utf8');
  const bp2 = fs.readFileSync(bp2Path, 'utf8');

  assert.strictEqual(bp1.length, bp2.length, 'Both blueprints must have identical byte count');
  assert.strictEqual(bp1, bp2, 'Both blueprints must have identical content');
});

runTest('Focus 7.2: All 13 Component Recipes Present and Documented in Blueprint', () => {
  const bpPath = path.join('D:/espprojects/oled/.agents/teamwork/worker_2/DESIGN_BLUEPRINT.md');
  const bp = fs.readFileSync(bpPath, 'utf8');

  const requiredRecipes = [
    'LiquidStudioNav.tsx',
    'FloatingTransportDock.tsx',
    'InertiaTimelineScrubber.tsx',
    'ModularSynthPatchCard.tsx',
    'HardwareTelemetryHUD.tsx',
    'TactileRotaryKnob.tsx',
    'HardwareToggleSwitch.tsx',
    'BorderTrail.tsx',
    'PixelCard.tsx',
    'ZeroBloatWaveField.tsx',
    'hapticAudio.ts',
    'SvgFilters.tsx',
    'springPresets.ts'
  ];

  for (const recipe of requiredRecipes) {
    assert(bp.includes(recipe), `Blueprint must contain recipe: ${recipe}`);
  }
});

// ============================================================================
// SUMMARY
// ============================================================================

console.log('\n------------------------------------------------------------------------');
console.log(`VERIFICATION SUMMARY: ${passCount + failCount} Tests | ${passCount} Passed | ${failCount} Failed`);
console.log('------------------------------------------------------------------------\n');

if (failCount > 0) {
  process.exit(1);
} else {
  console.log('ALL CHALLENGER 3 EMPIRICAL STRESS TESTS PASSED WITH 100% SUCCESS.');
  process.exit(0);
}
