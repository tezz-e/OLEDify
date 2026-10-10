import { HL } from './hairlineKernel.js';

const {
  Cam, clamp, facing, prism, proj, rings, circ, spring, stepS,
  mk, pointer, put, register, disposer, solid, poly, open, seg,
  extremes, rrect, fillet, ringAt,
} = HL;

// ─────────────────────────────────────────────────────────────────────────────
// Panoramic Hardware Pipeline Test Bench: ViewBox 800 × 160
//
// Technical Signal Chain:
// HOST PC ──[USB 921.6K BAUD]──> ESP32-S3 ──[I²C 400 KHZ]──> SSD1306 OLED
//
// Ground Coordinates (z = 0):
// 1. Host PC:     (-146, 126) to (-126, 146)  [screen sx ≈ 25..55]
// 2. USB-C Link:  (-126, 136) to (-92, 92)    [screen sx ≈ 55..135]
// 3. ESP32-S3:    (-92, 52) to (-52, 92)      [screen sx ≈ 138..238]
// 4. I²C Bus:     (-46, 66..78) to (46, -78..-66) [screen sx ≈ 220..580]
// 5. SSD1306:     (54, -90) to (90, -54)      [screen sx ≈ 565..665, glass to 720]
// ─────────────────────────────────────────────────────────────────────────────

const TG = 2.0, TIC = 1.2, TFPC = 1.0, TPCB = 2.0;
const REST_EXPLODE = [1.2, 0.35, 0.35];

export const formatBaudRate = (b) => {
  if (b === 921600) return "921.6K";
  if (b === 115200) return "115.2K";
  if (b >= 1000000) return `${(b / 1000000).toFixed(1)}M`;
  return `${(b / 1000).toFixed(1)}K`;
};

export const getPipelineLabel = (connected, streaming, fps = 30, baud = 921600) => {
  if (!connected) {
    return "Standby · USB disconnected";
  }
  if (!streaming) {
    return `Connected · ${formatBaudRate(baud)} baud · Idle`;
  }
  return `Streaming · ${formatBaudRate(baud)} baud · ${fps} fps`;
};

export const NAMES = [
  "Host workstation · WebSerial CDC interface",
  "USB-C 2.0 · 921.6K baud serial",
  "ESP32-S3 · 240 MHz dual-core controller",
  "I2C bus · 400 kHz fast mode",
  "SSD1306 · 0.96″ 128×64 mono OLED (exploded)"
];

const atPt = (ring, cx, cy) => ring.map((q) => ({ ...q, u: q.u + cx, v: q.v + cy }));

function bezierPoint(p0, p1, p2, p3, t) {
  const mt = 1 - t;
  const mt2 = mt * mt;
  const mt3 = mt2 * mt;
  const t2 = t * t;
  const t3 = t2 * t;
  return [
    mt3 * p0[0] + 3 * mt2 * t * p1[0] + 3 * mt * t2 * p2[0] + t3 * p3[0],
    mt3 * p0[1] + 3 * mt2 * t * p1[1] + 3 * mt * t2 * p2[1] + t3 * p3[1]
  ];
}

function bases(g) {
  const b = [0], t = [TPCB, TFPC, TIC];
  for (let j = 0; j < 3; j++) b.push(b[j] + t[j] + g[j]);
  const mid = (b[3] + TG) / 2;
  return b.map((z) => z - mid);
}

export function mountOledBench(
  { stage, svg, read },
  options = {}
) {
  const bag = disposer();
  let GAP = 24, share = null, act = -1;
  let isConnected = Boolean(options.serialConnected);
  let isStreaming = Boolean(options.isStreaming);
  let baudRate = options.baudRate || 921600;
  let targetFps = options.targetFps || 30;
  let packetPhase = 0;

  // ViewBox: 0 0 760 160.
  // Scaled & centered camera parameters with ample inner margins:
  // PC icon on the left (minX > 68px) is never cut off
  // Exploded OLED stack on the right (minY > 10px) never touches top toolbar
  const C = Cam(45, 0.5, 1.75);
  C.ox = 430;
  C.oy = 96;
  const P = proj(C), front = facing(C);
  const flat = (pts, z) => poly(pts.map(([x, y]) => P(x, y, z)));

  const g = mk("g", {}, svg);
  g.style.transition = "opacity 320ms cubic-bezier(0.4, 0, 0.2, 1)";
  g.style.opacity = isConnected ? "1.0" : "0.75";

  // ─────────────────────────────────────────────────────────────
  // 0. BENCH SURFACE & ALIGNMENT GUIDES (Backdrop at z = 0)
  // ─────────────────────────────────────────────────────────────
  const benchGuides = mk("g", { class: "nf lo" }, g);
  
  // Dashed centerline connecting host PC to display
  const pStart = P(-136, 136, 0), pEnd = P(90, -90, 0);
  mk("path", { class: "nf dash", d: `M${pStart[0]} ${pStart[1]} L${pEnd[0]} ${pEnd[1]}` }, benchGuides);

  // Benchmark fiducial crosses (+) on ground plane
  [[-136, 136], [-72, 72], [0, 0], [72, -72]].forEach(([fx, fy]) => {
    const cp = P(fx, fy, 0);
    const d = `M${cp[0] - 3.5} ${cp[1]} L${cp[0] + 3.5} ${cp[1]} M${cp[0]} ${cp[1] - 3.5} L${cp[0]} ${cp[1] + 3.5}`;
    mk("path", { class: "nf lo", d }, benchGuides);
  });

  // ─────────────────────────────────────────────────────────────
  // 1. HOST WORKSTATION PC (FAR LEFT, sx ≈ 25..55)
  // Footprint: (-146, 126) to (-126, 146)
  // ─────────────────────────────────────────────────────────────
  const pcG = mk("g", {}, g);
  const pcChassis = solid(pcG);
  const [pcR, pcI] = rings(-146, 126, -126, 146, 2.8, 0.8);
  put(pcChassis, prism(P, front, pcR, pcI, 0, 3.8));

  // PC Deck contour / trackpad outline
  const pcDeck = mk("path", { class: "nf lo" }, pcG);
  const [dkR] = rings(-142, 130, -130, 142, 1.2, 0.4);
  pcDeck.setAttribute("d", poly(ringAt(P, dkR, 3.8)));

  // PC Power / USB Status LED
  const pcPwrLed = mk("path", { class: isStreaming ? "nf hi" : (isConnected ? "nf" : "nf lo") }, pcG);
  pcPwrLed.setAttribute("d", poly(ringAt(P, atPt(circ(0.9, 8), -141, 129), 3.8)));

  // PC USB-C Port receptacle
  const pcPort = solid(pcG);
  const [portR, portI] = rings(-127.5, 134, -124.5, 138, 0.8, 0.2);
  put(pcPort, prism(P, front, portR, portI, 0.8, 2.8));

  // ─────────────────────────────────────────────────────────────
  // 2. USB-C 2.0 SERIAL LINK CABLE (sx ≈ 55..135)
  // From PC port (-124.5, 136) to ESP32 port (-92, 92)
  // ─────────────────────────────────────────────────────────────
  const ucg = mk("g", {}, g);
  const cablePath = mk("path", { class: isStreaming ? "nf hi" : (isConnected ? "nf" : "nf lo") }, ucg);
  cablePath.style.transition = "stroke 260ms ease";
  if (!isConnected) cablePath.style.strokeDasharray = "3 3";
  const usbP0 = P(-124.5, 136, 1.8);
  const usbP1 = P(-115, 128, 0.5);
  const usbP2 = P(-104, 110, 0.5);
  const usbP3 = P(-92, 92, 1.8);
  cablePath.setAttribute("d", `M${usbP0[0]} ${usbP0[1]} C${usbP1[0]} ${usbP1[1]} ${usbP2[0]} ${usbP2[1]} ${usbP3[0]} ${usbP3[1]}`);

  // Molded strain relief sleeve at ESP32 end
  const sleeve = solid(ucg);
  const [sleeveR, sleeveI] = rings(-99, 95, -93, 101, 1.4, 0.4);
  put(sleeve, prism(P, front, sleeveR, sleeveI, 0, 2.6));

  // USB Packet Indicator Dots (traveling from PC to ESP32)
  const usbPackets = [0, 1].map(() => {
    const dot = mk("circle", { r: "1.4", class: "dot" }, ucg);
    dot.style.opacity = isStreaming ? "1" : "0";
    dot.style.transition = "opacity 200ms ease";
    return dot;
  });

  // ─────────────────────────────────────────────────────────────
  // 3. ESP32-S3 HOST MICROCONTROLLER (LEFT, sx ≈ 138..238)
  // Footprint: (-92, 52) to (-52, 92)
  // ─────────────────────────────────────────────────────────────
  const eg = mk("g", {}, g);
  const espPcb = solid(eg);
  const [eR, eI] = rings(-92, 52, -52, 92, 3.5, 1.4);
  put(espPcb, prism(P, front, eR, eI, 0, 2.2));

  // 4 PCB mounting holes
  [[-88, 56], [-56, 56], [-88, 88], [-56, 88]].forEach(([hx, hy]) => {
    const hole = mk("path", { class: "nf lo" }, eg);
    hole.setAttribute("d", poly(ringAt(P, atPt(circ(1.5, 10), hx, hy), 2.2)));
  });

  // Clean 7-Pin GPIO Headers (Fewer, thicker, non-noisy ticks)
  const gpioX = [-84, -79.2, -74.4, -69.6, -64.8, -60, -55.2];
  gpioX.forEach((x) => {
    // Top rail along y = 55.5
    const p1 = solid(eg), [r1, i1] = rings(x - 1.2, 54.3, x + 1.2, 56.7, 0.6, 0.2);
    put(p1, prism(P, front, r1, i1, 2.2, 5.0));
    // Bottom rail along y = 88.5
    const p2 = solid(eg), [r2, i2] = rings(x - 1.2, 87.3, x + 1.2, 89.7, 0.6, 0.2);
    put(p2, prism(P, front, r2, i2, 2.2, 5.0));
  });

  // ESP32-S3 SoC metal RF shield
  const soc = solid(eg);
  const [socR, socI] = rings(-81, 63, -63, 81, 2.0, 0.6);
  put(soc, prism(P, front, socR, socI, 2.2, 4.2));

  // Pin 1 dot on SoC shield
  const socDot = mk("path", { class: "nf lo" }, eg);
  socDot.setAttribute("d", poly(ringAt(P, atPt(circ(0.9, 8), -78, 66), 4.2)));

  // Ceramic PCB inverted-F antenna trace
  const antPath = mk("path", { class: "nf lo" }, eg);
  const antPts = [[-90, 64], [-84, 64], [-84, 80], [-90, 80]];
  antPath.setAttribute("d", open(antPts.map(([ax, ay]) => P(ax, ay, 2.2))));

  // Reset & Boot micro tactile buttons
  const rstBtn = solid(eg), [rbR, rbI] = rings(-59, 58, -55, 62, 0.8, 0.2);
  put(rstBtn, prism(P, front, rbR, rbI, 2.2, 3.6));
  const bootBtn = solid(eg), [bbR, bbI] = rings(-59, 82, -55, 86, 0.8, 0.2);
  put(bootBtn, prism(P, front, bbR, bbI, 2.2, 3.6));

  // Status LED indicators
  const pwrLed = mk("path", { class: isStreaming ? "nf hi" : (isConnected ? "nf" : "nf lo") }, eg);
  pwrLed.setAttribute("d", poly(ringAt(P, atPt(circ(0.9, 8), -60, 72), 2.2)));

  // ESP32 Dupont female connector shell
  const espDupont = solid(eg);
  const [edR, edI] = rings(-51, 64, -46, 80, 0.8, 0.3);
  put(espDupont, prism(P, front, edR, edI, 1.2, 6.2));

  // ─────────────────────────────────────────────────────────────
  // 4. 4-WIRE I²C BUS RIBBON & PROBE (CENTER, sx ≈ 220..580)
  // Wires: 0: GND, 1: VCC, 2: SCL (400kHz), 3: SDA (Data)
  // ─────────────────────────────────────────────────────────────
  const bg = mk("g", {}, g);
  
  // Dupont shell at OLED side (receiving bus)
  const oledDupont = solid(bg);
  const [odR, odI] = rings(46, -78, 51, -62, 0.8, 0.3);
  put(oledDupont, prism(P, front, odR, odI, 1.2, 6.2));

  const busWires = [0, 1, 2, 3].map((i) => {
    const path = mk("path", { class: "nf" }, bg);
    const y0 = 66 + i * 4;
    const y1 = -76 + i * 4;
    return { path, y0, y1, i };
  });

  // Logic Analyzer mini test probe clip clipped to SCL wire in center
  const probeG = mk("g", { class: "nf lo" }, bg);
  const pCenter = P(0, 0, -2.5);
  const probeClip = solid(probeG);
  const [prR, prI] = rings(-3, -2, 3, 2, 0.8, 0.2);
  put(probeClip, prism(P, front, prR, prI, -3.0, 1.5));
  const probeLead = mk("path", { class: "nf dash" }, probeG);
  const prLeadEnd = P(0, 24, 0);
  probeLead.setAttribute("d", `M${pCenter[0]} ${pCenter[1]} Q${pCenter[0]} ${pCenter[1] + 16} ${prLeadEnd[0]} ${prLeadEnd[1]}`);

  // I2C Signal Packet Indicator Dots
  const i2cPackets = [0, 1].map(() => {
    const dot = mk("circle", { r: "1.4", class: "dot" }, bg);
    dot.style.opacity = isStreaming ? "1" : "0";
    dot.style.transition = "opacity 200ms ease";
    return dot;
  });

  function drawBusWires() {
    busWires.forEach(({ path, y0, y1, i }) => {
      const p0 = P(-46, y0, 3.5);
      const p1 = P(-10, (y0 + y1) / 2 + 18, -2.5 - i * 0.8);
      const p2 = P(15, (y0 + y1) / 2 - 14, -2.5 - i * 0.8);
      const p3 = P(46, y1, 3.5);
      const d = `M${p0[0]} ${p0[1]} C${p1[0]} ${p1[1]} ${p2[0]} ${p2[1]} ${p3[0]} ${p3[1]}`;
      path.setAttribute("d", d);
      // SCL (2) and SDA (3) signal traces: bright amber when streaming or bus is hovered
      const isSig = (i === 2 || i === 3);
      if (act === 3) {
        path.setAttribute("class", "nf hi");
      } else if (act < 0) {
        if (isStreaming && isSig) {
          path.setAttribute("class", "nf hi");
        } else if (isConnected) {
          path.setAttribute("class", "nf");
        } else {
          path.setAttribute("class", isSig ? "nf lo" : "nf");
        }
      } else {
        path.setAttribute("class", isConnected ? "nf" : "nf lo");
      }
    });
  }

  // ─────────────────────────────────────────────────────────────
  // 5. REALISTIC 4-PIN 0.96" SSD1306 BREAKOUT (RIGHT, sx ≈ 565..720)
  // Pin Header: [GND, VCC, SCL, SDA] along top edge
  // Footprint: (54, -90) to (90, -54) (36x36 mm scale)
  // ─────────────────────────────────────────────────────────────
  const og = mk("g", {}, g);
  const ox0 = 54, oy0 = -90, ow = 36, ol = 36;
  const pcbOuter = rrect(ox0, oy0, ox0 + ow, oy0 + ol, 3.0, 6);
  const ext = extremes(P, pcbOuter).slice(0, 2);
  const guide = mk("path", { class: "nf dash" }, og);

  // Layer 0: OLED PCB Breakout Board (Base)
  const g0 = mk("g", {}, og), pcb = solid(g0);
  const [pcbR, pcbI] = rings(ox0, oy0, ox0 + ow, oy0 + ol, 3.0, 1.4);
  
  // Real 4-pin header [GND, VCC, SCL, SDA] along inner connector edge
  const oledPins = [-76, -72, -68, -64].map((y) => {
    const post = solid(g0), [pR, pI] = rings(52.8, y - 1.1, 55.2, y + 1.1, 0.6, 0.2);
    return { post, pR, pI, x: 54, y };
  });

  // 4 corner M2 mounting holes
  const holes = [
    [ox0 + 3.2, oy0 + 3.2], [ox0 + ow - 3.2, oy0 + 3.2],
    [ox0 + 3.2, oy0 + ol - 3.2], [ox0 + ow - 3.2, oy0 + ol - 3.2]
  ].map(([x, y]) => ({
    el: mk("path", { class: "nf lo" }, g0), ring: atPt(circ(1.4, 10), x, y),
  }));

  // SMD 4.7kΩ I2C pullup resistors and capacitor package
  const smdRes = solid(g0);
  const [smdR, smdI] = rings(ox0 + 6, oy0 + 8, ox0 + 12, oy0 + 12, 0.5, 0.2);

  // Layer 1: Orange FPC Flex Ribbon (folds from glass bottom to PCB)
  const g1 = mk("g", {}, og), flex = solid(g1);
  const [fR, fI] = rings(ox0 + 8, oy0 + 6, ox0 + 28, oy0 + 18, 1.0, 0.4);
  const traces = mk("path", { class: "nf lo" }, g1);

  // Layer 2: SSD1306 Chip-on-Glass (COG) driver IC die on bottom glass lip
  const g2 = mk("g", {}, og), icDie = solid(g2);
  const [icR, icI] = rings(ox0 + 11, oy0 + 10, ox0 + 25, oy0 + 14, 0.6, 0.2);
  const bonds = mk("path", { class: "nf lo" }, g2);

  // Layer 3: Front 0.96" OLED Cover Glass with 128x64 Active Frame
  const g3 = mk("g", {}, og), glass = solid(g3);
  const gx0 = ox0 + 3, gy0 = oy0 + 5, gx1 = ox0 + ow - 3, gy1 = oy0 + ol - 3;
  const gOuter = rrect(gx0, gy0, gx1, gy1, 1.8, 6);
  const gInner = rrect(gx0 + 0.8, gy0 + 0.8, gx1 - 0.8, gy1 - 0.8, 1.2, 6);
  const bezel = rrect(gx0 + 1.8, gy0 + 1.8, gx1 - 1.8, gy1 - 1.8, 0.8, 4);
  const bezelPath = mk("path", { class: "nf lo" }, g3);
  
  // 128x64 Active Display Area (exact 2:1 ratio: 24 x 12 units)
  const dispPoly = fillet([
    [ox0 + 6, oy0 + 14], [ox0 + 30, oy0 + 14],
    [ox0 + 30, oy0 + 26], [ox0 + 6, oy0 + 26]
  ], [0.8, 0.8, 0.8, 0.8]);
  const dispPath = mk("path", { class: "nf hi" }, g3);
  
  // Reticle crosshair inside display
  const reticle = rrect(ox0 + 15, oy0 + 18, ox0 + 21, oy0 + 22, 0.5, 4);
  const reticlePath = mk("path", { class: "nf lo" }, g3);

  function drawTraces(z) {
    let d = "";
    for (let x = ox0 + 11; x <= ox0 + 25; x += 2.4) d += seg(P(x, oy0 + 7, z), P(x, oy0 + 17, z));
    return d;
  }

  function drawBonds(z) {
    let d = "";
    for (let x = ox0 + 13; x <= ox0 + 23; x += 1.8) d += seg(P(x, oy0 + 10, z), P(x, oy0 + 8, z - 0.3));
    return d;
  }

  const oledDraw = [
    (z) => {
      put(pcb, prism(P, front, pcbR, pcbI, z, z + TPCB));
      put(smdRes, prism(P, front, smdR, smdI, z + TPCB, z + TPCB + 0.7));
      holes.forEach((h) => h.el.setAttribute("d", poly(ringAt(P, h.ring, z + TPCB))));
      oledPins.forEach((p) => {
        put(p.post, prism(P, front, p.pR, p.pI, z + TPCB, z + TPCB + 3.8));
      });
    },
    (z) => {
      put(flex, prism(P, front, fR, fI, z, z + TFPC));
      traces.setAttribute("d", drawTraces(z + TFPC));
    },
    (z) => {
      put(icDie, prism(P, front, icR, icI, z, z + TIC));
      bonds.setAttribute("d", drawBonds(z + TIC * 0.5));
    },
    (z) => {
      put(glass, prism(P, front, gOuter, gInner, z, z + TG));
      const t = z + TG;
      bezelPath.setAttribute("d", poly(ringAt(P, bezel, t)));
      dispPath.setAttribute("d", flat(dispPoly, t));
      reticlePath.setAttribute("d", poly(ringAt(P, reticle, t)));
    },
  ];

  const targets = () => [0, 1, 2].map((j) => GAP * (share === null ? REST_EXPLODE[j] : share));
  const gs = targets().map((t) => spring(t, { eps: 0.01 }));
  const drawn = [NaN, NaN, NaN, NaN];

  // ─────────────────────────────────────────────────────────────
  // 6. ANIMATION LOOP: Physics + Data Packet Transmission Stream
  // ─────────────────────────────────────────────────────────────
  const B = register(stage, (dt) => {
    // 1. Advance data packets along wires ONLY when actively streaming frames
    if (isStreaming) {
      const pSpeed = (targetFps / 30) * 1.35;
      packetPhase = (packetPhase + dt * pSpeed) % 1.0;

      // USB packets (PC -> ESP32)
      usbPackets.forEach((el, idx) => {
        el.style.opacity = "1";
        const u = (packetPhase + idx * 0.5) % 1.0;
        const pt = bezierPoint(usbP0, usbP1, usbP2, usbP3, u);
        el.setAttribute("cx", String(pt[0].toFixed(1)));
        el.setAttribute("cy", String(pt[1].toFixed(1)));
        el.setAttribute("class", "dot");
      });

      // I2C packets on SCL and SDA (ESP32 -> OLED)
      const sclP0 = P(-46, 74, 3.5), sclP1 = P(-10, 8, -4.1), sclP2 = P(15, -24, -4.1), sclP3 = P(46, -68, 3.5);
      const sdaP0 = P(-46, 78, 3.5), sdaP1 = P(-10, 10, -4.9), sdaP2 = P(15, -22, -4.9), sdaP3 = P(46, -64, 3.5);
      const ptScl = bezierPoint(sclP0, sclP1, sclP2, sclP3, packetPhase);
      const ptSda = bezierPoint(sdaP0, sdaP1, sdaP2, sdaP3, (packetPhase + 0.5) % 1.0);
      i2cPackets[0].style.opacity = "1";
      i2cPackets[0].setAttribute("cx", String(ptScl[0].toFixed(1)));
      i2cPackets[0].setAttribute("cy", String(ptScl[1].toFixed(1)));
      i2cPackets[1].style.opacity = "1";
      i2cPackets[1].setAttribute("cx", String(ptSda[0].toFixed(1)));
      i2cPackets[1].setAttribute("cy", String(ptSda[1].toFixed(1)));
    } else {
      usbPackets.forEach((el) => { el.style.opacity = "0"; });
      i2cPackets.forEach((el) => { el.style.opacity = "0"; });
    }

    // 2. Step spring physics for exploded display layers
    const T = targets();
    let m = isStreaming; // Keep continuous packet stream awake only while streaming
    for (let j = 0; j < 3; j++) { gs[j].t = T[j]; if (stepS(gs[j], dt)) m = true; }
    const b = bases(gs.map((s) => s.x));
    let changed = false;
    b.forEach((z, i) => { if (z !== drawn[i]) { drawn[i] = z; oledDraw[i](z); changed = true; } });
    if (changed) guide.setAttribute("d", ext.map((q) => seg(P(q.u, q.v, b[0]), P(q.u, q.v, b[3] + TG))).join(""));
    return m;
  });
  bag.add(B.unregister);

  drawBusWires();

  function setActive(k) {
    if (k === act) return;
    act = k;
    pcChassis.sil.classList.toggle("hi", act === 0);
    cablePath.classList.toggle("hi", act === 1 || isStreaming);
    espPcb.sil.classList.toggle("hi", act === 2);
    soc.sil.classList.toggle("hi", act === 2);
    espDupont.sil.classList.toggle("hi", act === 3);
    oledDupont.sil.classList.toggle("hi", act === 3);
    glass.sil.classList.toggle("hi", act === 4);
    dispPath.classList.toggle("hi", act === -1 || act === 4);
    drawBusWires();
    if (read) read.textContent = act < 0 ? getPipelineLabel(isConnected, isStreaming, targetFps, baudRate) : NAMES[act];
    B.wake();
  }

  if (read) read.textContent = getPipelineLabel(isConnected, isStreaming, targetFps, baudRate);

  bag.add(pointer(stage, {
    move: (p) => {
      // Scaled thresholds mapping to [0..400] x [0..320]
      if (p[0] < 50) {
        share = null;
        setActive(0);
      } else if (p[0] < 105) {
        share = null;
        setActive(1);
      } else if (p[0] < 175) {
        share = null;
        setActive(2);
      } else if (p[0] < 275) {
        share = 0.4;
        setActive(3);
      } else {
        share = clamp((p[0] - 275) / 105, 0.2, 1.0);
        setActive(4);
      }
    },
    leave: () => { share = null; setActive(-1); },
  }));
  bag.add(() => svg.replaceChildren());

  return {
    set: (v) => { GAP = v; B.wake(); },
    update: (opts = {}) => {
      if (opts.serialConnected !== undefined) isConnected = Boolean(opts.serialConnected);
      if (opts.isStreaming !== undefined) isStreaming = Boolean(opts.isStreaming);
      if (opts.baudRate !== undefined) baudRate = opts.baudRate;
      if (opts.targetFps !== undefined) targetFps = opts.targetFps;

      g.style.opacity = isConnected ? "1.0" : "0.75";
      pcPwrLed.setAttribute("class", isStreaming ? "nf hi" : (isConnected ? "nf" : "nf lo"));
      cablePath.setAttribute("class", isStreaming ? "nf hi" : (isConnected ? "nf" : "nf lo"));
      cablePath.style.strokeDasharray = isConnected ? "none" : "3 3";
      pwrLed.setAttribute("class", isStreaming ? "nf hi" : (isConnected ? "nf" : "nf lo"));

      if (!isStreaming) {
        usbPackets.forEach((el) => { el.style.opacity = "0"; });
        i2cPackets.forEach((el) => { el.style.opacity = "0"; });
      } else {
        usbPackets.forEach((el) => { el.style.opacity = "1"; });
        i2cPackets.forEach((el) => { el.style.opacity = "1"; });
      }

      drawBusWires();
      if (read && act < 0) {
        read.textContent = getPipelineLabel(isConnected, isStreaming, targetFps, baudRate);
      }
      B.wake();
    },
    destroy: bag.dispose
  };
}
