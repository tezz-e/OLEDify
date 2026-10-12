import { HL } from './hairlineKernel.js';

const {
  Cam, clamp, facing, prism, proj, rings, circ, spring, stepS,
  mk, pointer, put, register, disposer, solid, poly, open, seg,
  extremes, rrect, fillet, ringAt,
} = HL;

// ─────────────────────────────────────────────────────────────────────────────
// Accurate Hardware Signal Chain Pipeline Test Bench: ViewBox 800 × 160
//
// Technical Signal Chain:
// HOST WORKSTATION ──[USB-C 921.6K BAUD]──> ESP32-S3-DevKitC-1 ──[I²C 400 KHZ]──> SSD1306 OLED
//
// Ground Coordinate System (z = 0):
// 1. Host Workstation:   (-150, 126) to (-126, 150)  [screen sx ≈ 20..60]
// 2. USB-C Cable:        (-125, 138) to (-94, 94)    [screen sx ≈ 60..130]
// 3. ESP32-S3-DevKitC-1: (-94, 46) to (-48, 94)      [screen sx ≈ 130..245]
// 4. 4-Wire I²C Harness: (-48, 62..74) to (48, -82..-70) [screen sx ≈ 245..575]
// 5. SSD1306 Breakout:   (50, -92) to (88, -54)      [screen sx ≈ 575..720]
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
  "ESP32-S3-DevKitC-1 · 240 MHz dual-core controller",
  "I²C bus · 400 kHz fast mode (GPIO 8 SDA / GPIO 9 SCL)",
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
  // Precise isometric camera: 45° angle, 2:1 isometric ratio (0.5), scale 1.82
  const C = Cam(45, 0.5, 1.82);
  C.ox = 405;
  C.oy = 96;
  const P = proj(C), front = facing(C);
  const flat = (pts, z) => poly(pts.map(([x, y]) => P(x, y, z)));

  const g = mk("g", {}, svg);
  g.style.transition = "opacity 320ms cubic-bezier(0.4, 0, 0.2, 1)";
  g.style.opacity = isConnected ? "1.0" : "0.75";

  // Reduced motion support
  const prefersReduced = typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (!prefersReduced) {
    const styleEl = document.createElementNS('http://www.w3.org/2000/svg', 'style');
    styleEl.textContent = `
      @keyframes benchDrawOutline {
        0% { opacity: 0; stroke-dasharray: 240; stroke-dashoffset: 240; }
        60% { opacity: 1; stroke-dashoffset: 0; }
        100% { opacity: 1; stroke-dasharray: none; stroke-dashoffset: 0; }
      }
      @keyframes benchFadeComponent {
        0% { opacity: 0; transform: translateY(1.5px); }
        100% { opacity: 1; transform: translateY(0); }
      }
      @keyframes benchDrawWire {
        0% { opacity: 0; stroke-dasharray: 300; stroke-dashoffset: 300; }
        100% { opacity: 1; stroke-dasharray: none; stroke-dashoffset: 0; }
      }
      .bench-anim-outline { animation: benchDrawOutline 480ms cubic-bezier(0.16, 1, 0.3, 1) forwards; }
      .bench-anim-component { animation: benchFadeComponent 420ms cubic-bezier(0.16, 1, 0.3, 1) 160ms forwards; }
      .bench-anim-wire { animation: benchDrawWire 480ms cubic-bezier(0.16, 1, 0.3, 1) 320ms forwards; }
    `;
    svg.appendChild(styleEl);
  }

  // ─────────────────────────────────────────────────────────────
  // 0. BENCH SURFACE & ALIGNMENT GUIDES (Backdrop at z = 0)
  // ─────────────────────────────────────────────────────────────
  const benchGuides = mk("g", { class: `nf lo ${prefersReduced ? '' : 'bench-anim-outline'}` }, g);
  
  // Dashed engineering datum centerline
  const pStart = P(-140, 140, 0), pEnd = P(92, -92, 0);
  mk("path", { class: "nf dash", d: `M${pStart[0]} ${pStart[1]} L${pEnd[0]} ${pEnd[1]}` }, benchGuides);

  // Technical fiducial crosses (+) on ground plane
  [[-138, 138], [-71, 70], [0, 0], [70, -70]].forEach(([fx, fy]) => {
    const cp = P(fx, fy, 0);
    const d = `M${cp[0] - 3.5} ${cp[1]} L${cp[0] + 3.5} ${cp[1]} M${cp[0]} ${cp[1] - 3.5} L${cp[0]} ${cp[1] + 3.5}`;
    mk("path", { class: "nf lo", d }, benchGuides);
  });

  // ─────────────────────────────────────────────────────────────
  // 1. HOST WORKSTATION PC (FAR LEFT, sx ≈ 20..60)
  // Footprint: (-150, 126) to (-126, 150)
  // ─────────────────────────────────────────────────────────────
  const pcG = mk("g", { class: prefersReduced ? '' : 'bench-anim-outline' }, g);
  const pcChassis = solid(pcG);
  const [pcR, pcI] = rings(-150, 126, -126, 150, 2.8, 0.8);
  put(pcChassis, prism(P, front, pcR, pcI, 0, 4.0));

  // PC Top Deck contour / ventilation grill line
  const pcDeck = mk("path", { class: "nf lo" }, pcG);
  const [dkR] = rings(-146, 130, -130, 146, 1.4, 0.4);
  pcDeck.setAttribute("d", poly(ringAt(P, dkR, 4.0)));

  // PC Power / WebSerial Active LED
  const pcPwrLed = mk("path", { class: isStreaming ? "nf hi" : (isConnected ? "nf" : "nf lo") }, pcG);
  pcPwrLed.setAttribute("d", poly(ringAt(P, atPt(circ(0.9, 8), -145, 129), 4.0)));

  // PC USB-C Port Receptacle (Authentic Type-C milled socket on PC right flank)
  const pcPort = solid(pcG);
  const [portR, portI] = rings(-128.5, 135.0, -125.0, 141.0, 1.0, 0.3);
  put(pcPort, prism(P, front, portR, portI, 0.8, 3.4));

  // PC USB-C Receptacle aperture opening & internal center tongue
  const pcPortAperture = mk("path", { class: "nf lo" }, pcG);
  const pcPortTongue = mk("path", { class: "nf hi" }, pcG);
  const pcApP0 = P(-125.0, 136.2, 1.4), pcApP1 = P(-125.0, 139.8, 1.4);
  const pcApP2 = P(-125.0, 139.8, 2.8), pcApP3 = P(-125.0, 136.2, 2.8);
  pcPortAperture.setAttribute("d", `M${pcApP0[0]} ${pcApP0[1]} L${pcApP1[0]} ${pcApP1[1]} L${pcApP2[0]} ${pcApP2[1]} L${pcApP3[0]} ${pcApP3[1]} Z`);
  const pcTg0 = P(-126.0, 137.0, 2.1), pcTg1 = P(-125.0, 139.0, 2.1);
  pcPortTongue.setAttribute("d", `M${pcTg0[0]} ${pcTg0[1]} L${pcTg1[0]} ${pcTg1[1]}`);

  // ─────────────────────────────────────────────────────────────
  // 2. USB-C 2.0 SERIAL LINK CABLE (sx ≈ 60..130)
  // From PC port (-125, 138) to ESP32 primary USB-C port (-109, 72)
  // ─────────────────────────────────────────────────────────────
  const ucg = mk("g", { class: prefersReduced ? '' : 'bench-anim-wire' }, g);
  
  // Strain relief boot & metal plug housing at PC side
  const pcSleeve = solid(ucg);
  const [pcSlR, pcSlI] = rings(-124.5, 136.2, -119.5, 139.8, 0.8, 0.25);
  put(pcSleeve, prism(P, front, pcSlR, pcSlI, 0.8, 3.4));

  // PC plug connector metal nose shell
  const pcPlugNose = solid(ucg);
  const [pcNzR, pcNzI] = rings(-126.5, 136.8, -124.0, 139.2, 0.5, 0.15);
  put(pcPlugNose, prism(P, front, pcNzR, pcNzI, 1.1, 3.1));

  // Cable spline with natural catenary curve
  const cablePath = mk("path", { class: isStreaming ? "nf hi" : (isConnected ? "nf" : "nf lo") }, ucg);
  cablePath.style.transition = "stroke 260ms ease";
  if (!isConnected) cablePath.style.strokeDasharray = "3 3";
  const usbP0 = P(-119.5, 138, 2.1);
  const usbP1 = P(-117, 115, 0.8);
  const usbP2 = P(-114, 93, 0.8);
  const usbP3 = P(-111.5, 72.0, 2.1);
  cablePath.setAttribute("d", `M${usbP0[0]} ${usbP0[1]} C${usbP1[0]} ${usbP1[1]} ${usbP2[0]} ${usbP2[1]} ${usbP3[0]} ${usbP3[1]}`);

  // Molded Type-C Overmold Boot at ESP32 end
  const sleeve = solid(ucg);

  // Nickel-plated Type-C plug shell entering the ESP32 receptacle
  const espPlugNose = solid(ucg);

  // Animated USB-C plug spring (0 = fully seated in socket; -8 = detached standby)
  const plugSpring = spring(isConnected ? 0 : -8, { eps: 0.01 });
  let lastPlugDx = NaN;
  const drawUsbPlug = (dx) => {
    if (Math.abs(dx - lastPlugDx) < 0.005) return;
    lastPlugDx = dx;

    const [slR, slI] = rings(-116.5 + dx, 70.0, -111.5 + dx, 74.0, 0.8, 0.25);
    put(sleeve, prism(P, front, slR, slI, 0.8, 3.4));

    const [nzR, nzI] = rings(-111.5 + dx, 70.6, -108.0 + dx, 73.4, 0.6, 0.15);
    put(espPlugNose, prism(P, front, nzR, nzI, 1.1, 3.1));

    const p3 = P(-111.5 + dx, 72.0, 2.1);
    const p2 = P(-114 + dx * 0.4, 93, 0.8);
    cablePath.setAttribute("d", `M${usbP0[0]} ${usbP0[1]} C${usbP1[0]} ${usbP1[1]} ${p2[0]} ${p2[1]} ${p3[0]} ${p3[1]}`);
  };

  // USB Packet Indicator Dots (traveling from PC to ESP32)
  const usbPackets = [0, 1].map(() => {
    const dot = mk("circle", { r: "1.4", class: "dot" }, ucg);
    dot.style.opacity = isStreaming ? "1" : "0";
    dot.style.transition = "opacity 200ms ease";
    return dot;
  });

  // ─────────────────────────────────────────────────────────────
  // 3. ESP32-S3-DEVKITC-1 MICROCONTROLLER (CENTER-LEFT, sx ≈ 140..260)
  // True authentic proportions: 25.5mm × 54.4mm (width:length ≈ 1:2.1)
  // Board runs along X axis from x = -106 to -50 (length = 56)
  // Width along Y axis from y = 64 to 88 (width = 24)
  // Left end (x = -106): Dual USB-C ports (USB + UART), EN & BOOT buttons
  // Middle (x = -86 to -68): ESP32-S3-WROOM-1 module with metal RF shield
  // Right end (x = -68 to -50): Characteristic black PCB antenna overhang
  // Outer rails (y = 65.5 and y = 86.5): Authentic dual 19-pin header strips
  // ─────────────────────────────────────────────────────────────
  const eg = mk("g", { class: prefersReduced ? '' : 'bench-anim-outline' }, g);
  
  // Base FR4 PCB (Elongated rectangular board with radiused corners)
  const espPcb = solid(eg);
  const [eR, eI] = rings(-106, 64, -50, 88, 2.2, 0.9);
  put(espPcb, prism(P, front, eR, eI, 0, 1.8));

  // 4 Corner M2 Mounting Holes
  [[-103, 67], [-53, 67], [-103, 85], [-53, 85]].forEach(([hx, hy]) => {
    const hole = mk("path", { class: "nf lo" }, eg);
    hole.setAttribute("d", poly(ringAt(P, atPt(circ(1.2, 10), hx, hy), 1.8)));
  });

  // Dual Stainless Steel USB-C Receptacles on ESP32 (True 8.9mm × 3.2mm Type-C footprint)
  // 1. Primary USB-OTG port (x: -109 to -102.5, y: 69.2 to 74.8, z: 1.8 to 4.2)
  const espUsbC1 = solid(eg);
  const [eUsb1R, eUsb1I] = rings(-109.0, 69.2, -102.5, 74.8, 0.7, 0.2);
  put(espUsbC1, prism(P, front, eUsb1R, eUsb1I, 1.8, 4.2));

  // Port 1 inner oval mouth cutout & center contact tongue
  const usb1Mouth = mk("path", { class: "nf lo" }, eg);
  const u1M0 = P(-109.0, 70.2, 2.3), u1M1 = P(-109.0, 73.8, 2.3);
  const u1M2 = P(-109.0, 73.8, 3.7), u1M3 = P(-109.0, 70.2, 3.7);
  usb1Mouth.setAttribute("d", `M${u1M0[0]} ${u1M0[1]} L${u1M1[0]} ${u1M1[1]} L${u1M2[0]} ${u1M2[1]} L${u1M3[0]} ${u1M3[1]} Z`);

  // 2. Secondary UART / Programming port (x: -109 to -102.5, y: 77.2 to 82.8, z: 1.8 to 4.2)
  const espUsbC2 = solid(eg);
  const [eUsb2R, eUsb2I] = rings(-109.0, 77.2, -102.5, 82.8, 0.7, 0.2);
  put(espUsbC2, prism(P, front, eUsb2R, eUsb2I, 1.8, 4.2));

  // Port 2 inner oval mouth cutout
  const usb2Mouth = mk("path", { class: "nf lo" }, eg);
  const u2M0 = P(-109.0, 78.2, 2.3), u2M1 = P(-109.0, 81.8, 2.3);
  const u2M2 = P(-109.0, 81.8, 3.7), u2M3 = P(-109.0, 78.2, 3.7);
  usb2Mouth.setAttribute("d", `M${u2M0[0]} ${u2M0[1]} L${u2M1[0]} ${u2M1[1]} L${u2M2[0]} ${u2M2[1]} ${u2M3[0]} ${u2M3[1]} Z`);

  // Side latch retention detents stamped on both USB-C metal shells
  const usbLatches = mk("path", { class: "nf lo" }, eg);
  const l1a = P(-105.5, 69.2, 3.0), l1b = P(-104.5, 69.2, 3.0);
  const l2a = P(-105.5, 77.2, 3.0), l2b = P(-104.5, 77.2, 3.0);
  usbLatches.setAttribute("d", `M${l1a[0]} ${l1a[1]} L${l1b[0]} ${l1b[1]} M${l2a[0]} ${l2a[1]} L${l2b[0]} ${l2b[1]}`);

  // CP2102N / CH343 USB-to-UART Bridge IC near USB ports
  const uartChip = solid(eg);
  const [uR, uI] = rings(-102, 74, -98, 78, 0.5, 0.15);
  put(uartChip, prism(P, front, uR, uI, 1.8, 2.8));

  // Tactile Push Buttons: Reset (EN) & BOOT
  // EN button near USB port 1 (y = 67.5)
  const rstBtn = solid(eg);
  const [rbR, rbI] = rings(-102.5, 66.5, -99.5, 69.5, 0.6, 0.2);
  put(rstBtn, prism(P, front, rbR, rbI, 1.8, 3.2));

  // BOOT button near USB port 2 (y = 82.5)
  const bootBtn = solid(eg);
  const [bbR, bbI] = rings(-102.5, 82.5, -99.5, 85.5, 0.6, 0.2);
  put(bootBtn, prism(P, front, bbR, bbI, 1.8, 3.2));

  // Plastic Header Insulator Strips (Clean 0.1-inch dual inline strips)
  const railStripTop = solid(eg);
  const [rstR, rstI] = rings(-101.5, 64.6, -54.5, 66.6, 0.5, 0.15);
  put(railStripTop, prism(P, front, rstR, rstI, 1.8, 3.2));

  const railStripBot = solid(eg);
  const [rsbR, rsbI] = rings(-101.5, 85.4, -54.5, 87.4, 0.5, 0.15);
  put(railStripBot, prism(P, front, rsbR, rsbI, 1.8, 3.2));

  // Discrete through-hole pin posts (15 pins along each rail for crisp vector lines)
  const numPins = 15;
  const pinStartX = -100;
  const pinStepX = 44.0 / (numPins - 1);
  const pinsTopPath = mk("path", { class: "nf" }, eg);
  const pinsBotPath = mk("path", { class: "nf" }, eg);
  let dTop = "", dBot = "";
  for (let pIdx = 0; pIdx < numPins; pIdx++) {
    const px = pinStartX + pIdx * pinStepX;
    const pt0 = P(px, 65.6, 3.2);
    const pt1 = P(px, 65.6, 4.4);
    dTop += `M${pt0[0]} ${pt0[1]} L${pt1[0]} ${pt1[1]} `;

    const pb0 = P(px, 86.4, 3.2);
    const pb1 = P(px, 86.4, 4.4);
    dBot += `M${pb0[0]} ${pb0[1]} L${pb1[0]} ${pb1[1]} `;
  }
  pinsTopPath.setAttribute("d", dTop);
  pinsBotPath.setAttribute("d", dBot);

  // ESP32-S3-WROOM-1 Metal RF Canister Shield (Distinct rectangular metal can)
  const soc = solid(eg);
  const [socR, socI] = rings(-86, 68.5, -68, 83.5, 1.4, 0.4);
  put(soc, prism(P, front, socR, socI, 1.8, 3.8));

  // Pin 1 Alignment Indentation on Metal Shield
  const socDot = mk("path", { class: "nf lo" }, eg);
  socDot.setAttribute("d", poly(ringAt(P, atPt(circ(0.8, 8), -84, 70.5), 3.8)));

  // Stamped ESP32-S3 RF Bevel Groove
  const socGroove = mk("path", { class: "nf lo" }, eg);
  const [grvR] = rings(-82, 71, -72, 81, 0.8, 0.25);
  socGroove.setAttribute("d", poly(ringAt(P, grvR, 3.8)));

  // Characteristic PCB Antenna Area (black antenna keepout zone overhang at right edge)
  const antPcb = solid(eg);
  const [antR, antI] = rings(-68, 68.5, -53, 83.5, 1.0, 0.3);
  put(antPcb, prism(P, front, antR, antI, 1.8, 2.3));

  // Meandered Inverted-F PCB Antenna (MIFA) copper trace inside the antenna zone
  const antPath = mk("path", { class: "nf hi" }, eg);
  const antPts = [
    [-66, 71], [-56, 71], [-56, 74], [-63, 74], [-63, 78], [-56, 78], [-56, 81], [-66, 81]
  ];
  antPath.setAttribute("d", open(antPts.map(([ax, ay]) => P(ax, ay, 2.3))));

  // Power LED & User WS2812 RGB LED near antenna boundary
  const pwrLed = mk("path", { class: isStreaming ? "nf hi" : (isConnected ? "nf" : "nf lo") }, eg);
  pwrLed.setAttribute("d", poly(ringAt(P, atPt(circ(0.8, 8), -88, 76), 1.8)));

  // Hardware Serial Activity LEDs (TX & RX near CP2102N bridge)
  const txLed = mk("path", { class: "nf lo" }, eg);
  txLed.setAttribute("d", poly(ringAt(P, atPt(circ(0.5, 6), -91.5, 70.8), 1.8)));
  const rxLed = mk("path", { class: "nf lo" }, eg);
  rxLed.setAttribute("d", poly(ringAt(P, atPt(circ(0.5, 6), -91.5, 73.2), 1.8)));

  // 4-Pin Dupont Female Connector Plug for I2C Bus Harness
  // Plugged into GPIO 8 (SDA), GPIO 9 (SCL), 3V3, GND pins on the front rail
  const espDupont = solid(eg);
  const [edR, edI] = rings(-67, 85, -57, 89, 0.7, 0.25);
  put(espDupont, prism(P, front, edR, edI, 1.8, 5.8));

  // ─────────────────────────────────────────────────────────────
  // 4. 4-WIRE I²C BUS HARNESS & LOGIC PROBE (CENTER, sx ≈ 215..565)
  // Wires:
  // Pin 1 (px = -65.5): GND (Black)   ──> OLED Pin 1 GND
  // Pin 2 (px = -63.0): 3V3 (Red)     ──> OLED Pin 2 VCC
  // Pin 3 (px = -60.5): SCL (Yellow)  ──> OLED Pin 3 SCL (400 kHz clock)
  // Pin 4 (px = -58.0): SDA (Green)   ──> OLED Pin 4 SDA (Data)
  // ─────────────────────────────────────────────────────────────
  const bg = mk("g", {}, g);
  
  // OLED Side Dupont 4-Pin Female Connector Shell
  // Receiving header pins at top of OLED breakout
  const oledDupont = solid(bg);
  const [odR, odI] = rings(47, -84, 52, -70, 0.8, 0.3);
  put(oledDupont, prism(P, front, odR, odI, 1.2, 5.8));

  const busWires = [0, 1, 2, 3].map((i) => {
    const path = mk("path", { class: "nf" }, bg);
    const x0 = -65.5 + i * 2.5;
    const y1 = -82.0 + i * 3.5;
    return { path, x0, y1, i };
  });

  // Logic Analyzer Mini Test Probe Clip (clipped onto wire 2: SCL clock line)
  const probeG = mk("g", { class: "nf lo" }, bg);
  const pCenter = P(0, 0, -2.5);
  const probeClip = solid(probeG);
  const [prR, prI] = rings(-3, -2, 3, 2, 0.8, 0.2);
  put(probeClip, prism(P, front, prR, prI, -3.0, 1.6));
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
    busWires.forEach(({ path, x0, y1, i }) => {
      const p0 = P(x0, 88.5, 3.8);
      const p1 = P(-15, 40 - i * 4, -2.0 - i * 0.7);
      const p2 = P(15, -25 - i * 4, -2.0 - i * 0.7);
      const p3 = P(47, y1, 3.6);
      const d = `M${p0[0]} ${p0[1]} C${p1[0]} ${p1[1]} ${p2[0]} ${p2[1]} ${p3[0]} ${p3[1]}`;
      path.setAttribute("d", d);

      // SCL (2) and SDA (3) signal traces: bright orange highlight when streaming or bus is active
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
  // 5. AUTHENTIC 0.96" SSD1306 OLED BREAKOUT (RIGHT, sx ≈ 575..720)
  // Pinout: [GND, VCC, SCL, SDA] along top edge (x = 52)
  // Module footprint: (50, -92) to (88, -54) (38x38 mm square with bezel)
  // ─────────────────────────────────────────────────────────────
  const og = mk("g", {}, g);
  const ox0 = 50, oy0 = -92, ow = 38, ol = 38;
  const pcbOuter = rrect(ox0, oy0, ox0 + ow, oy0 + ol, 3.0, 6);
  const ext = extremes(P, pcbOuter).slice(0, 2);
  const guide = mk("path", { class: "nf dash" }, og);

  // Layer 0: OLED Carrier PCB Breakout Board (Base)
  const g0 = mk("g", {}, og), pcb = solid(g0);
  const [pcbR, pcbI] = rings(ox0, oy0, ox0 + ow, oy0 + ol, 3.0, 1.4);
  
  // Real 4-Pin Header Posts [GND, VCC, SCL, SDA] along the top connection edge
  const oledPins = [-82.0, -78.5, -75.0, -71.5].map((y) => {
    const post = solid(g0), [pR, pI] = rings(49.8, y - 1.0, 52.2, y + 1.0, 0.5, 0.15);
    const solderPad = mk("path", { class: "nf lo" }, g0);
    solderPad.setAttribute("d", poly(ringAt(P, atPt(circ(1.2, 8), 51.0, y), 0.1)));
    return { post, pR, pI, x: 51, y };
  });

  // 4 Corner M2 Mounting Holes
  const holes = [
    [ox0 + 3.2, oy0 + 3.2], [ox0 + ow - 3.2, oy0 + 3.2],
    [ox0 + 3.2, oy0 + ol - 3.2], [ox0 + ow - 3.2, oy0 + ol - 3.2]
  ].map(([x, y]) => ({
    el: mk("path", { class: "nf lo" }, g0), ring: atPt(circ(1.4, 10), x, y),
  }));

  // SMD 4.7kΩ I2C Pullup Resistors & Charge-Pump Caps
  const smdRes1 = solid(g0);
  const [smd1R, smd1I] = rings(ox0 + 6, oy0 + 10, ox0 + 11, oy0 + 13.5, 0.5, 0.15);
  const smdRes2 = solid(g0);
  const [smd2R, smd2I] = rings(ox0 + 6, oy0 + 15, ox0 + 11, oy0 + 18.5, 0.5, 0.15);

  // Layer 1: Orange FPC Flex Ribbon Cable (folds from bottom of glass under to PCB)
  const g1 = mk("g", {}, og), flex = solid(g1);
  const [fR, fI] = rings(ox0 + 8, oy0 + 6, ox0 + 30, oy0 + 20, 1.2, 0.4);
  const traces = mk("path", { class: "nf lo" }, g1);

  // Layer 2: SSD1306 Chip-on-Glass (COG) Controller IC Die Lip
  const g2 = mk("g", {}, og), icDie = solid(g2);
  const [icR, icI] = rings(ox0 + 12, oy0 + 9, ox0 + 26, oy0 + 14, 0.6, 0.2);
  const bonds = mk("path", { class: "nf lo" }, g2);

  // Layer 3: Front 0.96" OLED Cover Glass with 128×64 Display Matrix
  const g3 = mk("g", {}, og), glass = solid(g3);
  const gx0 = ox0 + 3.5, gy0 = oy0 + 5.5, gx1 = ox0 + ow - 3.5, gy1 = oy0 + ol - 3.5;
  const gOuter = rrect(gx0, gy0, gx1, gy1, 1.8, 6);
  const gInner = rrect(gx0 + 0.8, gy0 + 0.8, gx1 - 0.8, gy1 - 0.8, 1.2, 6);
  const bezel = rrect(gx0 + 1.8, gy0 + 1.8, gx1 - 1.8, gy1 - 1.8, 0.8, 4);
  const bezelPath = mk("path", { class: "nf lo" }, g3);
  
  // 128×64 Active Display Matrix (exact 2:1 ratio)
  const dispPoly = fillet([
    [ox0 + 7, oy0 + 15], [ox0 + 31, oy0 + 15],
    [ox0 + 31, oy0 + 27], [ox0 + 7, oy0 + 27]
  ], [0.8, 0.8, 0.8, 0.8]);
  const dispPath = mk("path", { class: "nf hi" }, g3);
  
  // Engineering reticle crosshair inside display
  const reticle = rrect(ox0 + 16, oy0 + 19, ox0 + 22, oy0 + 23, 0.5, 4);
  const reticlePath = mk("path", { class: "nf lo" }, g3);

  function drawTraces(z) {
    let d = "";
    for (let x = ox0 + 12; x <= ox0 + 26; x += 2.2) d += seg(P(x, oy0 + 7, z), P(x, oy0 + 18, z));
    return d;
  }

  function drawBonds(z) {
    let d = "";
    for (let x = ox0 + 14; x <= ox0 + 24; x += 1.6) d += seg(P(x, oy0 + 10, z), P(x, oy0 + 8, z - 0.3));
    return d;
  }

  const oledDraw = [
    (z) => {
      put(pcb, prism(P, front, pcbR, pcbI, z, z + TPCB));
      put(smdRes1, prism(P, front, smd1R, smd1I, z + TPCB, z + TPCB + 0.7));
      put(smdRes2, prism(P, front, smd2R, smd2I, z + TPCB, z + TPCB + 0.7));
      holes.forEach((h) => h.el.setAttribute("d", poly(ringAt(P, h.ring, z + TPCB))));
      oledPins.forEach((p) => {
        put(p.post, prism(P, front, p.pR, p.pI, z + TPCB, z + TPCB + 4.2));
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

      // I2C packets on SCL clock (wire 2: x0 = -60.5) and SDA data lines (wire 3: x0 = -58.0)
      const sclP0 = P(-60.5, 88.5, 3.8), sclP1 = P(-15, 32, -3.4), sclP2 = P(15, -33, -3.4), sclP3 = P(47, -75.0, 3.6);
      const sdaP0 = P(-58.0, 88.5, 3.8), sdaP1 = P(-15, 28, -4.1), sdaP2 = P(15, -37, -4.1), sdaP3 = P(47, -71.5, 3.6);
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

    // 0. Step USB-C plug insertion spring physics
    if (stepS(plugSpring, dt)) {
      m = true;
      drawUsbPlug(plugSpring.x);
    }

    // 1. Advance data packets along wires ONLY when actively streaming frames
    if (isStreaming) {
      const pSpeed = (targetFps / 30) * 1.35;
      packetPhase = (packetPhase + dt * pSpeed) % 1.0;

      // Pulse TX and RX LEDs with rapid serial traffic flicker
      const blinkTX = Math.sin(packetPhase * Math.PI * 10) > 0.1;
      const blinkRX = Math.cos(packetPhase * Math.PI * 10) > 0.1;
      txLed.setAttribute("class", blinkTX ? "nf hi" : "nf lo");
      rxLed.setAttribute("class", blinkRX ? "nf hi" : "nf lo");

      // USB packets (PC -> ESP32)
      usbPackets.forEach((el, idx) => {
        el.style.opacity = "1";
        const u = (packetPhase + idx * 0.5) % 1.0;
        const pt = bezierPoint(usbP0, usbP1, usbP2, usbP3, u);
        el.setAttribute("cx", String(pt[0].toFixed(1)));
        el.setAttribute("cy", String(pt[1].toFixed(1)));
        el.setAttribute("class", "dot");
      });

      // I2C packets on SCL clock (wire 2: x0 = -60.5) and SDA data lines (wire 3: x0 = -58.0)
      const sclP0 = P(-60.5, 88.5, 3.8), sclP1 = P(-15, 32, -3.4), sclP2 = P(15, -33, -3.4), sclP3 = P(47, -75.0, 3.6);
      const sdaP0 = P(-58.0, 88.5, 3.8), sdaP1 = P(-15, 28, -4.1), sdaP2 = P(15, -37, -4.1), sdaP3 = P(47, -71.5, 3.6);
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
      txLed.setAttribute("class", "nf lo");
      rxLed.setAttribute("class", "nf lo");
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

  drawUsbPlug(plugSpring.x);
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
      if (opts.serialConnected !== undefined) {
        isConnected = Boolean(opts.serialConnected);
        plugSpring.t = isConnected ? 0 : -8;
      }
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
        txLed.setAttribute("class", "nf lo");
        rxLed.setAttribute("class", "nf lo");
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
