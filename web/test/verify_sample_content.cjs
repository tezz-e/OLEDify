const fs = require('fs');
const path = require('path');

// Let's test whether Dino generation in HEAD vs working tree produces identical frames.
// Since git diff HEAD -- web/src/engine/sampleGenerator.ts has NO differences in frame generation logic,
// let's run a verification script inside web/ to verify Dino frames and C++ array export.

async function verify() {
  console.log('=== VERIFYING DINO SAMPLE FRAMES & C++ EXPORT VS HEAD ===');
  // Read HEAD file content
  const { execSync } = require('child_process');
  const headCode = execSync('git show HEAD:web/src/engine/sampleGenerator.ts', { cwd: 'D:\\espprojects\\oled' }).toString();
  const currentCode = fs.readFileSync('D:\\espprojects\\oled\\web\\src\\engine\\sampleGenerator.ts', 'utf8');

  // Check diff outside sampleNames
  const headWithoutNames = headCode.replace(/const sampleNames[\s\S]*?};/, '');
  const currentWithoutNames = currentCode.replace(/const sampleNames[\s\S]*?};/, '');
  
  const isIdenticalLogic = headWithoutNames === currentWithoutNames;
  console.log('Frame generation logic identical to HEAD (excluding sampleNames strings):', isIdenticalLogic);

  // Check heartbeat logic specifically
  const headHeart = headCode.match(/case 'heartbeat':[\s\S]*?break;/)?.[0];
  const currentHeart = currentCode.match(/case 'heartbeat':[\s\S]*?break;/)?.[0];
  console.log('Heartbeat generator code identical to HEAD:', headHeart === currentHeart);

  // Check dino logic specifically
  const headDino = headCode.match(/case 'dino':[\s\S]*?break;/)?.[0];
  const currentDino = currentCode.match(/case 'dino':[\s\S]*?break;/)?.[0];
  console.log('Dino generator code identical to HEAD:', headDino === currentDino);
}

verify().catch(console.error);
