import { HL } from './hairlineKernel.js';

const {
  Cam, clamp, facing, fit, prism, proj, rings, circ, spring, stepS,
  mk, pointer, put, register, disposer, solid, poly, seg,
  extremes, rrect, fillet, ringAt,
} = HL;

// Proportions of compact micro-cassette / optical media cartridge
const W = 104, H = 66, R = 6, LX = 34, RX = 70, CY = 35;
const T0 = 2.4, T1 = 2.0, T2 = 1.4, T3 = 3.0, STACK = T0 + T1 + T2 + T3, GMAX = 38;
const REST_EXPLODE = [0, 0, 0];

export const CASSETTE_NAMES = [
  "Front acrylic shell · Anti-resonance chassis",
  "Tape transport · Micro-toothed twin spools",
  "Mu-metal magnetic shield & pressure pad",
  "Back polycarb chassis · Tape guide rollers"
];

function bases(g) {
  const b = [0], t = [T0, T1, T2];
  for (let j = 0; j < 3; j++) b.push(b[j] + t[j] + g[j]);
  const mid = (b[3] + T3) / 2;
  return b.map((z) => z - mid);
}
const atPt = (ring, cx, cy) => ring.map((q) => ({ ...q, u: q.u + cx, v: q.v + cy }));

export function mountMediaCassette(
  { stage, svg, read },
  options = {}
) {
  const bag = disposer();
  let GAP = 34, share = null, act = -1;
  let isDragOver = Boolean(options.isDragOver);
  let isDecoding = Boolean(options.isDecoding);
  let spoolAngle = 0;

  // ViewBox: 400 × 320 with authentic isometric camera
  const C = Cam(45, 0.5, 1.95), HMAX = (STACK + 3 * GMAX) / 2;
  fit(C, [
    [-4, -4, -HMAX], [W + 4, H + 4, -HMAX],
    [W + 4, -4, -HMAX], [-4, H + 4, -HMAX],
    [-4, -4, HMAX], [W + 4, H + 4, HMAX]
  ], 200, 160);
  
  const P = proj(C), front = facing(C);
  const flat = (pts, z) => poly(pts.map(([x, y]) => P(x, y, z)));

  const g = mk("g", {}, svg);
  const outer = rrect(0, 0, W, H, R, 6);
  const ext = extremes(P, outer).slice(0, 2);
  const guide = mk("path", { class: "nf dash" }, g);

  // Layer 0: Front acrylic shell with tape inspection window & M2 brass screws
  const g0 = mk("g", {}, g), shell0 = solid(g0);
  const win0 = rrect(22, 18, 82, 52, 3, 4), winPath = mk("path", { class: "nf lo" }, g0);
  const hubL = atPt(circ(12.5, 18), LX, CY), hubR = atPt(circ(12.5, 18), RX, CY);
  const hubLP = mk("path", { class: "nf" }, g0), hubRP = mk("path", { class: "nf" }, g0);
  const screws = [[7, 7], [W - 7, 7], [7, H - 7], [W - 7, H - 7]].map(([x, y]) => ({
    el: mk("path", { class: "nf lo" }, g0), ring: atPt(circ(1.6, 12), x, y)
  }));
  // Tape label index line
  const labelLine = mk("path", { class: "nf lo" }, g0);
  const labelPts = [[20, 56], [84, 56]];
  labelLine.setAttribute("d", `M${P(labelPts[0][0], labelPts[0][1], 0)[0]} ${P(labelPts[0][0], labelPts[0][1], 0)[1]} L${P(labelPts[1][0], labelPts[1][1], 0)[0]} ${P(labelPts[1][0], labelPts[1][1], 0)[1]}`);

  // Layer 1: Twin toothed spools, tape cake pack, and magnetic tape ribbon
  const g1 = mk("g", {}, g), spoolL = solid(g1), spoolR = solid(g1);
  const [sL_R, sL_I] = rings(LX - 20, CY - 20, LX + 20, CY + 20, 20, 1.2);
  const [sR_R, sR_I] = rings(RX - 13, CY - 13, RX + 13, CY + 13, 13, 1.0);
  const teethL = mk("path", { class: "nf" }, g1), teethR = mk("path", { class: "nf" }, g1);
  const tapeRibbon = mk("path", { class: isDragOver ? "nf hi" : "nf sil" }, g1);
  const rollers = [[13, 12], [W - 13, 12]].map(([x, y]) => {
    const [rO, rI] = rings(x - 2.8, y - 2.8, x + 2.8, y + 2.8, 2.8, 0.6);
    return { el: solid(g1), ring: rO, inner: rI };
  });

  // Layer 2: Mu-metal magnetic head shield and felt pressure pad
  const g2 = mk("g", {}, g), shieldPoly = fillet([[28, 4], [W - 28, 4], [W - 35, 16], [35, 16]], [1.5, 1.5, 1.5, 1.5]);
  const sBack = mk("path", { class: "lo" }, g2), sFace = mk("path", { class: "sil" }, g2), pad = solid(g2);
  const [padR, padI] = rings(45, 2, 59, 7, 1.2, 0.4);
  const capstanHoles = [[22, 10], [W - 22, 10]].map(([x, y]) => ({
    el: mk("path", { class: "nf lo" }, g2), ring: atPt(circ(2.4, 14), x, y)
  }));

  // Layer 3: Back chassis shell
  const g3 = mk("g", {}, g), shell3 = solid(g3);
  const [s3_O, s3_I] = rings(0, 0, W, H, R, 1.8), backWin = mk("path", { class: "nf lo" }, g3);
  const backHoles = [hubL, hubR].map((ring) => ({ el: mk("path", { class: "nf" }, g3), ring }));

  function drawTeeth(cx, cy, z, angleOffset = 0) {
    let d = "";
    for (let k = 0; k < 6; k++) {
      const a = (k / 6) * Math.PI * 2 + angleOffset;
      d += seg(P(cx + 4.5 * Math.cos(a), cy + 4.5 * Math.sin(a), z), P(cx + 7.5 * Math.cos(a), cy + 7.5 * Math.sin(a), z));
    }
    return d;
  }

  let curZ1 = 0;

  const draw = [
    (z) => {
      put(shell0, prism(P, front, outer, rrect(1.5, 1.5, W - 1.5, H - 1.5, R - 1.5, 6), z, z + T0));
      winPath.setAttribute("d", poly(ringAt(P, win0, z + T0)));
      hubLP.setAttribute("d", poly(ringAt(P, hubL, z + T0)));
      hubRP.setAttribute("d", poly(ringAt(P, hubR, z + T0)));
      screws.forEach((s) => s.el.setAttribute("d", poly(ringAt(P, s.ring, z + T0))));
      const lz = z + T0;
      labelLine.setAttribute("d", `M${P(labelPts[0][0], labelPts[0][1], lz)[0]} ${P(labelPts[0][0], labelPts[0][1], lz)[1]} L${P(labelPts[1][0], labelPts[1][1], lz)[0]} ${P(labelPts[1][0], labelPts[1][1], lz)[1]}`);
    },
    (z) => {
      curZ1 = z;
      put(spoolL, prism(P, front, sL_R, sL_I, z, z + T1));
      put(spoolR, prism(P, front, sR_R, sR_I, z, z + T1));
      teethL.setAttribute("d", drawTeeth(LX, CY, z + T1, spoolAngle));
      teethR.setAttribute("d", drawTeeth(RX, CY, z + T1, spoolAngle * 1.5));
      rollers.forEach((r) => put(r.el, prism(P, front, r.ring, r.inner, z, z + T1 + 0.6)));
      const tz = z + T1 * 0.5, fmt = (pt) => Math.round(pt[0] * 10) / 10 + "," + Math.round(pt[1] * 10) / 10;
      tapeRibbon.setAttribute("d", `M${fmt(P(LX + 20, CY, tz))} L${fmt(P(13, 12, tz))} L${fmt(P(30, 4, tz))} L${fmt(P(52, 3, tz))} L${fmt(P(72, 4, tz))} L${fmt(P(W - 13, 12, tz))} L${fmt(P(RX - 13, CY, tz))}`);
    },
    (z) => {
      sBack.setAttribute("d", flat(shieldPoly, z));
      sFace.setAttribute("d", flat(shieldPoly, z + T2));
      put(pad, prism(P, front, padR, padI, z + T2, z + T2 + 1.2));
      capstanHoles.forEach((c) => c.el.setAttribute("d", poly(ringAt(P, c.ring, z + T2))));
    },
    (z) => {
      put(shell3, prism(P, front, s3_O, s3_I, z, z + T3));
      backWin.setAttribute("d", poly(ringAt(P, win0, z + T3)));
      backHoles.forEach((h) => h.el.setAttribute("d", poly(ringAt(P, h.ring, z + T3))));
    },
  ];

  const sils = [shell0.sil, tapeRibbon, sFace, shell3.sil];
  const targets = () => [0, 1, 2].map((j) => {
    if (isDragOver) return GAP * 1.15; // dramatic exploded flare when dragging file over
    if (share === null) return 0;       // fully assembled flat and flush
    return GAP * share * (j === 2 ? 0.9 : 0.6);
  });
  const gs = targets().map((t) => spring(t, { eps: 0.02, k: 180, b: 22 }));
  const drawn = [NaN, NaN, NaN, NaN];

  const B = register(stage, (dt) => {
    // Spin tape reels when dragging over or processing
    let m = false;
    if (isDragOver || isDecoding) {
      spoolAngle += dt * 3.8;
      teethL.setAttribute("d", drawTeeth(LX, CY, curZ1 + T1, spoolAngle));
      teethR.setAttribute("d", drawTeeth(RX, CY, curZ1 + T1, spoolAngle * 1.5));
      m = true;
    }

    const T = targets();
    for (let j = 0; j < 3; j++) { gs[j].t = T[j]; if (stepS(gs[j], dt)) m = true; }
    const b = bases(gs.map((s) => s.x));
    let changed = false;
    b.forEach((z, i) => { if (z !== drawn[i]) { drawn[i] = z; draw[i](z); changed = true; } });
    if (changed) {
      const totalG = gs[0].x + gs[1].x + gs[2].x;
      if (totalG > 1.0) {
        guide.style.opacity = Math.min(1, (totalG - 1.0) / 6).toFixed(2);
        guide.setAttribute("d", ext.map((q) => seg(P(q.u, q.v, b[3]), P(q.u, q.v, b[0] + T0))).join(""));
      } else {
        guide.style.opacity = "0";
        guide.setAttribute("d", "");
      }
    }
    return m;
  });
  bag.add(B.unregister);

  function setActive(k) {
    if (k === act) return;
    act = k;
    sils.forEach((el, i) => el.classList.toggle("hi", i === act || (isDragOver && i === 1)));
    B.wake();
  }

  bag.add(pointer(stage, {
    move: (p) => {
      // Scale hover expansion
      share = clamp((p[1] - 40) / 160, 0, 0.85);
      setActive(clamp(Math.floor((p[1] - 80) / 40), 0, 3));
    },
    leave: () => {
      share = null;
      setActive(-1);
    },
  }));
  bag.add(() => svg.replaceChildren());

  return {
    set: (v) => { GAP = v; B.wake(); },
    update: (opts = {}) => {
      if (opts.isDragOver !== undefined) isDragOver = Boolean(opts.isDragOver);
      if (opts.isDecoding !== undefined) isDecoding = Boolean(opts.isDecoding);
      tapeRibbon.setAttribute("class", isDragOver ? "nf hi" : "nf sil");
      if (read) {
        read.textContent = isDragOver ? "Drop media to mount tape" : (act < 0 ? "Magnetic optical tape cartridge" : CASSETTE_NAMES[act]);
      }
      B.wake();
    },
    destroy: bag.dispose
  };
}
