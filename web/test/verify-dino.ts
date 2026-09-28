import assert from 'node:assert/strict';
import {
  DINO_RUNNER_FRAME_COUNT,
  DINO_RUNNER_FPS,
  getDinoRunnerFrameState,
} from '../src/engine/sampleGenerator.ts';

assert.equal(DINO_RUNNER_FRAME_COUNT, 300, 'Dino Runner must have 300 frames');
assert.equal(DINO_RUNNER_FPS, 30, 'Dino Runner must run at 30fps');
assert.equal(DINO_RUNNER_FRAME_COUNT / DINO_RUNNER_FPS, 10, 'Dino Runner must last 10 seconds');

let framesInAir = 0;
let previousDinoY = getDinoRunnerFrameState(0).dino.y;
let firstTakeoffDelta: number | null = null;
for (let frame = 0; frame < DINO_RUNNER_FRAME_COUNT; frame++) {
  const { dino, obstacles } = getDinoRunnerFrameState(frame);
  if (firstTakeoffDelta === null && dino.y < previousDinoY) {
    firstTakeoffDelta = previousDinoY - dino.y;
  }
  previousDinoY = dino.y;
  if (dino.y < 56) framesInAir++;
  assert.ok(dino.y >= 0 && dino.y + dino.height <= 128, `Dino is clipped at frame ${frame}`);

  for (const obstacle of obstacles) {
    const overlapsX = dino.x < obstacle.x + obstacle.width && dino.x + dino.width > obstacle.x;
    const overlapsY = dino.y < obstacle.y + obstacle.height && dino.y + dino.height > obstacle.y;
    assert.ok(!overlapsX || !overlapsY, `Dino intersects a cactus at frame ${frame}`);
  }
}

assert.ok(framesInAir > 0, 'Dino must jump during the clip');
assert.ok(firstTakeoffDelta !== null && firstTakeoffDelta < 2, 'Jump must ease into takeoff instead of snapping upward');
assert.deepEqual(
  getDinoRunnerFrameState(DINO_RUNNER_FRAME_COUNT),
  getDinoRunnerFrameState(0),
  'Dino and obstacle positions must repeat cleanly at the loop boundary'
);

console.log('Dino Runner verified: 10 seconds at 30fps, no cactus intersections, loop is continuous.');
