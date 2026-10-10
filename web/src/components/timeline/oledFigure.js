import { HL } from './hairlineKernel.js';

const {
  Cam, clamp, facing, fit, prism, proj, rings, circ, spring, stepS,
  mk, pointer, put, register, disposer, solid, poly, seg,
  extremes, rrect, fillet, ringAt,
} = HL;

const PW = 76, PL = 76, PR = 4.5;
const TPCB = 2.2, TFPC = 1.0, TIC = 1.2, TG = 2.0, GMAX = 36;
const STACK = TPCB + TFPC + TIC + TG;
const REST = [0.95, 0.32, 0.36];
const NAMES = ["pcb · i2c", "fpc · ribbon", "ic · ssd1306", "glass · 128×64"];
const atPt = (ring, cx, cy) => ring.map((q) => ({ ...q, u: q.u + cx, v: q.v + cy }));

function bases(g) {
  const b = [0], t = [TPCB, TFPC, TIC];
  for (let j = 0; j < 3; j++) b.push(b[j] + t[j] + g[j]);
  const mid = (b[3] + TG) / 2;
  return b.map((z) => z - mid);
}

export function mountOled({ stage, svg, read }, value = 28) {
  const bag = disposer();
  let GAP = value, share = null, act = -1;
  const C = Cam(45, 0.5, 1.9), HMAX = (STACK + 3 * GMAX) / 2;
  fit(C, [[-2, -2, -HMAX], [PW + 2, PL + 2, -HMAX], [PW + 2, -2, -HMAX], [-2, PL + 2, -HMAX], [-2, -2, HMAX], [PW + 2, PL + 2, HMAX]], 200, 166);
  const P = proj(C), front = facing(C);
  const flat = (pts, z) => poly(pts.map(([x, y]) => P(x, y, z)));

  const g = mk("g", {}, svg);
  const pcbOuter = rrect(0, 0, PW, PL, PR, 6);
  const ext = extremes(P, pcbOuter).slice(0, 2);
  const guide = mk("path", { class: "nf dash" }, g);

  // Layer 0: PCB carrier with 4 corner holes and 4 header pins (base)
  const g0 = mk("g", {}, g), pcb = solid(g0);
  const [pcbR, pcbI] = rings(0, 0, PW, PL, PR, 1.8);
  const holes = [[6, 6], [PW - 6, 6], [6, PL - 6], [PW - 6, PL - 6]].map(([x, y]) => ({
    el: mk("path", { class: "nf lo" }, g0), ring: atPt(circ(2.0, 14), x, y),
  }));
  const pins = [24.5, 33.5, 42.5, 51.5].map((x) => {
    const pad = mk("path", { class: "nf" }, g0), post = solid(g0);
    const [pR, pI] = rings(x - 1.5, 67.5, x + 1.5, 70.5, 0.9, 0.4);
    return { pad, ring: atPt(circ(2.2, 14), x, 69), post, pR, pI };
  });
  const smdResistors = [[15, 59], [61, 59]].map(([x, y]) => {
    const el = solid(g0), [rR, rI] = rings(x - 2.5, y - 1.5, x + 2.5, y + 1.5, 0.6, 0.3);
    return { el, rR, rI };
  });

  // Layer 1: FPC ribbon cable with copper trace lines
  const g1 = mk("g", {}, g), flex = solid(g1);
  const [fR, fI] = rings(22, 6, 54, 28, 1.6, 0.6);
  const traces = mk("path", { class: "nf lo" }, g1);

  // Layer 2: Chip-on-Glass (COG) driver IC bar and wire bonds
  const g2 = mk("g", {}, g), icDie = solid(g2);
  const [icR, icI] = rings(24, 13, 52, 19, 1.0, 0.4);
  const bonds = mk("path", { class: "nf lo" }, g2);

  // Layer 3: Front 0.96" OLED cover glass with 128x64 display frame (top)
  const g3 = mk("g", {}, g), glass = solid(g3);
  const gOuter = rrect(5, 8, 71, 58, 2.5, 6), gInner = rrect(6.2, 9.2, 69.8, 56.8, 1.8, 6);
  const bezel = rrect(8, 11, 68, 55, 1.6, 4), bezelPath = mk("path", { class: "nf lo" }, g3);
  const dispPoly = fillet([[12, 24], [64, 24], [64, 50], [12, 50]], [1.2, 1.2, 1.2, 1.2]);
  const dispPath = mk("path", { class: "nf hi" }, g3);
  const reticle = rrect(33, 33, 43, 41, 0.8, 4), reticlePath = mk("path", { class: "nf lo" }, g3);

  function drawTraces(z) {
    let d = "";
    for (let x = 26; x <= 50; x += 4) d += seg(P(x, 7, z), P(x, 27, z));
    return d;
  }

  function drawBonds(z) {
    let d = "";
    for (let x = 26; x <= 50; x += 3) d += seg(P(x, 13, z), P(x, 9.5, z - 0.4));
    return d;
  }

  const draw = [
    (z) => {
      put(pcb, prism(P, front, pcbR, pcbI, z, z + TPCB));
      holes.forEach((h) => h.el.setAttribute("d", poly(ringAt(P, h.ring, z + TPCB))));
      pins.forEach((p) => {
        p.pad.setAttribute("d", poly(ringAt(P, p.ring, z + TPCB)));
        put(p.post, prism(P, front, p.pR, p.pI, z + TPCB, z + TPCB + 4.2));
      });
      smdResistors.forEach((r) => put(r.el, prism(P, front, r.rR, r.rI, z + TPCB, z + TPCB + 1.0)));
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

  const sils = [pcb.sil, flex.sil, icDie.sil, glass.sil];
  const targets = () => [0, 1, 2].map((j) => GAP * (share === null ? REST[j] : share));
  const gs = targets().map((t) => spring(t, { eps: 0.01 }));
  const drawn = [NaN, NaN, NaN, NaN];

  const B = register(stage, (dt) => {
    const T = targets();
    let m = false;
    for (let j = 0; j < 3; j++) { gs[j].t = T[j]; if (stepS(gs[j], dt)) m = true; }
    const b = bases(gs.map((s) => s.x));
    let changed = false;
    b.forEach((z, i) => { if (z !== drawn[i]) { drawn[i] = z; draw[i](z); changed = true; } });
    if (changed) guide.setAttribute("d", ext.map((q) => seg(P(q.u, q.v, b[0]), P(q.u, q.v, b[3] + TG))).join(""));
    return m;
  });
  bag.add(B.unregister);

  function setActive(k) {
    if (k === act) return;
    act = k;
    sils.forEach((el, i) => el.classList.toggle("hi", i === act));
    dispPath.classList.toggle("hi", act === -1 || act === 3);
    if (read) read.textContent = act < 0 ? "rest" : NAMES[act];
    B.wake();
  }

  if (read) read.textContent = "rest";

  bag.add(pointer(stage, {
    move: (p) => {
      share = clamp((p[0] - 60) / 280, 0.08, 1.0);
      setActive(clamp(3 - Math.floor((p[1] - 70) / 45), 0, 3));
    },
    leave: () => { share = null; setActive(-1); },
  }));
  bag.add(() => svg.replaceChildren());

  return { set: (v) => { GAP = v; B.wake(); }, destroy: bag.dispose };
}
