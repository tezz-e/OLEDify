const fs = require('fs');
const path = require('path');

console.log('================================================================');
console.log('EMPIRICAL STRESS TESTING HARNESS FOR WORKER 1 DESIGN BLUEPRINT');
console.log('================================================================\n');

const results = [];

function recordTest(id, name, status, details, severity) {
  results.push({ id, name, status, details, severity });
  console.log(`[${status}] [${severity}] ${id}: ${name}`);
  console.log(`   Details: ${details}\n`);
}

// --------------------------------------------------------------------------
// TEST 1: HardwareTelemetryHUD - audioTelemetry length 1 division by zero
// --------------------------------------------------------------------------
(() => {
  const hudFile = fs.readFileSync('D:/espprojects/oled/web/test/blueprint-eval/HardwareTelemetryHUD.tsx', 'utf8');
  const hasGuard = hudFile.includes('Math.max(2');
  const audioTelemetry = [0.75];
  const len = hasGuard
    ? Math.max(2, audioTelemetry.length > 0 ? audioTelemetry.length : 32)
    : (audioTelemetry.length > 0 ? audioTelemetry.length : 32);
  const canvas = { width: 64, height: 20 };
  const i = 0;
  const val = audioTelemetry[i];
  const x = (i / (len - 1)) * canvas.width;
  const y = canvas.height - val * canvas.height;

  if (isNaN(x) || !hasGuard) {
    recordTest(
      'HUD-01',
      'HardwareTelemetryHUD NaN Canvas Coordinate on Single Element Audio Buffer',
      'FAIL',
      `When audioTelemetry has length 1, (i / (len - 1)) evaluates to (0 / 0) = NaN. Canvas draw command receives moveTo(NaN, ${y}), causing canvas rendering corruption or silent failure.`,
      'HIGH'
    );
  } else {
    recordTest('HUD-01', 'HardwareTelemetryHUD Single Element Audio Buffer', 'PASS', 'x is finite and Math.max(2) guard present', 'LOW');
  }
})();

// --------------------------------------------------------------------------
// TEST 2: HardwareToggleSwitch - Tailwind Rotate-24 Class Resolution
// --------------------------------------------------------------------------
(() => {
  const tailwindConfigPath = 'D:/espprojects/oled/web/tailwind.config.js';
  const configContent = fs.readFileSync(tailwindConfigPath, 'utf8');
  const blueprintPath = 'D:/espprojects/oled/.agents/teamwork/worker_1/DESIGN_BLUEPRINT.md';
  const blueprintContent = fs.readFileSync(blueprintPath, 'utf8');

  // Check if rotate is extended
  const hasRotateInConfig = configContent.includes('rotate') && configContent.includes('24');
  const hasRotateInBlueprint = blueprintContent.includes('rotate:') || (blueprintContent.includes('rotate') && blueprintContent.includes('24:'));

  if (!hasRotateInConfig && !hasRotateInBlueprint) {
    recordTest(
      'TOGGLE-01',
      'HardwareToggleSwitch Invalid Tailwind Utility Classes (-rotate-24, rotate-24)',
      'FAIL',
      'Tailwind CSS default rotate scale only includes 0, 1, 2, 3, 6, 12, 45, 90, 180. Neither tailwind.config.js nor Section 2.2 defines rotate 24. Consequently, -rotate-24 and rotate-24 generate NO CSS rules, rendering the mechanical bat lever completely motionless.',
      'HIGH'
    );
  } else {
    recordTest('TOGGLE-01', 'HardwareToggleSwitch Tailwind Rotate Classes', 'PASS', 'rotate-24 defined', 'LOW');
  }
})();

// --------------------------------------------------------------------------
// TEST 3: TactileRotaryKnob - min === max Division by Zero
// --------------------------------------------------------------------------
(() => {
  const knobFile = fs.readFileSync('D:/espprojects/oled/web/test/blueprint-eval/TactileRotaryKnob.tsx', 'utf8');
  const hasGuard = knobFile.includes('range > 0') || knobFile.includes('max > min');
  const min = 50;
  const max = 50;
  const value = 50;
  const range = max - min;
  const norm = hasGuard
    ? (range > 0 ? Math.min(1, Math.max(0, (value - min) / range)) : 0)
    : (value - min) / (max - min);
  const angle = -135 + norm * 270;
  const r = 18;
  const strokeLen = 2 * Math.PI * r * (270 / 360);
  const strokeOffset = strokeLen * (1 - norm);

  if (isNaN(norm) || isNaN(angle) || isNaN(strokeOffset) || !hasGuard) {
    recordTest(
      'KNOB-01',
      'TactileRotaryKnob NaN Division by Zero when min === max',
      'FAIL',
      `When min === max, (value - min) / (max - min) produces NaN. Resulting SVG transform rotate(NaNdeg) and strokeDashoffset NaN break SVG rendering. Guard (max > min ? ... : 0) is missing.`,
      'MEDIUM'
    );
  } else {
    recordTest('KNOB-01', 'TactileRotaryKnob min === max', 'PASS', 'norm is finite and guard present', 'LOW');
  }
})();

// --------------------------------------------------------------------------
// TEST 4: ModularSynthPatchCard - setInterval Leak & Desync on Fast Hover
// --------------------------------------------------------------------------
(() => {
  const cardFile = fs.readFileSync('D:/espprojects/oled/web/test/blueprint-eval/ModularSynthPatchCard.tsx', 'utf8');
  const hasIntervalRef = cardFile.includes('useRef') && (cardFile.includes('intervalRef') || cardFile.includes('timerRef'));
  const hasClearInMouseLeave = cardFile.includes('clearInterval') && cardFile.indexOf('clearInterval') < cardFile.indexOf('handleMouseLeave');
  const hasUnmountCleanup = cardFile.includes('useEffect') && cardFile.includes('clearInterval');

  if (!hasIntervalRef && !hasUnmountCleanup) {
    recordTest(
      'PATCH-01',
      'ModularSynthPatchCard Unmanaged setInterval Timer Leak and Hover Race Condition',
      'FAIL',
      'handleMouseEnter creates an unmanaged local setInterval. If user hovers out, handleMouseLeave sets name, but the interval continues ticking every 30ms up to 18 times, fighting handleMouseLeave. If user hovers in/out repeatedly, multiple intervals run concurrently. If component unmounts during animation, state update on unmounted component memory leak occurs.',
      'HIGH'
    );
  } else {
    recordTest('PATCH-01', 'ModularSynthPatchCard Interval Management', 'PASS', 'Timers properly managed', 'LOW');
  }
})();

// --------------------------------------------------------------------------
// TEST 5: InertiaTimelineScrubber - RAF Re-Subscription Loop in useEffect
// --------------------------------------------------------------------------
(() => {
  const scrubberFile = fs.readFileSync('D:/espprojects/oled/web/test/blueprint-eval/InertiaTimelineScrubber.tsx', 'utf8');
  // Check useEffect dependency array
  const effectRegex = /useEffect\(\(\) => \{[\s\S]*?cancelAnimationFrame\(animId\);[\s\S]*?\}, \[([\s\S]*?)\]\);/;
  const match = scrubberFile.match(effectRegex);
  
  if (match && match[1].includes('visualFrame')) {
    recordTest(
      'SCRUB-01',
      'InertiaTimelineScrubber RAF Loop Tears Down and Restarts on Every Visual Frame',
      'FAIL',
      `InertiaTimelineScrubber includes visualFrame in the useEffect dependency array. But inside tick(), setVisualFrame(next) is called whenever the playhead moves. This causes useEffect to tear down (cancelling the RAF) and recreate a brand-new RAF loop on every single frame, resetting lastTime = performance.now() and breaking the smooth exponential decay calculus.`,
      'CRITICAL'
    );
  } else {
    recordTest('SCRUB-01', 'InertiaTimelineScrubber Dependency Array', 'PASS', 'RAF loop stable', 'LOW');
  }
})();

// --------------------------------------------------------------------------
// TEST 6: InertiaTimelineScrubber - Massive DOM Virtualization Failure
// --------------------------------------------------------------------------
(() => {
  const scrubberFile = fs.readFileSync('D:/espprojects/oled/web/test/blueprint-eval/InertiaTimelineScrubber.tsx', 'utf8');
  const hasArrayFromTotalFrames = scrubberFile.includes('Array.from({ length: totalFrames }).map(');

  if (hasArrayFromTotalFrames) {
    recordTest(
      'SCRUB-02',
      'InertiaTimelineScrubber Unvirtualized O(N) DOM Element Creation for Ruler Ticks',
      'FAIL',
      'Array.from({ length: totalFrames }).map(...) creates a distinct DOM node and tick mark for every frame. For a 2-minute song at 30 FPS (3,600 frames) or 5-minute song (9,000 frames), 3,600 to 9,000 React DOM elements are rendered and repositioned on every frame update, causing extreme GPU/CPU frame drops and UI freezes.',
      'HIGH'
    );
  } else {
    recordTest('SCRUB-02', 'InertiaTimelineScrubber Ruler Virtualization', 'PASS', 'Ruler is virtualized or canvas-based', 'LOW');
  }
})();

// --------------------------------------------------------------------------
// TEST 7: PixelCard - Missing Dependency in useEffect (Stale Accent Color)
// --------------------------------------------------------------------------
(() => {
  const pixelCardFile = fs.readFileSync('D:/espprojects/oled/web/test/blueprint-eval/PixelCard.tsx', 'utf8');
  const effectDepRegex = /return \(\) => \{[\s\S]*?cancelAnimationFrame[\s\S]*?\};[\s\S]*?\}, \[([\s\S]*?)\]\);/;
  const match = pixelCardFile.match(effectDepRegex);

  if (match && !match[1].includes('accent')) {
    recordTest(
      'PIXEL-01',
      'PixelCard Stale Closure on accent Prop in useEffect Dependency Array',
      'FAIL',
      `PixelCard derives accentRGB from the accent prop, but the useEffect dependency array is [gridSpacing, decayMs, isDark] without accent. When the parent switches the card accent between phosphor/amber/cyan, the canvas continues drawing with the stale accentRGB captured at initial mount.`,
      'MEDIUM'
    );
  } else {
    recordTest('PIXEL-01', 'PixelCard Dependency Array', 'PASS', 'accent included in dependencies', 'LOW');
  }
})();

// --------------------------------------------------------------------------
// TEST 8: PixelCard & ZeroBloatWaveField - Unbounded Global Event Listener Overhead
// --------------------------------------------------------------------------
(() => {
  const pixelCardFile = fs.readFileSync('D:/espprojects/oled/web/test/blueprint-eval/PixelCard.tsx', 'utf8');
  const waveFieldFile = fs.readFileSync('D:/espprojects/oled/web/test/blueprint-eval/ZeroBloatWaveField.tsx', 'utf8');

  const pixelHasGlobalWindow = pixelCardFile.includes("window.addEventListener('pointermove'") && pixelCardFile.includes('getBoundingClientRect()');
  const waveHasGlobalWindow = waveFieldFile.includes("window.addEventListener('pointermove'") && waveFieldFile.includes('getBoundingClientRect()');

  if (pixelHasGlobalWindow && waveHasGlobalWindow) {
    recordTest(
      'PERF-01',
      'PixelCard & ZeroBloatWaveField Global window pointermove Forces Layout Reflow on Every Mouse Movement',
      'FAIL',
      'Both components attach pointermove listeners to window and execute canvas.getBoundingClientRect() on every single pointer movement anywhere in the browser. In complex layouts, calling getBoundingClientRect() on window pointermove triggers forced synchronous layout / reflow, causing micro-stuttering across the entire UI.',
      'MEDIUM'
    );
  } else {
    recordTest('PERF-01', 'Pointer Move Handling', 'PASS', 'Scoped or throttled', 'LOW');
  }
})();

// --------------------------------------------------------------------------
// TEST 9: ZeroBloatWaveField - Contradiction of 0% CPU Idle Claim
// --------------------------------------------------------------------------
(() => {
  const waveFieldFile = fs.readFileSync('D:/espprojects/oled/web/test/blueprint-eval/ZeroBloatWaveField.tsx', 'utf8');
  const hasIdleCheck = waveFieldFile.includes('isIdle') || waveFieldFile.includes('cancelAnimationFrame') && waveFieldFile.includes('sleeping');
  const runsForever = waveFieldFile.includes('animId = requestAnimationFrame(render);') && !waveFieldFile.includes('if (!isMoving');

  if (!hasIdleCheck && runsForever) {
    recordTest(
      'WAVE-01',
      'ZeroBloatWaveField False Claim of "0% CPU Idle" — Constant 60/120 FPS RAF Calculation Loop',
      'FAIL',
      'The blueprint claims "0% CPU idle", but ZeroBloatWaveField executes an unpausing requestAnimationFrame loop that iterates over (clientWidth / gridSpacing) * (clientHeight / gridSpacing) points (3,600+ points on 1080p), computing multiple trigonometric functions (sin, cos, exp) and canvas arc/fill calls on every single frame even when pointer is outside and audio is completely silent (0).',
      'MEDIUM'
    );
  } else {
    recordTest('WAVE-01', 'ZeroBloatWaveField Idle Suspension', 'PASS', 'Pauses when idle', 'LOW');
  }
})();

// --------------------------------------------------------------------------
// TEST 10: BorderTrail - Conic Gradient Angular Discontinuity for Small/Large Sizes
// --------------------------------------------------------------------------
(() => {
  const trailFile = fs.readFileSync('D:/espprojects/oled/web/test/blueprint-eval/BorderTrail.tsx', 'utf8');
  const hasDynamicStops = trailFile.includes('safeSize') || trailFile.includes('startAngle');
  function testConicGradient(size, trailColor = '#FF5500') {
    if (hasDynamicStops) {
      const safeSize = Math.min(359, Math.max(1, size));
      const stop1 = 360 - safeSize;
      const stop2 = Math.max(stop1, 360 - safeSize * 0.25);
      return { stop1, stop2, isClamped: stop2 < stop1 };
    } else {
      const stop1 = 360 - size;
      const stop2 = 340;
      // CSS spec: if stop2 < stop1, browser clamps stop2 to stop1
      return { stop1, stop2, isClamped: stop2 < stop1 };
    }
  }

  const smallSize = testConicGradient(10); // size = 10deg beam
  const largeSize = testConicGradient(100); // size = 100deg beam

  if (smallSize.isClamped || !hasDynamicStops) {
    recordTest(
      'TRAIL-01',
      'BorderTrail Conic Gradient Stop Collision when size < 20 Degrees',
      'FAIL',
      `conic-gradient is defined as: transparent \${360 - size}deg, \${trailColor} 340deg. When size = 10, transparent stop is at 350deg, while trailColor is hardcoded at 340deg. Because 340deg < 350deg, CSS gradient normalization forces the color stop to clamp to 350deg, eliminating the intended smooth gradient trail and producing an abrupt hard edge.`,
      'LOW'
    );
  } else {
    recordTest('TRAIL-01', 'BorderTrail Gradient Stops', 'PASS', 'Gradient stops valid and dynamically computed', 'LOW');
  }
})();

// --------------------------------------------------------------------------
// TEST 11: hapticAudio.ts - SSR/Node Window ReferenceError & Audio Autoplay Policy
// --------------------------------------------------------------------------
(() => {
  const hapticFile = fs.readFileSync('D:/espprojects/oled/web/test/blueprint-eval/hapticAudio.ts', 'utf8');
  const hasWindowCheck = hapticFile.includes('typeof window') || hapticFile.includes('typeof AudioContext');
  const hasZeroVolumeGuard = hapticFile.includes('volume <= 0') || hapticFile.includes('Math.max(0.0001, volume)');

  if (!hasWindowCheck || !hasZeroVolumeGuard) {
    recordTest(
      'AUDIO-01',
      'hapticAudio Web Audio API Edge Cases: Missing SSR Window Guard and exponentialRamp Zero Volume Fault',
      'FAIL',
      '1. getHapticContext() accesses window directly without "typeof window !== \'undefined\'" guard, throwing ReferenceError in SSR/test environments. 2. In Web Audio API, calling exponentialRampToValueAtTime with a starting value of 0 (if volume = 0) throws an uncaught RangeError, because exponential ramps cannot interpolate from zero. A linear ramp or Math.max(0.0001, volume) clamp is required.',
      'MEDIUM'
    );
  } else {
    recordTest('AUDIO-01', 'hapticAudio Robustness', 'PASS', 'Guarded against SSR and zero volume', 'LOW');
  }
})();

// --------------------------------------------------------------------------
// TEST 12: HardwareToggleSwitch & LiquidStudioNav - Accessibility (ARIA & Keyboard)
// --------------------------------------------------------------------------
(() => {
  const toggleFile = fs.readFileSync('D:/espprojects/oled/web/test/blueprint-eval/HardwareToggleSwitch.tsx', 'utf8');
  const hasRole = toggleFile.includes('role="button"') || toggleFile.includes('role="radiogroup"');
  const hasKeyboard = toggleFile.includes('onKeyDown') || toggleFile.includes('tabIndex');

  if (!hasRole && !hasKeyboard) {
    recordTest(
      'A11Y-01',
      'HardwareToggleSwitch Non-Semantic Div Click Zones Violate WAI-ARIA and Keyboard Accessibility',
      'FAIL',
      'The 3 toggle positions are rendered as unadorned <div onClick=...> elements without role="radio", role="button", tabIndex, aria-checked, or onKeyDown listeners. Keyboard users and screen readers cannot focus or actuate the switch.',
      'LOW'
    );
  } else {
    recordTest('A11Y-01', 'HardwareToggleSwitch Accessibility', 'PASS', 'Accessible roles present', 'LOW');
  }
})();

console.log('----------------------------------------------------------------');
const totalFails = results.filter(r => r.status === 'FAIL').length;
const totalPasses = results.filter(r => r.status === 'PASS').length;
console.log(`SUMMARY: ${results.length} Tests Executed | ${totalPasses} Passed | ${totalFails} Failed`);
console.log('----------------------------------------------------------------');
