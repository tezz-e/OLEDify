import assert from 'node:assert/strict';
import { generateCppHeader } from '../src/engine/ditherEngine.ts';

async function verifyExportHeader() {
  const progress: number[] = [];
  const frames = Array.from({ length: 13 }, (_, frameIndex) =>
    new Uint8Array([frameIndex, 1, 255])
  );
  const header = await generateCppHeader(frames, 30, undefined, 2, 4, value => progress.push(value));

  assert.match(header, /#define NUM_FRAMES 13/);
  assert.match(header, /#define FRAME_SIZE_BYTES 1/);
  assert.ok(header.includes('  { 0x00, 0x01, 0xFF },\n'));
  assert.ok(header.includes('  { 0x0C, 0x01, 0xFF }\n'));
  assert.ok(header.endsWith('  { 0x0C, 0x01, 0xFF }\n};\n\n#endif // FRAMES_H\n'));
  assert.deepEqual(progress, [92, 100]);

  console.log('Export header content and incremental progress verified.');
}

verifyExportHeader().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
