import { DecodedMedia, ExtractedFrame } from '../types/media';

// --- AUTHENTIC DINO SPRITES FROM C:\Users\manee\Desktop\oled\PlayerA_ESP32S3\sprites.h ---
const TREX_W = 25;
const TREX_H = 26;

const trex_run1 = [
  0x00, 0x00, 0x00, 0x00, 0x00, 0x07, 0xfe, 0x00,
  0x00, 0x06, 0xff, 0x00, 0x00, 0x0e, 0xff, 0x00,
  0x00, 0x0f, 0xff, 0x00, 0x00, 0x0f, 0xff, 0x00,
  0x00, 0x0f, 0xff, 0x00, 0x00, 0x0f, 0xc0, 0x00,
  0x00, 0x0f, 0xfc, 0x00, 0x40, 0x0f, 0xc0, 0x00,
  0x40, 0x1f, 0x80, 0x00, 0x40, 0x7f, 0x80, 0x00,
  0x60, 0xff, 0xe0, 0x00, 0x71, 0xff, 0xa0, 0x00,
  0x7f, 0xff, 0x80, 0x00, 0x7f, 0xff, 0x80, 0x00,
  0x7f, 0xff, 0x80, 0x00, 0x3f, 0xff, 0x00, 0x00,
  0x1f, 0xff, 0x00, 0x00, 0x0f, 0xfe, 0x00, 0x00,
  0x03, 0xfc, 0x00, 0x00, 0x01, 0xdc, 0x00, 0x00,
  0x01, 0x8c, 0x00, 0x00, 0x01, 0x8c, 0x00, 0x00,
  0x01, 0x0c, 0x00, 0x00, 0x01, 0x8e, 0x00, 0x00
];

const trex_run2 = [
  0x00, 0x00, 0x00, 0x00, 0x00, 0x07, 0xfe, 0x00,
  0x00, 0x06, 0xff, 0x00, 0x00, 0x0e, 0xff, 0x00,
  0x00, 0x0f, 0xff, 0x00, 0x00, 0x0f, 0xff, 0x00,
  0x00, 0x0f, 0xff, 0x00, 0x00, 0x0f, 0xc0, 0x00,
  0x00, 0x0f, 0xfc, 0x00, 0x40, 0x0f, 0xc0, 0x00,
  0x40, 0x1f, 0x80, 0x00, 0x40, 0x7f, 0x80, 0x00,
  0x60, 0xff, 0xe0, 0x00, 0x71, 0xff, 0xa0, 0x00,
  0x7f, 0xff, 0x80, 0x00, 0x7f, 0xff, 0x80, 0x00,
  0x7f, 0xff, 0x80, 0x00, 0x3f, 0xff, 0x00, 0x00,
  0x1f, 0xff, 0x00, 0x00, 0x0f, 0xfe, 0x00, 0x00,
  0x07, 0xfc, 0x00, 0x00, 0x03, 0x9c, 0x00, 0x00,
  0x03, 0x0c, 0x00, 0x00, 0x06, 0x0c, 0x00, 0x00,
  0x0e, 0x08, 0x00, 0x00, 0x0e, 0x00, 0x00, 0x00
];

const CACTUS_A_W = 11;
const CACTUS_A_H = 23;
const cactus_a = [
  0x1e, 0x00, 0x1f, 0x00, 0x1f, 0x40, 0x1f, 0xe0,
  0x1f, 0xe0, 0xdf, 0xe0, 0xff, 0xe0, 0xff, 0xe0,
  0xff, 0xe0, 0xff, 0xe0, 0xff, 0xe0, 0xff, 0xe0,
  0xff, 0xc0, 0xff, 0x00, 0xff, 0x00, 0x7f, 0x00,
  0x1f, 0x00, 0x1f, 0x00, 0x1f, 0x00, 0x1f, 0x00,
  0x1f, 0x00, 0x1f, 0x00, 0x1f, 0x00
];

const CACTUS_C_W = 22;
const CACTUS_C_H = 23;
const cactus_c = [
  0x1e, 0x01, 0xe0, 0x1f, 0x03, 0xe0, 0x1f, 0x4f,
  0xe8, 0x1f, 0xff, 0xfc, 0x1f, 0xff, 0xfc, 0xdf,
  0xff, 0xfc, 0xff, 0xff, 0xfc, 0xff, 0xff, 0xfc,
  0xff, 0xff, 0xfc, 0xff, 0xff, 0xfc, 0xff, 0xff,
  0xfc, 0xff, 0xef, 0xfc, 0xff, 0x83, 0xfc, 0xff,
  0x03, 0xfc, 0xff, 0x03, 0xf8, 0x7f, 0x03, 0xe0,
  0x1f, 0x03, 0xe0, 0x1f, 0x03, 0xe0, 0x1f, 0x03,
  0xe0, 0x1f, 0x03, 0xe0, 0x1f, 0x03, 0xe0, 0x1f,
  0x03, 0xe0, 0x1f, 0x03, 0xe0
];

function drawBitmap(
  ctx: CanvasRenderingContext2D,
  bytes: number[],
  width: number,
  height: number,
  x: number,
  y: number,
  scale: number = 2
) {
  ctx.fillStyle = '#FFFFFF';
  const bytesPerRow = Math.ceil(width / 8);
  for (let r = 0; r < height; r++) {
    for (let c = 0; c < width; c++) {
      const byteIdx = r * bytesPerRow + Math.floor(c / 8);
      const bitShift = 7 - (c % 8);
      if ((bytes[byteIdx] & (1 << bitShift)) !== 0) {
        ctx.fillRect(Math.round(x + c * scale), Math.round(y + r * scale), scale, scale);
      }
    }
  }
}

export type SamplePresetType = 
  | 'dino' 
  | 'heartbeat' 
  | 'spinner' 
  | 'wificonnect' 
  | 'bouncing' 
  | 'pacman' 
  | 'battery' 
  | 'sinewave' 
  | 'ripple' 
  | 'analogclock' 
  | 'starfield' 
  | 'matrix' 
  | 'rain' 
  | 'badapple'
  | 'dvd'
  | 'cube3d'
  | 'flame'
  | 'plasma'
  | 'fireworks'
  | 'roboeyes'
  | 'spirograph'
  | 'qrcode';

/**
 * Generates procedural sample animations for instant testing without uploading files.
 */
export function generateSampleMedia(sampleType: SamplePresetType): DecodedMedia {
  const width = 256;
  const height = 128;
  const targetFps = 30;
  const totalFrames = ['dino', 'heartbeat', 'wificonnect', 'battery', 'analogclock', 'bouncing'].includes(sampleType) ? 60 : 45;
  const frames: ExtractedFrame[] = [];

  for (let f = 0; f < totalFrames; f++) {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d')!;

    // Dark background
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, width, height);
    ctx.fillStyle = '#FFFFFF';
    ctx.strokeStyle = '#FFFFFF';

    if (sampleType === 'dino') {
      const S = 2;
      const groundY = 54 * S;
      ctx.fillRect(0, groundY, width, 2);

      for (let dot = 0; dot < 8; dot++) {
        const dotX = (dot * 36 - f * 6 + 400) % width;
        ctx.fillRect(dotX, groundY + 4, 3 * S, 1 * S);
      }

      let jumpY = 0;
      if (f >= 20 && f <= 40) {
        const progress = (f - 20) / 20;
        jumpY = Math.sin(progress * Math.PI) * 22 * S;
      }

      const dinoX = 20 * S;
      const dinoY = (54 - TREX_H) * S - jumpY;
      const currentDinoFrame = jumpY > 0 ? trex_run1 : (Math.floor(f / 3) % 2 === 0 ? trex_run1 : trex_run2);
      drawBitmap(ctx, currentDinoFrame, TREX_W, TREX_H, dinoX, dinoY, S);

      const cactus1X = ((280 - f * 5.5) % 360) - 20;
      if (cactus1X > -30 && cactus1X < width) {
        drawBitmap(ctx, cactus_a, CACTUS_A_W, CACTUS_A_H, cactus1X, (54 - CACTUS_A_H) * S, S);
      }

      const cactus2X = ((460 - f * 5.5) % 360) - 30;
      if (cactus2X > -40 && cactus2X < width) {
        drawBitmap(ctx, cactus_c, CACTUS_C_W, CACTUS_C_H, cactus2X, (54 - CACTUS_C_H) * S, S);
      }

      ctx.font = 'bold 12px monospace';
      ctx.fillText(`HI 00999  ${String(f * 15).padStart(5, '0')}`, width - 140, 20);

    } else if (sampleType === 'heartbeat') {
      // ECG Waveform & Pulsing Heart
      const cy = height / 2;
      ctx.lineWidth = 3;
      ctx.beginPath();
      
      for (let x = 0; x < width; x += 2) {
        const phase = (x + f * 6) % width;
        const norm = phase / width;
        let y = cy;

        if (norm > 0.35 && norm < 0.40) {
          y = cy - Math.sin((norm - 0.35) / 0.05 * Math.PI) * 12; // P wave
        } else if (norm >= 0.40 && norm < 0.43) {
          y = cy + 15; // Q dip
        } else if (norm >= 0.43 && norm < 0.48) {
          y = cy - 48; // R peak
        } else if (norm >= 0.48 && norm < 0.52) {
          y = cy + 24; // S dip
        } else if (norm >= 0.55 && norm < 0.65) {
          y = cy - Math.sin((norm - 0.55) / 0.10 * Math.PI) * 18; // T wave
        }

        if (x === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();

      // Pulsing heart icon in top corner
      const heartPulse = (f % 20 < 5) ? 1.3 : 1.0;
      ctx.font = `${Math.round(18 * heartPulse)}px sans-serif`;
      ctx.fillText('💓', 15, 26);
      ctx.font = 'bold 11px monospace';
      ctx.fillText('ECG MONITOR // 72 BPM', 45, 22);

    } else if (sampleType === 'spinner') {
      // Rotating Loading Arc Spinner
      const cx = width / 2;
      const cy = height / 2;
      const radius = 36;
      const startAngle = (f / totalFrames) * Math.PI * 2;
      const endAngle = startAngle + 1.4 * Math.PI;

      // Outer ring
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(cx, cy, radius + 8, 0, Math.PI * 2);
      ctx.stroke();

      // Rotating arc
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.arc(cx, cy, radius, startAngle, endAngle);
      ctx.stroke();

      const pct = Math.round((f / totalFrames) * 100);
      ctx.font = 'bold 12px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(`LOADING ${pct}%`, cx, cy + 4);
      ctx.textAlign = 'left';

    } else if (sampleType === 'wificonnect') {
      // WiFi Signal Bars & Pulse
      const cx = width / 2;
      const cy = height / 2 + 10;
      const activeBars = Math.floor((f / totalFrames) * 5);

      // Signal bars
      for (let b = 0; b < 4; b++) {
        const barW = 14;
        const barH = (b + 1) * 12;
        const bx = cx - 40 + b * 22;
        const by = cy - barH;

        if (b < activeBars) {
          ctx.fillRect(bx, by, barW, barH);
        } else {
          ctx.strokeRect(bx, by, barW, barH);
        }
      }

      ctx.font = 'bold 12px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(activeBars >= 4 ? 'WIFI: CONNECTED' : 'SEARCHING WIFI...', cx, 24);
      ctx.textAlign = 'left';

    } else if (sampleType === 'bouncing') {
      // DVD OLED Bouncer
      const speedX = 4;
      const speedY = 3;
      const logoW = 80;
      const logoH = 34;

      const posX = Math.abs((f * speedX) % ((width - logoW) * 2) - (width - logoW));
      const posY = Math.abs((f * speedY) % ((height - logoH) * 2) - (height - logoH));

      ctx.lineWidth = 2;
      ctx.strokeRect(posX, posY, logoW, logoH);
      ctx.font = 'bold 12px monospace';
      ctx.fillText('OLEDIFY', posX + 12, posY + 22);

    } else if (sampleType === 'pacman') {
      // Pac-Man chomping dots
      const cx = (f * 5) % (width + 60) - 30;
      const cy = height / 2;
      const r = 24;
      const mouthOpen = Math.abs(Math.sin(f * 0.3)) * 0.35 * Math.PI;

      // Pacman body
      ctx.beginPath();
      ctx.arc(cx, cy, r, mouthOpen, Math.PI * 2 - mouthOpen);
      ctx.lineTo(cx, cy);
      ctx.fill();

      // Food dots
      for (let dotX = 40; dotX < width + 40; dotX += 30) {
        if (dotX > cx + 10) {
          ctx.beginPath();
          ctx.arc(dotX, cy, 4, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      // Trailing Ghost
      const ghostX = cx - 50;
      if (ghostX > -30) {
        ctx.beginPath();
        ctx.arc(ghostX, cy - 4, 18, Math.PI, 0);
        ctx.lineTo(ghostX + 18, cy + 14);
        ctx.lineTo(ghostX - 18, cy + 14);
        ctx.fill();
      }

    } else if (sampleType === 'battery') {
      // Battery Charging Animation
      const bx = width / 2 - 60;
      const by = height / 2 - 25;
      const bw = 110;
      const bh = 50;

      // Battery shell
      ctx.lineWidth = 3;
      ctx.strokeRect(bx, by, bw, bh);
      ctx.fillRect(bx + bw, by + 14, 10, 22); // Terminal

      // Charge bars (0 to 4)
      const chargeLevel = Math.floor((f / totalFrames) * 5);
      const innerW = (bw - 12) / 4;
      for (let c = 0; c < chargeLevel; c++) {
        ctx.fillRect(bx + 6 + c * innerW, by + 6, innerW - 4, bh - 12);
      }

      const pct = Math.round((f / totalFrames) * 100);
      ctx.font = 'bold 11px monospace';
      ctx.fillText(`CHARGING ${pct}%`, bx, by - 10);

    } else if (sampleType === 'sinewave') {
      // Oscilloscope Sine Waves
      ctx.lineWidth = 2;

      // Axis reticle
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(0, height / 2); ctx.lineTo(width, height / 2);
      ctx.moveTo(width / 2, 0); ctx.lineTo(width / 2, height);
      ctx.stroke();
      ctx.setLineDash([]);

      // Wave 1
      ctx.beginPath();
      for (let x = 0; x < width; x += 2) {
        const y = height / 2 + Math.sin((x * 0.05) + (f * 0.2)) * 32;
        if (x === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.stroke();

      ctx.font = 'bold 10px monospace';
      ctx.fillText('OSCILLOSCOPE // 1.2kHz SINE', 10, 18);

    } else if (sampleType === 'ripple') {
      // Radar Concentric Circles
      const cx = width / 2;
      const cy = height / 2;

      ctx.lineWidth = 2;
      for (let r = 0; r < 3; r++) {
        const radius = ((r * 20 + f * 2.5) % 65);
        ctx.beginPath();
        ctx.arc(cx, cy, radius, 0, Math.PI * 2);
        ctx.stroke();
      }

      // Radar sweep line
      const sweepAngle = (f / totalFrames) * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx + Math.cos(sweepAngle) * 60, cy + Math.sin(sweepAngle) * 60);
      ctx.stroke();

      ctx.font = 'bold 10px monospace';
      ctx.fillText('RADAR SCAN // TARGET ACQUIRED', 10, 18);

    } else if (sampleType === 'analogclock') {
      // Analog Clock
      const cx = width / 2;
      const cy = height / 2;
      const r = 48;

      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.stroke();

      // 12 Ticks
      for (let t = 0; t < 12; t++) {
        const angle = (t / 12) * Math.PI * 2;
        const x1 = cx + Math.cos(angle) * (r - 6);
        const y1 = cy + Math.sin(angle) * (r - 6);
        const x2 = cx + Math.cos(angle) * r;
        const y2 = cy + Math.sin(angle) * r;
        ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
      }

      // Hands
      const secAngle = (f / totalFrames) * Math.PI * 2 - Math.PI / 2;
      const minAngle = (f / (totalFrames * 12)) * Math.PI * 2 - Math.PI / 2;

      // Second hand
      ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + Math.cos(secAngle) * 38, cy + Math.sin(secAngle) * 38); ctx.stroke();
      // Minute hand
      ctx.lineWidth = 4;
      ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + Math.cos(minAngle) * 28, cy + Math.sin(minAngle) * 28); ctx.stroke();

    } else if (sampleType === 'starfield') {
      // 3D Hyperspace Starfield
      const numStars = 70;
      for (let s = 0; s < numStars; s++) {
        const speed = (s % 5) + 1;
        const starX = (s * 37 + f * speed * 5) % width;
        const starY = (s * 19) % height;
        const starSize = Math.min(4, speed);
        ctx.fillRect(starX, starY, starSize, starSize);
      }

      ctx.font = 'bold 10px monospace';
      ctx.fillText('STARFIELD WARP', 10, 18);

    } else if (sampleType === 'matrix') {
      // Matrix Digital Rain
      ctx.fillStyle = '#00FF66';
      ctx.font = 'bold 11px monospace';
      const cols = Math.floor(width / 14);
      for (let c = 0; c < cols; c++) {
        const dropY = ((f * 6 + c * 19) % (height + 20)) - 10;
        const char = String.fromCharCode(0x30A0 + ((c + f) % 60));
        ctx.fillText(char, c * 14, dropY);
      }

    } else if (sampleType === 'rain') {
      // Rain & Lightning
      const numDrops = 40;
      ctx.lineWidth = 1;
      for (let r = 0; r < numDrops; r++) {
        const rx = (r * 23) % width;
        const ry = (r * 17 + f * 9) % height;
        ctx.beginPath();
        ctx.moveTo(rx, ry);
        ctx.lineTo(rx - 2, ry + 12);
        ctx.stroke();
      }

      ctx.font = 'bold 10px monospace';
      ctx.fillText('RAIN STORM // 100% PRECIP', 10, 18);

    } else if (sampleType === 'dvd') {
      // DVD Bouncing Screen Saver
      const bw = 64;
      const bh = 32;
      const speedX = 3.5;
      const speedY = 2.2;
      let bx = Math.abs((f * speedX) % (width * 2 - bw * 2));
      if (bx > width - bw) bx = (width - bw) * 2 - bx;
      let by = Math.abs((f * speedY) % (height * 2 - bh * 2));
      if (by > height - bh) by = (height - bh) * 2 - by;

      ctx.lineWidth = 2;
      ctx.strokeRect(bx, by, bw, bh);
      ctx.font = 'bold 12px monospace';
      ctx.fillText('DVD', bx + 18, by + 20);

    } else if (sampleType === 'cube3d') {
      // 3D Wireframe Polyhedron (Cube)
      const vertices = [
        [-35,-35,-35], [35,-35,-35], [35,35,-35], [-35,35,-35],
        [-35,-35,35],  [35,-35,35],  [35,35,35],  [-35,35,35]
      ];
      const edges = [
        [0,1],[1,2],[2,3],[3,0], [4,5],[5,6],[6,7],[7,4], [0,4],[1,5],[2,6],[3,7]
      ];

      const rx = f * 0.07;
      const ry = f * 0.09;
      const proj = vertices.map(([x, y, z]) => {
        const y1 = y * Math.cos(rx) - z * Math.sin(rx);
        const z1 = y * Math.sin(rx) + z * Math.cos(rx);
        const x2 = x * Math.cos(ry) + z1 * Math.sin(ry);
        const z2 = -x * Math.sin(ry) + z1 * Math.cos(ry);
        const fov = 120;
        const dz = 120;
        const px = width / 2 + (x2 * fov) / (z2 + dz);
        const py = height / 2 + (y1 * fov) / (z2 + dz);
        return [px, py];
      });

      ctx.lineWidth = 2;
      ctx.beginPath();
      edges.forEach(([u, v]) => {
        ctx.moveTo(proj[u][0], proj[u][1]);
        ctx.lineTo(proj[v][0], proj[v][1]);
      });
      ctx.stroke();

      ctx.font = 'bold 10px monospace';
      ctx.fillText('3D WIREFRAME CUBE', 10, 18);

    } else if (sampleType === 'flame') {
      // Doom Fire Generator
      ctx.fillStyle = '#FFFFFF';
      for (let x = 0; x < width; x += 6) {
        const h = Math.abs(Math.sin((x * 0.05) + f * 0.3) * (height - 20) + Math.cos(x * 0.1) * 15);
        ctx.fillRect(x, height - h, 5, h);
      }
      ctx.font = 'bold 10px monospace';
      ctx.fillText('DOOM FIRE SIMULATION', 10, 18);

    } else if (sampleType === 'plasma') {
      // Dithered Plasma Shader
      const step = 8;
      ctx.fillStyle = '#FFFFFF';
      for (let y = 0; y < height; y += step) {
        for (let x = 0; x < width; x += step) {
          const v1 = Math.sin(x / 20 + f * 0.1);
          const v2 = Math.sin(y / 15 - f * 0.1);
          const v3 = Math.sin((x + y) / 25 + f * 0.1);
          const val = (v1 + v2 + v3 + 3) / 6;
          if (val > 0.5) {
            ctx.fillRect(x, y, step - 1, step - 1);
          }
        }
      }
      ctx.font = 'bold 10px monospace';
      ctx.fillText('PLASMA SHADER', 10, 18);

    } else if (sampleType === 'fireworks') {
      // Fireworks Particles
      const cx = width / 2;
      const cy = height / 2;
      const numParticles = 30;
      for (let p = 0; p < numParticles; p++) {
        const angle = (p / numParticles) * Math.PI * 2;
        const radius = (f * 4) % (height * 0.7);
        const px = cx + Math.cos(angle) * radius;
        const py = cy + Math.sin(angle) * radius + (radius * radius * 0.005); // gravity
        ctx.fillRect(px, py, 3, 3);
      }
      ctx.font = 'bold 10px monospace';
      ctx.fillText('FIREWORKS BURST', 10, 18);

    } else if (sampleType === 'roboeyes') {
      // Expressive RoboEyes (Robot Face)
      const eyeW = 55;
      const eyeH = 65;
      const spacing = 30;
      const leftX = width / 2 - spacing / 2 - eyeW;
      const rightX = width / 2 + spacing / 2;
      const eyeY = (height - eyeH) / 2;

      // Blink handling
      const blinkCycle = f % 30;
      const currentH = (blinkCycle >= 27) ? 4 : eyeH;

      ctx.fillRect(leftX, eyeY + (eyeH - currentH) / 2, eyeW, currentH);
      ctx.fillRect(rightX, eyeY + (eyeH - currentH) / 2, eyeW, currentH);

      ctx.font = 'bold 10px monospace';
      ctx.fillText('ROBO-EYES EXPRESSIONS', 10, 18);

    } else if (sampleType === 'spirograph') {
      // Spirograph Roulette Curves
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      const R = 45;
      const r = 18;
      const rho = 30;
      const cx = width / 2;
      const cy = height / 2;

      for (let theta = 0; theta < Math.PI * 8; theta += 0.1) {
        const x = cx + (R - r) * Math.cos(theta + f * 0.05) + rho * Math.cos(((R - r) / r) * (theta + f * 0.05));
        const y = cy + (R - r) * Math.sin(theta + f * 0.05) - rho * Math.sin(((R - r) / r) * (theta + f * 0.05));
        if (theta === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();

      ctx.font = 'bold 10px monospace';
      ctx.fillText('SPIROGRAPH HYPOTROCHOID', 10, 18);

    } else if (sampleType === 'qrcode') {
      // Dynamic QR Code + Laser Scanner
      const qrSize = 80;
      const qx = (width - qrSize) / 2;
      const qy = (height - qrSize) / 2;

      // Draw synthetic QR matrix
      ctx.lineWidth = 2;
      ctx.strokeRect(qx, qy, qrSize, qrSize);
      // Finder patterns
      ctx.fillRect(qx + 4, qy + 4, 20, 20);
      ctx.fillRect(qx + qrSize - 24, qy + 4, 20, 20);
      ctx.fillRect(qx + 4, qy + qrSize - 24, 20, 20);

      // Moving laser scan line
      const laserY = qy + ((f * 4) % qrSize);
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(qx - 10, laserY);
      ctx.lineTo(qx + qrSize + 10, laserY);
      ctx.stroke();

      ctx.font = 'bold 10px monospace';
      ctx.fillText('QR SCANNER // LASER WIPE', 10, 18);

    } else {
      // Bad Apple / High Contrast Silhouette
      ctx.fillRect(20, 20, width - 40, height - 40);
      ctx.fillStyle = '#000000';
      const radius = 20 + Math.sin(f * 0.2) * 15;
      ctx.beginPath();
      ctx.arc(width / 2, height / 2, radius, 0, Math.PI * 2);
      ctx.fill();
    }

    const imgData = ctx.getImageData(0, 0, width, height);
    frames.push({
      index: f,
      timestampMs: (f / targetFps) * 1000,
      durationMs: (1 / targetFps) * 1000,
      imageData: imgData
    });
  }

  const sampleNames: Record<SamplePresetType, string> = {
    dino: '🦖 Dino Runner (Official Sprites)',
    heartbeat: '💓 ECG Heartbeat Waveform',
    spinner: '🔄 Loading Spinner Arc',
    wificonnect: '📶 WiFi Connecting Signal',
    bouncing: '📀 Bouncing OLED Logo',
    pacman: '👾 Pac-Man Chomping Loop',
    battery: '🔋 Battery Charging Indicator',
    sinewave: '🌊 Sine Wave Oscilloscope',
    ripple: '🎯 Radar Ripple Scan',
    analogclock: '🕒 Analog Clock Hands',
    starfield: '🌌 Starfield Hyperspace',
    matrix: '🟩 Matrix Digital Rain',
    rain: '🌧 Rain Storm Animation',
    badapple: '🍎 Bad Apple Silhouette',
    dvd: '📀 DVD Bouncing Screen Saver',
    cube3d: '🎲 3D Wireframe Polyhedron',
    flame: '🔥 Doom Fire Generator',
    plasma: '⚡ Dithered Plasma Shader',
    fireworks: '🎆 Fireworks Spark Burst',
    roboeyes: '🤖 Expressive Robo-Eyes',
    spirograph: '🌀 Spirograph Roulette Curve',
    qrcode: '🏁 QR Code Laser Scanner'
  };

  return {
    sourceInfo: {
      type: 'sequence',
      filename: sampleNames[sampleType],
      sourceWidth: width,
      sourceHeight: height,
      frameCount: frames.length,
      fps: targetFps,
      durationMs: (totalFrames / targetFps) * 1000
    },
    frames
  };
}
