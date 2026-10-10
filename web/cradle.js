/**
 * Cradle: an open tape-splicing cradle with two resting drive spindles
 * and a sprung tension guide that answers the pointer.
 * Rules: 1, 3, 5, 8, 9.
 */
const {
  Cam, clamp, facing, fit, mk, pointer, prism, proj, put,
  register, rings, solid, spring, stepS, unproj, disposer,
} = HL;

const W = 52, H = 32, PB = 5, HUB_R = 9, HUB_Z = 7, SP_L = -24, SP_R = 24, SP_Y = -3;

function mount({ stage, svg, read }, value) {
  const bag = disposer();
  const C = Cam(45, 0.5, 1.85);
  fit(C, [
    [-W - 6, -H - 6, -PB], [W + 6, H + 6, -PB],
    [-W - 6, H + 6, -PB], [W + 6, -H - 6, -PB],
    [0, 0, HUB_Z + 10],
  ], 200, 166);

  const P = proj(C), front = facing(C);
  let intensity = value, over = null;
  const g = mk("g", {}, svg);

  const [baseRing, baseInner] = rings(-W, -H, W, H, 8, 2.2);
  put(solid(g), prism(P, front, baseRing, baseInner, -PB, 0));

  const [bayRing, bayInner] = rings(-W + 4, -H + 4, W - 4, H - 4, 6, 1.6);
  put(solid(g), prism(P, front, bayRing, bayInner, 0, 1.5));

  const [hubLRing, hubLInner] = rings(SP_L - HUB_R, SP_Y - HUB_R, SP_L + HUB_R, SP_Y + HUB_R, HUB_R, 1.5);
  const hubL = solid(g);

  const [hubRRing, hubRInner] = rings(SP_R - HUB_R, SP_Y - HUB_R, SP_R + HUB_R, SP_Y + HUB_R, HUB_R, 1.5);
  const hubR = solid(g);

  const [headRing, headInner] = rings(-8, 11, 8, 23, 3, 1.2);
  const head = solid(g);
  put(head, prism(P, front, headRing, headInner, 1.5, 7));
  const arm = solid(g);

  const spL = spring(0, { k: 120, c: 16 });
  const spR = spring(0, { k: 120, c: 16 });
  const spArm = spring(0, { k: 90, c: 14 });
  let curL = NaN, curR = NaN, curArm = NaN;

  function renderHubs() {
    const zL = 1.5 + Math.max(0, spL.x);
    if (zL !== curL) { curL = zL; put(hubL, prism(P, front, hubLRing, hubLInner, 1.5, zL + HUB_Z)); }

    const zR = 1.5 + Math.max(0, spR.x);
    if (zR !== curR) { curR = zR; put(hubR, prism(P, front, hubRRing, hubRInner, 1.5, zR + HUB_Z)); }

    const dArm = spArm.x;
    if (dArm !== curArm) {
      curArm = dArm;
      const [aR, aIn] = rings(-6 + dArm, 2, 6 + dArm, 10, 4, 1.2);
      put(arm, prism(P, front, aR, aIn, 1.5, 6));
    }
  }

  renderHubs();
  head.sil.classList.toggle("hi", true);

  const loop = register(stage, (dt) => {
    let moving = false;
    if (stepS(spL, dt)) moving = true;
    if (stepS(spR, dt)) moving = true;
    if (stepS(spArm, dt)) moving = true;
    renderHubs();
    return moving;
  });
  bag.add(loop.unregister);

  function retarget() {
    if (!over) {
      spL.t = spR.t = spArm.t = 0;
      hubL.sil.classList.toggle("hi", false);
      hubR.sil.classList.toggle("hi", false);
      arm.sil.classList.toggle("hi", false);
      head.sil.classList.toggle("hi", true);
      read.textContent = "bay 1 · empty";
      loop.wake();
      return;
    }

    head.sil.classList.toggle("hi", false);
    const [mx, my] = over;
    const dL = Math.hypot(mx - SP_L, my - SP_Y);
    const dR = Math.hypot(mx - SP_R, my - SP_Y);
    const dArm = Math.hypot(mx, my - 6);
    const maxDeflect = 4 * intensity;

    if (dL < 18) {
      spL.t = clamp(maxDeflect * (1 - dL / 18), 0, maxDeflect);
      spR.t = 0; spArm.t = -spL.t * 0.4;
      hubL.sil.classList.toggle("hi", true);
      hubR.sil.classList.toggle("hi", false);
      arm.sil.classList.toggle("hi", false);
      read.textContent = "spindle L · 0rpm";
    } else if (dR < 18) {
      spR.t = clamp(maxDeflect * (1 - dR / 18), 0, maxDeflect);
      spL.t = 0; spArm.t = spR.t * 0.4;
      hubR.sil.classList.toggle("hi", true);
      hubL.sil.classList.toggle("hi", false);
      arm.sil.classList.toggle("hi", false);
      read.textContent = "spindle R · 0rpm";
    } else if (dArm < 22) {
      spArm.t = clamp((mx / 22) * maxDeflect * 1.5, -maxDeflect * 1.5, maxDeflect * 1.5);
      spL.t = spR.t = Math.abs(spArm.t) * 0.3;
      hubL.sil.classList.toggle("hi", false);
      hubR.sil.classList.toggle("hi", false);
      arm.sil.classList.toggle("hi", true);
      read.textContent = "guide · tension 0";
    } else {
      spL.t = spR.t = spArm.t = 0;
      hubL.sil.classList.toggle("hi", false);
      hubR.sil.classList.toggle("hi", false);
      arm.sil.classList.toggle("hi", false);
      read.textContent = "bay 1 · open";
    }
    loop.wake();
  }

  bag.add(pointer(stage, {
    move: (p) => { over = unproj(C, p[0], p[1], 0); retarget(); },
    leave: () => { over = null; retarget(); },
  }));
  bag.add(() => svg.replaceChildren());

  return {
    set: (v) => { intensity = v; if (over) retarget(); },
    destroy: bag.dispose,
  };
}

hairline({
  name: "cradle",
  means: "An open tape bay with two resting spindles and a tension arm that answers the pointer.",
  rules: [1, 3, 5, 8, 9],
  range: [0.6, 1.0, 1.4],
  tour: [[152, 142], [248, 142], [200, 178], null],
  mount,
});
