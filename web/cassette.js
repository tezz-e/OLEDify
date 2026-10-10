/**
 * Cassette: an exploded compact tape cassette in four layers.
 * Moving across opens the gap between layers; moving down picks a layer.
 * Layer 0: front shell and window.
 * Layer 1: twin toothed spools and magnetic tape ribbon.
 * Layer 2: magnetic shield and pressure pad.
 * Layer 3: back chassis shell.
 */
const {
  Cam, clamp, facing, fit, prism, proj, rings, circ, spring, stepS,
  mk, pointer, put, register, disposer, solid, poly, seg,
  extremes, rrect, fillet, ringAt,
} = HL;

const W = 100, H = 64, R = 6, LX = 32, RX = 68, CY = 34;
const T0 = 2.4, T1 = 2.0, T2 = 1.4, T3 = 3.0, STACK = T0 + T1 + T2 + T3, GMAX = 36;
const REST = [0.38, 0.32, 0.95];
const NAMES = ["front shell", "tape & spools", "head shield", "back chassis"];

function bases(g) {
  const b = [0], t = [T0, T1, T2];
  for (let j = 0; j < 3; j++) b.push(b[j] + t[j] + g[j]);
  const mid = (b[3] + T3) / 2;
  return b.map((z) => z - mid);
}
const atPt = (ring, cx, cy) => ring.map((q) => ({ ...q, u: q.u + cx, v: q.v + cy }));

function mount({ stage, svg, read }, value) {
  const bag = disposer();
  let GAP = value, share = null, act = -1;
  const C = Cam(45, 0.5, 1.86), HMAX = (STACK + 3 * GMAX) / 2;
  fit(C, [[-2, -2, -HMAX], [W + 2, H + 2, -HMAX], [W + 2, -2, -HMAX], [-2, H + 2, -HMAX], [-2, -2, HMAX], [W + 2, H + 2, HMAX]], 200, 160);
  const P = proj(C), front = facing(C);
  const flat = (pts, z) => poly(pts.map(([x, y]) => P(x, y, z)));

  const g = mk("g", {}, svg);
  const outer = rrect(0, 0, W, H, R, 6);
  const ext = extremes(P, outer).slice(0, 2);
  const guide = mk("path", { class: "nf dash" }, g);

  // Layer 0: Front shell with window and hub apertures
  const g0 = mk("g", {}, g), shell0 = solid(g0);
  const win0 = rrect(22, 18, 78, 50, 3, 4), winPath = mk("path", { class: "nf lo" }, g0);
  const hubL = atPt(circ(12, 18), LX, CY), hubR = atPt(circ(12, 18), RX, CY);
  const hubLP = mk("path", { class: "nf" }, g0), hubRP = mk("path", { class: "nf" }, g0);
  const screws = [[7, 7], [W - 7, 7], [7, H - 7], [W - 7, H - 7]].map(([x, y]) => ({
    el: mk("path", { class: "nf lo" }, g0), ring: atPt(circ(1.6, 12), x, y)
  }));

  // Layer 1: Twin toothed spools and magnetic tape ribbon
  const g1 = mk("g", {}, g), spoolL = solid(g1), spoolR = solid(g1);
  const [sL_R, sL_I] = rings(LX - 20, CY - 20, LX + 20, CY + 20, 20, 1.2);
  const [sR_R, sR_I] = rings(RX - 12, CY - 12, RX + 12, CY + 12, 12, 1.0);
  const teethL = mk("path", { class: "nf" }, g1), teethR = mk("path", { class: "nf" }, g1);
  const tapeRibbon = mk("path", { class: "nf sil" }, g1);
  const rollers = [[13, 12], [W - 13, 12]].map(([x, y]) => {
    const [rO, rI] = rings(x - 2.8, y - 2.8, x + 2.8, y + 2.8, 2.8, 0.6);
    return { el: solid(g1), ring: rO, inner: rI };
  });

  // Layer 2: Magnetic shield and pressure pad
  const g2 = mk("g", {}, g), shieldPoly = fillet([[28, 4], [W - 28, 4], [W - 34, 16], [34, 16]], [1.5, 1.5, 1.5, 1.5]);
  const sBack = mk("path", { class: "lo" }, g2), sFace = mk("path", { class: "sil" }, g2), pad = solid(g2);
  const [padR, padI] = rings(43, 2, 57, 7, 1.2, 0.4);
  const capstanHoles = [[21, 10], [W - 21, 10]].map(([x, y]) => ({
    el: mk("path", { class: "nf lo" }, g2), ring: atPt(circ(2.4, 14), x, y)
  }));

  // Layer 3: Back chassis shell
  const g3 = mk("g", {}, g), shell3 = solid(g3);
  const [s3_O, s3_I] = rings(0, 0, W, H, R, 1.8), backWin = mk("path", { class: "nf lo" }, g3);
  const backHoles = [hubL, hubR].map((ring) => ({ el: mk("path", { class: "nf" }, g3), ring }));

  function drawTeeth(cx, cy, z) {
    let d = "";
    for (let k = 0; k < 6; k++) {
      const a = (k / 6) * Math.PI * 2;
      d += seg(P(cx + 4.5 * Math.cos(a), cy + 4.5 * Math.sin(a), z), P(cx + 7.5 * Math.cos(a), cy + 7.5 * Math.sin(a), z));
    }
    return d;
  }

  const draw = [
    (z) => {
      put(shell0, prism(P, front, outer, rrect(1.5, 1.5, W - 1.5, H - 1.5, R - 1.5, 6), z, z + T0));
      winPath.setAttribute("d", poly(ringAt(P, win0, z + T0)));
      hubLP.setAttribute("d", poly(ringAt(P, hubL, z + T0)));
      hubRP.setAttribute("d", poly(ringAt(P, hubR, z + T0)));
      screws.forEach((s) => s.el.setAttribute("d", poly(ringAt(P, s.ring, z + T0))));
    },
    (z) => {
      put(spoolL, prism(P, front, sL_R, sL_I, z, z + T1));
      put(spoolR, prism(P, front, sR_R, sR_I, z, z + T1));
      teethL.setAttribute("d", drawTeeth(LX, CY, z + T1));
      teethR.setAttribute("d", drawTeeth(RX, CY, z + T1));
      rollers.forEach((r) => put(r.el, prism(P, front, r.ring, r.inner, z, z + T1 + 0.6)));
      const tz = z + T1 * 0.5, fmt = (pt) => Math.round(pt[0] * 10) / 10 + "," + Math.round(pt[1] * 10) / 10;
      tapeRibbon.setAttribute("d", `M${fmt(P(LX + 20, CY, tz))} L${fmt(P(13, 12, tz))} L${fmt(P(30, 4, tz))} L${fmt(P(50, 3, tz))} L${fmt(P(70, 4, tz))} L${fmt(P(W - 13, 12, tz))} L${fmt(P(RX - 12, CY, tz))}`);
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
  const targets = () => [0, 1, 2].map((j) => GAP * (share === null ? REST[j] : share));
  const gs = targets().map((t) => spring(t, { eps: 0.02 }));
  const drawn = [NaN, NaN, NaN, NaN];

  const B = register(stage, (dt) => {
    const T = targets();
    let m = false;
    for (let j = 0; j < 3; j++) { gs[j].t = T[j]; if (stepS(gs[j], dt)) m = true; }
    const b = bases(gs.map((s) => s.x));
    let changed = false;
    b.forEach((z, i) => { if (z !== drawn[i]) { drawn[i] = z; draw[i](z); changed = true; } });
    if (changed) guide.setAttribute("d", ext.map((q) => seg(P(q.u, q.v, b[3]), P(q.u, q.v, b[0] + T0))).join(""));
    return m;
  });
  bag.add(B.unregister);

  function setActive(k) {
    if (k === act) return;
    act = k;
    sils.forEach((el, i) => el.classList.toggle("hi", i === act));
    read.textContent = act < 0 ? "rest" : NAMES[act];
    B.wake();
  }

  read.textContent = "rest";

  bag.add(pointer(stage, {
    move: (p) => {
      share = clamp((p[0] - 60) / 280, 0.08, 1.0);
      setActive(clamp(Math.floor((p[1] - 80) / 40), 0, 3));
    },
    leave: () => { share = null; setActive(-1); },
  }));
  bag.add(() => svg.replaceChildren());

  return { set: (v) => { GAP = v; B.wake(); }, destroy: bag.dispose };
}

hairline({
  name: "cassette",
  means: "A tape cassette in four layers: shell, spools, shield and chassis. Scrubbing opens the gap.",
  rules: [1, 3, 4, 9],
  range: [18, 36, 54],
  tour: [[120, 140], [280, 180], null],
  mount,
});
