const fs = require('fs');
const path = require('path');

const content = fs.readFileSync('D:/espprojects/oled/.agents/teamwork/worker_1/DESIGN_BLUEPRINT.md', 'utf8');

const recipes = [
  { name: 'springPresets.ts', marker: '### 2.3 Framer Motion Spring Presets (`springPresets.ts`)' },
  { name: 'SvgFilters.tsx', marker: '### 2.4 SVG Filter Definitions (`SvgFilters.tsx`)' },
  { name: 'LiquidStudioNav.tsx', marker: '### 3.1 Recipe 1: `LiquidStudioNav.tsx`' },
  { name: 'FloatingTransportDock.tsx', marker: '### 3.2 Recipe 2: `FloatingTransportDock.tsx`' },
  { name: 'InertiaTimelineScrubber.tsx', marker: '### 3.3 Recipe 3: `InertiaTimelineScrubber.tsx`' },
  { name: 'ModularSynthPatchCard.tsx', marker: '### 3.4 Recipe 4: `ModularSynthPatchCard.tsx`' },
  { name: 'HardwareTelemetryHUD.tsx', marker: '### 3.5 Recipe 5: `HardwareTelemetryHUD.tsx`' },
  { name: 'TactileRotaryKnob.tsx', marker: '### 4.1 Recipe 6: `TactileRotaryKnob.tsx`' },
  { name: 'HardwareToggleSwitch.tsx', marker: '### 4.2 Recipe 7: `HardwareToggleSwitch.tsx`' },
  { name: 'BorderTrail.tsx', marker: '### 4.3 Recipe 8: `BorderTrail.tsx`' },
  { name: 'PixelCard.tsx', marker: '### 4.4 Recipe 9: `PixelCard.tsx`' },
  { name: 'ZeroBloatWaveField.tsx', marker: '### 4.5 Recipe 10: `ZeroBloatWaveField.tsx`' },
  { name: 'hapticAudio.ts', marker: '### 4.6 Recipe 11: `hapticAudio.ts`' },
];

const outDir = 'D:/espprojects/oled/web/test/blueprint-eval';
if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

recipes.forEach(({ name, marker }) => {
  const start = content.indexOf(marker);
  if (start === -1) {
    console.error('Marker not found:', marker);
    return;
  }
  const codeStart = content.indexOf('```', start);
  const lineEnd = content.indexOf('\n', codeStart);
  const codeEnd = content.indexOf('```', lineEnd + 1);
  const code = content.substring(lineEnd + 1, codeEnd);
  fs.writeFileSync(path.join(outDir, name), code.trim() + '\n');
  console.log('Extracted:', name, 'lines:', code.trim().split('\n').length);
});
