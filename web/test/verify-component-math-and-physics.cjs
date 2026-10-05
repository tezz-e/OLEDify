const fs = require('fs');

console.log('================================================================');
console.log('MATHEMATICAL & PHYSICS HARNESS VERIFICATION');
console.log('================================================================\n');

// 1. Spring Presets Damping Ratio Verification
const HW_SPRINGS = {
  tactileTap: { mass: 0.1, stiffness: 450, damping: 24 },
  dockMagnify: { mass: 0.1, stiffness: 220, damping: 14 },
  mercuryMorph: { mass: 0.6, stiffness: 380, damping: 28 },
  switchSnap: { mass: 0.3, stiffness: 500, damping: 20 },
  islandExpand: { mass: 0.8, stiffness: 320, damping: 30 },
  jogCatchUp: { mass: 0.2, stiffness: 300, damping: 26 },
};

console.log('--- Spring Damping Ratios (zeta = c / (2 * sqrt(m * k))) ---');
Object.entries(HW_SPRINGS).forEach(([name, { mass, stiffness, damping }]) => {
  const omega0 = Math.sqrt(stiffness / mass);
  const zeta = damping / (2 * Math.sqrt(mass * stiffness));
  const regime = zeta < 1 ? 'Underdamped (Overshoot/Ring)' : zeta === 1 ? 'Critically Damped' : 'Overdamped (Zero Overshoot)';
  console.log(`${name.padEnd(14)}: m=${mass}, k=${stiffness}, c=${damping} => omega_0=${omega0.toFixed(1)} rad/s, zeta=${zeta.toFixed(3)} (${regime})`);
});

// 2. Skiper UI Gooey Threshold Cutoff Verification
console.log('\n--- Skiper UI Gooey Alpha Cutoff Matrix ---');
// Alpha_out = 19 * Alpha_in - 9
const alphaInCutoffLow = 9 / 19;
const alphaInCutoffHigh = 10 / 19;
console.log(`Transparency Cutoff (Alpha_out = 0): Alpha_in <= ${alphaInCutoffLow.toFixed(6)} (~47.37%)`);
console.log(`Full Opacity Cutoff (Alpha_out = 1): Alpha_in >= ${alphaInCutoffHigh.toFixed(6)} (~52.63%)`);
console.log(`Surface Tension Bridge Transition Width: ${((alphaInCutoffHigh - alphaInCutoffLow) * 100).toFixed(4)}% opacity band`);

// 3. Lenis Exponential Damping Calculus Verification
console.log('\n--- Lenis Exponential Damping Decay ---');
const lambda = 24.0;
const dts = [0.008, 0.016, 0.033, 0.1];
dts.forEach(dt => {
  const decay = Math.exp(-lambda * dt);
  const remainingLag = (decay * 100).toFixed(2);
  const convergence = ((1 - decay) * 100).toFixed(2);
  console.log(`dt = ${(dt * 1000).toFixed(1)}ms (${(1 / dt).toFixed(0)} FPS): convergence = ${convergence}%, remaining lag = ${remainingLag}%`);
});

// 4. Sub-frame SMPTE Timecode Formulations Verification
console.log('\n--- Sub-frame SMPTE & NLE Millisecond Verification ---');
function calcTimecode(t, fps = 30) {
  const totalFrames = Math.floor(t * fps + 1e-6);
  const subFrameFrac = (t * fps) - totalFrames;
  const hh = Math.floor(totalFrames / (3600 * fps));
  const mm = Math.floor((totalFrames % (3600 * fps)) / (60 * fps));
  const ss = Math.floor((totalFrames % (60 * fps)) / fps);
  const ff = totalFrames % fps;
  const subTicks = Math.floor(subFrameFrac * 100);

  const mins = Math.floor(t / 60);
  const secs = Math.floor(t % 60);
  const ms = Math.floor((t - Math.floor(t)) * 1000);

  const pad2 = (n) => String(n).padStart(2, '0');
  const pad3 = (n) => String(n).padStart(3, '0');

  return {
    smpte: `${pad2(hh)}:${pad2(mm)}:${pad2(ss)}:${pad2(ff)}.${pad2(subTicks)}`,
    nle: `${pad2(mins)}:${pad2(secs)}.${pad3(ms)}`,
  };
}

const testTimes = [0.0, 2.150, 65.432, 125.999];
testTimes.forEach(t => {
  const res = calcTimecode(t, 30);
  console.log(`t = ${t.toFixed(3)}s => SMPTE: ${res.smpte} | NLE Display: ${res.nle}`);
});
