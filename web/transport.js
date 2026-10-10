/**
 * Transport: a reel-to-reel tape deck on a rounded plinth. Two reels sit on
 * spindles, each wound with tape. Tape threads across guide posts, the magnetic
 * head block, and a capstan roller. The pointer picks a reel, which spins up.
 * The read-out names the reel. The slider drives rewind speed.
 */
const {
  Cam, facing, fit, prism, proj, rings, spring, stepS, unproj,
  mk, place, pointer, put, register, disposer, solid, poly, seg,
  rad, r2, reflect, flatDot,
} = HL;

const DW = 120, DD = 78, DR = 7, DB = 2, DH = 4;
const LX = 32, RX = 88, RY = 44, ROUT = 20, RIN = 6, RSPIN = 2.4, RH = 2.5;
const LTAPE = 17, RTAPE = 8.5;
const guides = [[14, 22], [106, 22]];
const HX0 = 50, HX1 = 66, HY0 = 18, HY1 = 28, HH = 4.5;
const CAPX = 82, CAPY = 23, PINX = 84, PINY = 18;

function circlePts(cx, cy, r, n) {
  const pts = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    pts.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]);
  }
  return pts;
}

function mount({ stage, svg, read }, value) {
  const bag = disposer();
  let speed = value;
  const C = Cam(45, 0.5, 1.84);
  fit(C, [
    [-4, -4, 0], [DW + 4, DD + 4, 0], [DW + 4, -4, 0], [-4, DD + 4, 0],
    [LX - ROUT, RY - ROUT, DH + RH + 2], [RX + ROUT, RY + ROUT, DH + RH + 2]
  ], 200, 160);
  const P = proj(C), front = facing(C);

  const g = mk("g", {}, svg);
  const [deckR, deckI] = rings(0, 0, DW, DD, DR, DB);
  reflect(svg, g, P, front, deckR, 0, 12);
  put(solid(g), prism(P, front, deckR, deckI, 0, DH));

  const [hR, hI] = rings(HX0, HY0, HX1, HY1, 2, 0.8);
  put(solid(g), prism(P, front, hR, hI, DH, DH + HH));
  mk("path", { d: seg(P((HX0 + HX1) / 2, HY0 + 1, DH + HH), P((HX0 + HX1) / 2, HY1 - 1, DH + HH)), class: "lo" }, g);

  for (const [gx, gy] of guides) {
    const [gR, gI] = rings(gx - 1.8, gy - 1.8, gx + 1.8, gy + 1.8, 1.8, 0.5);
    put(solid(g), prism(P, front, gR, gI, DH, DH + 5));
  }
  const [capR, capI] = rings(CAPX - 1.6, CAPY - 1.6, CAPX + 1.6, CAPY + 1.6, 1.6, 0.4);
  put(solid(g), prism(P, front, capR, capI, DH, DH + 5.5));
  const [pinR, pinI] = rings(PINX - 2.2, PINY - 2.2, PINX + 2.2, PINY + 2.2, 2.2, 0.6);
  put(solid(g), prism(P, front, pinR, pinI, DH, DH + 4.8));

  const tapePath = mk("path", { class: "nf sil" }, g);
  const reels = [];
  for (const [cx, side, tapeR, restA] of [[LX, "L", LTAPE, 25], [RX, "R", RTAPE, -15]]) {
    const grp = mk("g", {}, g);
    const [sR, sI] = rings(cx - RSPIN, RY - RSPIN, cx + RSPIN, RY + RSPIN, RSPIN, 0.6);
    put(solid(grp), prism(P, front, sR, sI, DH, DH + RH + 1.2));
    const outerSil = mk("path", { class: "nf sil" }, grp);
    const tapePack = mk("path", { class: "nf lo" }, grp);
    const innerPath = mk("path", { class: "nf" }, grp);
    const spokes = [mk("path", { class: "nf lo" }, grp), mk("path", { class: "nf lo" }, grp), mk("path", { class: "nf lo" }, grp)];
    const dot = flatDot(grp, C, 0.9, side === "L" ? "dot" : "dot m");
    place(dot, P(cx, RY, DH + RH + 1.3));
    reels.push({
      cx, side, tapeR, outerSil, tapePack, innerPath, spokes, dot,
      rot: spring(restA, { k: 70, c: 15, eps: 0.02 }),
      outerPts: circlePts(cx, RY, ROUT, 24),
      tapePts: circlePts(cx, RY, tapeR, 20),
      innerPts: circlePts(cx, RY, RIN, 16),
      drawn: NaN,
    });
  }

  let act = -1;
  const caption = (a) => a < 0 ? "rest" : a === 0 ? "reel 01 · supply" : "reel 02 · take-up";

  function drawReel(r, angle) {
    const a = rad(angle), cs = Math.cos(a), sn = Math.sin(a), z = DH + RH;
    const rot = (u, v) => [r.cx + (u - r.cx) * cs - (v - RY) * sn, RY + (u - r.cx) * sn + (v - RY) * cs];
    r.outerSil.setAttribute("d", poly(r.outerPts.map(([u, v]) => P(...rot(u, v), z))));
    r.tapePack.setAttribute("d", poly(r.tapePts.map(([u, v]) => P(...rot(u, v), z - 0.2))));
    r.innerPath.setAttribute("d", poly(r.innerPts.map(([u, v]) => P(...rot(u, v), z))));
    for (let i = 0; i < 3; i++) {
      const sa = a + (i / 3) * Math.PI * 2;
      const pIn = P(r.cx + RIN * Math.cos(sa), RY + RIN * Math.sin(sa), z);
      const pOut = P(r.cx + (r.tapeR - 1) * Math.cos(sa), RY + (r.tapeR - 1) * Math.sin(sa), z);
      r.spokes[i].setAttribute("d", seg(pIn, pOut));
    }
  }

  function drawTape() {
    const z = DH + RH - 0.2;
    const p0 = P(LX + LTAPE * Math.cos(rad(130)), RY + LTAPE * Math.sin(rad(130)), z);
    const p1 = P(RX + RTAPE * Math.cos(rad(210)), RY + RTAPE * Math.sin(rad(210)), z);
    tapePath.setAttribute("d", [
      `M${r2(p0[0])},${r2(p0[1])}`,
      `L${r2(P(guides[0][0], guides[0][1], DH + 4)[0])},${r2(P(guides[0][0], guides[0][1], DH + 4)[1])}`,
      `L${r2(P(HX0, HY0 + 1, DH + HH)[0])},${r2(P(HX0, HY0 + 1, DH + HH)[1])}`,
      `L${r2(P(HX1, HY0 + 1, DH + HH)[0])},${r2(P(HX1, HY0 + 1, DH + HH)[1])}`,
      `L${r2(P(CAPX, CAPY, DH + 4.5)[0])},${r2(P(CAPX, CAPY, DH + 4.5)[1])}`,
      `L${r2(P(guides[1][0], guides[1][1], DH + 4)[0])},${r2(P(guides[1][0], guides[1][1], DH + 4)[1])}`,
      `L${r2(p1[0])},${r2(p1[1])}`,
    ].join(" "));
  }
  drawTape();

  const B = register(stage, (dt) => {
    let moving = false;
    for (const r of reels) {
      if (stepS(r.rot, dt)) moving = true;
      if (r.rot.x !== r.drawn) { r.drawn = r.rot.x; drawReel(r, r.rot.x); }
    }
    return moving;
  });
  bag.add(B.unregister);

  function setActive(a) {
    if (a === act) return;
    act = a;
    if (a >= 0) {
      reels[a].rot.t = reels[a].rot.x + speed * 270;
      reels[1 - a].rot.t = reels[1 - a].rot.x - speed * 120;
    } else {
      reels[0].rot.t = 25;
      reels[1].rot.t = -15;
    }
    reels.forEach((r, i) => {
      r.outerSil.classList.toggle("hi", i === a);
      r.dot.setAttribute("class", i === a ? "dot" : "dot m");
    });
    read.textContent = caption(a);
    B.wake();
  }

  function hit([sx, sy]) {
    const wp = unproj(C, sx, sy, DH + RH);
    if (Math.hypot(wp[0] - LX, wp[1] - RY) < ROUT + 4) return 0;
    if (Math.hypot(wp[0] - RX, wp[1] - RY) < ROUT + 4) return 1;
    return -1;
  }

  bag.add(pointer(stage, { move: (p) => setActive(hit(p)), leave: () => setActive(-1) }));
  bag.add(() => svg.replaceChildren());

  return { set: (v) => { speed = v; }, destroy: bag.dispose };
}

hairline({
  name: "transport",
  means: "A reel-to-reel tape deck: the reel under the pointer spins up and threads tape across the head.",
  rules: [1, 4, 5, 9, 10],
  range: [0.5, 1, 2],
  tour: [[150, 160], [250, 160], null],
  mount,
});
