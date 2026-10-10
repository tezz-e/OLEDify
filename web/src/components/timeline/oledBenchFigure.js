import { HL } from './hairlineKernel.js';

const {
  Cam, clamp, facing, prism, proj, rings, circ, spring, stepS,
  mk, pointer, put, register, disposer, solid, poly, open, seg,
  extremes, rrect, fillet, ringAt,
} = HL;

// ─────────────────────────────────────────────────────────────────────────────
// Panoramic Hardware Test Bench: ViewBox 800 × 160
// Ground plane coordinates:
// USB-C Host: (-140, 140) -> (-92, 92)  [screen sx ≈ 15..140]
// ESP32-S3:   (-92, 52) to (-52, 92)    [screen sx ≈ 138..238]
// I²C Bus:    (-46, 66..78) to (46, -78..-66) [screen sx ≈ 220..580]
// SSD1306:    (52, -92) to (92, -52)    [screen sx ≈ 562..662, up to 720]
// ─────────────────────────────────────────────────────────────────────────────

const TG = 2.0, TIC = 1.2, TFPC = 1.0, TPCB = 2.2, GMAX = 26;
const REST = [1.2, 0.35, 0.35];
const NAMES = [
  "esp32-s3 · host controller",
  "4-wire i2c · 921.6k baud dual-stream",
  "ssd1306 · 128×64 mono oled (exploded)"
];

const atPt = (ring, cx, cy) => ring.map((q) => ({ ...q, u: q.u + cx, v: q.v + cy }));

function bases(g) {
  const b = [0], t = [TPCB, TFPC, TIC];
  for (let j = 0; j < 3; j++) b.push(b[j] + t[j] + g[j]);
  const mid = (b[3] + TG) / 2;
  return b.map((z) => z - mid);
}

export function mountOledBench({ stage, svg, read }, value = 24) {
  const bag = disposer();
  let GAP = value, share = null, act = -1;

  // Wide panoramic camera: viewBox 800 x 160
  const C = Cam(45, 0.5, 2.05);
  C.ox = 400;
  C.oy = 78;
  const P = proj(C), front = facing(C);
  const flat = (pts, z) => poly(pts.map(([x, y]) => P(x, y, z)));

  const g = mk("g", {}, svg);

  // ─────────────────────────────────────────────────────────────
  // 0. BENCH SURFACE & ALIGNMENT GUIDES (Backdrop at z = 0)
  // ─────────────────────────────────────────────────────────────
  const benchGuides = mk("g", { class: "nf lo" }, g);
  
  // Dashed centerline connecting host to display
  const pStart = P(-110, 110, 0), pEnd = P(92, -92, 0);
  const axisGuide = mk("path", { class: "nf dash", d: `M${pStart[0]} ${pStart[1]} L${pEnd[0]} ${pEnd[1]}` }, benchGuides);

  // Benchmark fiducial crosses (+) on ground plane
  const fids = [[-110, 110], [-72, 72], [0, 0], [72, -72]].map(([fx, fy]) => {
    const cp = P(fx, fy, 0);
    const d = `M${cp[0] - 3.5} ${cp[1]} L${cp[0] + 3.5} ${cp[1]} M${cp[0]} ${cp[1] - 3.5} L${cp[0]} ${cp[1] + 3.5}`;
    return mk("path", { class: "nf lo", d }, benchGuides);
  });

  // ─────────────────────────────────────────────────────────────
  // 1. USB-C HOST CABLE & PLUG (FAR LEFT, sx ≈ 15..130)
  // ─────────────────────────────────────────────────────────────
  const ucg = mk("g", {}, g);
  // Flexible braided cable coming from left edge
  const cablePath = mk("path", { class: "nf lo" }, ucg);
  const cp0 = P(-138, 138, 0), cp1 = P(-125, 128, 0), cp2 = P(-116, 120, 0), cp3 = P(-106, 106, 0);
  cablePath.setAttribute("d", `M${cp0[0]} ${cp0[1]} C${cp1[0]} ${cp1[1]} ${cp2[0]} ${cp2[1]} ${cp3[0]} ${cp3[1]}`);

  // Molded strain relief sleeve
  const sleeve = solid(ucg);
  const [sleeveR, sleeveI] = rings(-107, 103, -99, 107, 1.6, 0.4);
  put(sleeve, prism(P, front, sleeveR, sleeveI, 0, 2.8));

  // USB-C metal plug inserting into receptacle
  const plug = solid(ucg);
  const [plugR, plugI] = rings(-99, 95, -92, 99, 1.2, 0.3);
  put(plug, prism(P, front, plugR, plugI, 0, 2.5));

  // ─────────────────────────────────────────────────────────────
  // 2. ESP32-S3 HOST MICROCONTROLLER (LEFT, sx ≈ 138..238)
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

  // Dual inline GPIO headers (Top rail & Bottom rail)
  for (let x = -86; x <= -58; x += 3.5) {
    // Top rail along y = 55.5
    const p1 = solid(eg), [r1, i1] = rings(x - 1.1, 54.4, x + 1.1, 56.6, 0.5, 0.2);
    put(p1, prism(P, front, r1, i1, 2.2, 5.0));
    // Bottom rail along y = 88.5
    const p2 = solid(eg), [r2, i2] = rings(x - 1.1, 87.4, x + 1.1, 89.6, 0.5, 0.2);
    put(p2, prism(P, front, r2, i2, 2.2, 5.0));
  }

  // ESP32-S3 SoC metal RF shield
  const soc = solid(eg);
  const [socR, socI] = rings(-81, 63, -63, 81, 2.0, 0.6);
  put(soc, prism(P, front, socR, socI, 2.2, 4.2));

  // Pin 1 dot on SoC shield
  const socDot = mk("path", { class: "nf lo" }, eg);
  socDot.setAttribute("d", poly(ringAt(P, atPt(circ(0.9, 8), -78, 66), 4.2)));

  // Ceramic PCB antenna trace
  const antPath = mk("path", { class: "nf lo" }, eg);
  const antPts = [[-90, 64], [-84, 64], [-84, 80], [-90, 80]];
  antPath.setAttribute("d", open(antPts.map(([ax, ay]) => P(ax, ay, 2.2))));

  // Reset & Boot micro tactile buttons
  const rstBtn = solid(eg), [rbR, rbI] = rings(-59, 58, -55, 62, 0.8, 0.2);
  put(rstBtn, prism(P, front, rbR, rbI, 2.2, 3.6));
  const bootBtn = solid(eg), [bbR, bbI] = rings(-59, 82, -55, 86, 0.8, 0.2);
  put(bootBtn, prism(P, front, bbR, bbI, 2.2, 3.6));

  // Status LED indicators
  const pwrLed = mk("path", { class: "nf hi" }, eg);
  pwrLed.setAttribute("d", poly(ringAt(P, atPt(circ(0.8, 8), -60, 72), 2.2)));

  // ESP32 4-pin I2C header pins (x = -53)
  const espPins = [66, 70, 74, 78].map((y) => {
    const post = solid(eg), [pR, pI] = rings(-54.2, y - 1.1, -51.8, y + 1.1, 0.6, 0.2);
    put(post, prism(P, front, pR, pI, 2.2, 6.0));
    return { x: -53, y };
  });

  // ESP32 Dupont female connector shell
  const espDupont = solid(eg);
  const [edR, edI] = rings(-51, 64, -46, 80, 0.8, 0.3);
  put(espDupont, prism(P, front, edR, edI, 1.2, 6.2));

  // ─────────────────────────────────────────────────────────────
  // 3. 4-WIRE I²C BUS RIBBON & LOGIC PROBE (CENTER, sx ≈ 220..580)
  // ─────────────────────────────────────────────────────────────
  const bg = mk("g", {}, g);
  
  // Dupont shell at OLED side (receiving bus)
  const oledDupont = solid(bg);
  const [odR, odI] = rings(46, -80, 51, -64, 0.8, 0.3);
  put(oledDupont, prism(P, front, odR, odI, 1.2, 6.2));

  const busWires = [0, 1, 2, 3].map((i) => {
    const path = mk("path", { class: "nf" }, bg);
    const y0 = 66 + i * 4;
    const y1 = -78 + i * 4;
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

  function drawBusWires() {
    busWires.forEach(({ path, y0, y1, i }) => {
      // Graceful catenary/bezier curve draping from ESP32 Dupont to OLED Dupont
      const p0 = P(-46, y0, 3.5);
      const p1 = P(-10, (y0 + y1) / 2 + 18, -2.5 - i * 0.8);
      const p2 = P(15, (y0 + y1) / 2 - 14, -2.5 - i * 0.8);
      const p3 = P(46, y1, 3.5);
      const d = `M${p0[0]} ${p0[1]} C${p1[0]} ${p1[1]} ${p2[0]} ${p2[1]} ${p3[0]} ${p3[1]}`;
      path.setAttribute("d", d);
      // SCL (2) and SDA (3) are bright amber when hovered or bus active
      const isSig = (i === 2 || i === 3);
      path.setAttribute("class", (act === 1 || (act < 0 && isSig)) ? "nf hi" : "nf");
    });
  }

  // ─────────────────────────────────────────────────────────────
  // 4. SSD1306 0.96" OLED DISPLAY MODULE (RIGHT, sx ≈ 562..720)
  // Centered at (72, -72), footprint (52, -92) to (92, -52)
  // ─────────────────────────────────────────────────────────────
  const og = mk("g", {}, g);
  const ox0 = 52, oy0 = -92, ow = 40, ol = 40;
  const pcbOuter = rrect(ox0, oy0, ox0 + ow, oy0 + ol, 3.5, 6);
  const ext = extremes(P, pcbOuter).slice(0, 2);
  const guide = mk("path", { class: "nf dash" }, og);

  // Layer 0: OLED PCB Carrier (Base)
  const g0 = mk("g", {}, og), pcb = solid(g0);
  const [pcbR, pcbI] = rings(ox0, oy0, ox0 + ow, oy0 + ol, 3.5, 1.4);
  const oledPins = [-78, -74, -70, -66].map((y) => {
    const post = solid(g0), [pR, pI] = rings(51.8, y - 1.1, 54.2, y + 1.1, 0.6, 0.2);
    return { post, pR, pI, x: 53, y };
  });
  const holes = [
    [ox0 + 3.5, oy0 + 3.5], [ox0 + ow - 3.5, oy0 + 3.5],
    [ox0 + 3.5, oy0 + ol - 3.5], [ox0 + ow - 3.5, oy0 + ol - 3.5]
  ].map(([x, y]) => ({
    el: mk("path", { class: "nf lo" }, g0), ring: atPt(circ(1.5, 10), x, y),
  }));

  // SMD passives on PCB (pull-up resistors)
  const smdRes = solid(g0);
  const [smdR, smdI] = rings(ox0 + 7, oy0 + 10, ox0 + 13, oy0 + 14, 0.6, 0.2);

  // Layer 1: FPC Ribbon Cable
  const g1 = mk("g", {}, og), flex = solid(g1);
  const [fR, fI] = rings(ox0 + 10, oy0 + 6, ox0 + 30, oy0 + 20, 1.2, 0.4);
  const traces = mk("path", { class: "nf lo" }, g1);

  // Layer 2: Chip-on-Glass (COG) driver IC die
  const g2 = mk("g", {}, og), icDie = solid(g2);
  const [icR, icI] = rings(ox0 + 14, oy0 + 11, ox0 + 26, oy0 + 15, 0.8, 0.3);
  const bonds = mk("path", { class: "nf lo" }, g2);

  // Layer 3: Front 0.96" OLED Cover Glass with 128x64 Active Frame
  const g3 = mk("g", {}, og), glass = solid(g3);
  const gx0 = ox0 + 3, gy0 = oy0 + 6, gx1 = ox0 + ow - 3, gy1 = oy0 + ol - 4;
  const gOuter = rrect(gx0, gy0, gx1, gy1, 2.0, 6);
  const gInner = rrect(gx0 + 1.0, gy0 + 1.0, gx1 - 1.0, gy1 - 1.0, 1.4, 6);
  const bezel = rrect(gx0 + 2.0, gy0 + 2.0, gx1 - 2.0, gy1 - 2.0, 1.0, 4);
  const bezelPath = mk("path", { class: "nf lo" }, g3);
  
  // 128x64 Active Display Area (exact 2:1 ratio: 26 x 13 units)
  const dispPoly = fillet([
    [ox0 + 7, oy0 + 16], [ox0 + 33, oy0 + 16],
    [ox0 + 33, oy0 + 29], [ox0 + 7, oy0 + 29]
  ], [1.0, 1.0, 1.0, 1.0]);
  const dispPath = mk("path", { class: "nf hi" }, g3);
  
  // Reticle crosshair inside display
  const reticle = rrect(ox0 + 17, oy0 + 20.5, ox0 + 23, oy0 + 24.5, 0.6, 4);
  const reticlePath = mk("path", { class: "nf lo" }, g3);

  function drawTraces(z) {
    let d = "";
    for (let x = ox0 + 13; x <= ox0 + 27; x += 2.8) d += seg(P(x, oy0 + 7, z), P(x, oy0 + 19, z));
    return d;
  }

  function drawBonds(z) {
    let d = "";
    for (let x = ox0 + 15; x <= ox0 + 25; x += 2.0) d += seg(P(x, oy0 + 11, z), P(x, oy0 + 9, z - 0.3));
    return d;
  }

  const oledDraw = [
    (z) => {
      put(pcb, prism(P, front, pcbR, pcbI, z, z + TPCB));
      put(smdRes, prism(P, front, smdR, smdI, z + TPCB, z + TPCB + 0.8));
      holes.forEach((h) => h.el.setAttribute("d", poly(ringAt(P, h.ring, z + TPCB))));
      oledPins.forEach((p) => {
        put(p.post, prism(P, front, p.pR, p.pI, z + TPCB, z + TPCB + 4.0));
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

  const targets = () => [0, 1, 2].map((j) => GAP * (share === null ? REST[j] : share));
  const gs = targets().map((t) => spring(t, { eps: 0.01 }));
  const drawn = [NaN, NaN, NaN, NaN];

  const B = register(stage, (dt) => {
    const T = targets();
    let m = false;
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
    espPcb.sil.classList.toggle("hi", act === 0);
    soc.sil.classList.toggle("hi", act === 0);
    espDupont.sil.classList.toggle("hi", act === 1);
    oledDupont.sil.classList.toggle("hi", act === 1);
    glass.sil.classList.toggle("hi", act === 2);
    dispPath.classList.toggle("hi", act === -1 || act === 2);
    drawBusWires();
    if (read) read.textContent = act < 0 ? "esp32-s3 ──[ 921.6k i2c ]──> ssd1306 oled" : NAMES[act];
    B.wake();
  }

  if (read) read.textContent = "esp32-s3 ──[ 921.6k i2c ]──> ssd1306 oled";

  bag.add(pointer(stage, {
    move: (p) => {
      // HL pointer scales stage to [0..400] x [0..320]
      // p[0] in [0..130]   -> ESP32-S3 focus (left 32%)
      // p[0] in [130..265] -> I2C Bus & probe focus (middle 34%)
      // p[0] in [265..400] -> OLED display focus & explode (right 34%)
      if (p[0] < 130) {
        share = null;
        setActive(0);
      } else if (p[0] < 265) {
        share = 0.4;
        setActive(1);
      } else {
        share = clamp((p[0] - 265) / 110, 0.2, 1.0);
        setActive(2);
      }
    },
    leave: () => { share = null; setActive(-1); },
  }));
  bag.add(() => svg.replaceChildren());

  return { set: (v) => { GAP = v; B.wake(); }, destroy: bag.dispose };
}
