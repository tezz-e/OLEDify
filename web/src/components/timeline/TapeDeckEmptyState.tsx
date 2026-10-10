import React, { useRef, useEffect, useState, useCallback } from 'react';

interface TapeDeckEmptyStateProps {
  isDark?: boolean;
  isDropTargetOver?: boolean;
  onLoadSample?: (sampleId: string) => void;
  onLaunchLyrics?: () => void;
  onTriggerImport?: () => void;
}

// Spring physics simulation state
interface SpringState {
  x: number;   // current position / angle
  v: number;   // velocity
  t: number;   // target
}

function stepSpring(sp: SpringState, dt: number, k = 80, c = 14, m = 1): boolean {
  const f = -k * (sp.x - sp.t) - c * sp.v;
  const a = f / m;
  sp.v += a * dt;
  sp.x += sp.v * dt;
  const isMoving = Math.abs(sp.x - sp.t) > 0.005 || Math.abs(sp.v) > 0.01;
  if (!isMoving) {
    sp.x = sp.t;
    sp.v = 0;
  }
  return isMoving;
}

export const TapeDeckEmptyState: React.FC<TapeDeckEmptyStateProps> = ({
  isDark = true,
  isDropTargetOver = false,
  onLoadSample,
  onLaunchLyrics,
  onTriggerImport,
}) => {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [activeZone, setActiveZone] = useState<'none' | 'left' | 'right' | 'head'>('none');

  // Reel angles and arm deflections
  const [renderState, setRenderState] = useState({
    leftAngle: 18,
    rightAngle: -12,
    leftArmDeflect: 0,
    rightArmDeflect: 0,
    capstanAngle: 0,
  });

  const springRef = useRef({
    leftReel: { x: 18, v: 0, t: 18 } as SpringState,
    rightReel: { x: -12, v: 0, t: -12 } as SpringState,
    leftArm: { x: 0, v: 0, t: 0 } as SpringState,
    rightArm: { x: 0, v: 0, t: 0 } as SpringState,
    capstan: { x: 0, v: 0, t: 0 } as SpringState,
    lastTime: 0,
    animating: false,
    prevPointerX: null as number | null,
  });

  const requestTick = useCallback(() => {
    const s = springRef.current;
    if (s.animating) return;
    s.animating = true;
    s.lastTime = performance.now();

    const loop = (now: number) => {
      const dt = Math.min((now - s.lastTime) / 1000, 0.05);
      s.lastTime = now;

      const m1 = stepSpring(s.leftReel, dt, 75, 12);
      const m2 = stepSpring(s.rightReel, dt, 75, 12);
      const m3 = stepSpring(s.leftArm, dt, 130, 16);
      const m4 = stepSpring(s.rightArm, dt, 130, 16);
      const m5 = stepSpring(s.capstan, dt, 100, 14);

      setRenderState({
        leftAngle: s.leftReel.x,
        rightAngle: s.rightReel.x,
        leftArmDeflect: s.leftArm.x,
        rightArmDeflect: s.rightArm.x,
        capstanAngle: s.capstan.x,
      });

      if (m1 || m2 || m3 || m4 || m5 || isDropTargetOver) {
        requestAnimationFrame(loop);
      } else {
        s.animating = false;
      }
    };
    requestAnimationFrame(loop);
  }, [isDropTargetOver]);

  // Drop target activation: high-speed spin standby
  useEffect(() => {
    if (isDropTargetOver) {
      const s = springRef.current;
      s.leftReel.t += 360;
      s.rightReel.t += 360;
      s.leftArm.t = 6;
      s.rightArm.t = -6;
      s.capstan.t += 720;
      requestTick();
    }
  }, [isDropTargetOver, requestTick]);

  // Handle pointer interactions across deck
  const handlePointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const svg = svgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 960;
    const y = ((e.clientY - rect.top) / rect.height) * 220;

    const s = springRef.current;

    // Detect zone based on static hit circles (Rule 01)
    const distLeft = Math.hypot(x - 175, y - 105);
    const distRight = Math.hypot(x - 785, y - 105);
    const distHead = Math.hypot(x - 480, y - 85);

    if (distLeft < 82) {
      setActiveZone('left');
    } else if (distRight < 82) {
      setActiveZone('right');
    } else if (distHead < 95) {
      setActiveZone('head');
    } else {
      setActiveZone('none');
    }

    // Velocity-based reel spinning and tape flutter
    if (s.prevPointerX !== null) {
      const dx = x - s.prevPointerX;
      if (Math.abs(dx) > 0.5) {
        s.leftReel.t += dx * 1.8;
        s.rightReel.t += dx * 1.8;
        s.capstan.t += dx * 3.5;
        s.leftArm.t = Math.max(-8, Math.min(8, -dx * 0.4));
        s.rightArm.t = Math.max(-8, Math.min(8, dx * 0.4));
        requestTick();
      }
    }
    s.prevPointerX = x;
  };

  const handlePointerLeave = () => {
    setActiveZone('none');
    const s = springRef.current;
    s.prevPointerX = null;
    s.leftArm.t = 0;
    s.rightArm.t = 0;
    requestTick();
  };

  // Deck geometry constants (960 x 220 viewBox)
  const LX = 175, LY = 105, REEL_R = 76, HUB_R = 19, BORE_R = 6.5;
  const RX = 785, RY = 105;
  const TAPE_L_R = 64; // Supply reel is nearly full
  const TAPE_R_R = 28; // Take-up reel is thin

  // Tension arms positions
  const leftArmAngle = (renderState.leftArmDeflect * Math.PI) / 180;
  const rightArmAngle = (renderState.rightArmDeflect * Math.PI) / 180;
  const L_ROLLER_X = 285 + Math.sin(leftArmAngle) * 6;
  const L_ROLLER_Y = 64 + Math.cos(leftArmAngle) * 4;
  const R_ROLLER_X = 675 + Math.sin(rightArmAngle) * 6;
  const R_ROLLER_Y = 64 + Math.cos(rightArmAngle) * 4;

  // Head block positions
  const HEAD_Y = 82;
  const CAPSTAN_X = 608;
  const CAPSTAN_Y = 76;
  const PINCH_X = 618;
  const PINCH_Y = 76;

  // Render 3 cutout holes on a reel
  const renderReelCutouts = (cx: number, cy: number, angleDeg: number, tapeRadius: number) => {
    const angleRad = (angleDeg * Math.PI) / 180;
    const cutouts = [0, 1, 2].map((i) => {
      const a = angleRad + (i * 2 * Math.PI) / 3;
      const dist = (HUB_R + tapeRadius) * 0.52;
      const hx = cx + Math.cos(a) * dist;
      const hy = cy + Math.sin(a) * dist;
      return { hx, hy, r: 12 };
    });

    const spokes = [0, 1, 2].map((i) => {
      const a = angleRad + (i * 2 * Math.PI) / 3;
      const x1 = cx + Math.cos(a) * (HUB_R + 1);
      const y1 = cy + Math.sin(a) * (HUB_R + 1);
      const x2 = cx + Math.cos(a) * (REEL_R - 3);
      const y2 = cy + Math.sin(a) * (REEL_R - 3);
      return { x1, y1, x2, y2 };
    });

    return (
      <>
        {/* Radial spoke markers */}
        {spokes.map((s, idx) => (
          <line
            key={`spoke-${idx}`}
            x1={s.x1}
            y1={s.y1}
            x2={s.x2}
            y2={s.y2}
            stroke="rgba(255, 255, 255, 0.12)"
            strokeWidth="1"
          />
        ))}
        {/* Precision cutout holes */}
        {cutouts.map((c, idx) => (
          <circle
            key={`cutout-${idx}`}
            cx={c.hx}
            cy={c.hy}
            r={c.r}
            fill="#181A1B"
            stroke="rgba(255, 255, 255, 0.22)"
            strokeWidth="1"
          />
        ))}
      </>
    );
  };

  // Tape ribbon path coordinates
  const tapePathD = `
    M ${LX + TAPE_L_R * 0.82} ${LY - TAPE_L_R * 0.58}
    L ${L_ROLLER_X} ${L_ROLLER_Y}
    L 405 ${HEAD_Y}
    L 455 ${HEAD_Y}
    L 505 ${HEAD_Y}
    L 555 ${HEAD_Y}
    L ${CAPSTAN_X} ${CAPSTAN_Y}
    L ${R_ROLLER_X} ${R_ROLLER_Y}
    L ${RX - TAPE_R_R * 0.82} ${RY - TAPE_R_R * 0.58}
  `;

  const tapeStrokeColor = isDropTargetOver
    ? '#00FF66'
    : activeZone !== 'none'
    ? '#FF5500'
    : 'rgba(255, 255, 255, 0.35)';

  return (
    <div
      className={`absolute inset-x-0 top-7 bottom-14 flex flex-col justify-between select-none overflow-hidden transition-colors ${
        isDropTargetOver
          ? 'bg-[#00FF66]/10'
          : isDark
          ? 'bg-[#181A1B]'
          : 'bg-[#EAE7E1]'
      }`}
    >
      {/* FULL-BLEED MECHANICAL TAPE TRANSPORT SVG */}
      <div className="flex-1 min-h-0 w-full relative flex items-center justify-center px-4 pt-1 pb-1">
        <svg
          ref={svgRef}
          viewBox="0 0 960 210"
          preserveAspectRatio="xMidYMid meet"
          onPointerMove={handlePointerMove}
          onPointerLeave={handlePointerLeave}
          className="w-full h-full max-h-[195px] overflow-visible cursor-crosshair"
          shapeRendering="geometricPrecision"
        >
          <defs>
            <linearGradient id="chassisGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#222428" />
              <stop offset="100%" stopColor="#1B1D20" />
            </linearGradient>
            <linearGradient id="tapePackGrad" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#2B2D31" />
              <stop offset="100%" stopColor="#202225" />
            </linearGradient>
          </defs>

          {/* MAIN CHASSIS PLINTH */}
          <rect
            x="30"
            y="10"
            width="900"
            height="188"
            rx="6"
            fill="url(#chassisGrad)"
            stroke="rgba(255, 255, 255, 0.08)"
            strokeWidth="1"
          />

          {/* MILLED RECESS BORDER */}
          <rect
            x="36"
            y="16"
            width="888"
            height="176"
            rx="4"
            fill="none"
            stroke="rgba(0, 0, 0, 0.45)"
            strokeWidth="1"
          />

          {/* FOUR CORNER ALLEN BOLTS */}
          {[
            [44, 24],
            [916, 24],
            [44, 184],
            [916, 184],
          ].map(([bx, by], i) => (
            <g key={`bolt-${i}`}>
              <circle cx={bx} cy={by} r="3" fill="#181A1B" stroke="rgba(255,255,255,0.18)" strokeWidth="1" />
              <circle cx={bx} cy={by} r="1.2" fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="0.8" />
            </g>
          ))}

          {/* SPLICING BLOCK GROOVE (Center bottom) */}
          <g transform="translate(430, 160)">
            <rect x="0" y="0" width="100" height="16" rx="2" fill="#181A1B" stroke="rgba(255,255,255,0.10)" strokeWidth="1" />
            <line x1="20" y1="16" x2="80" y2="0" stroke="rgba(255,255,255,0.22)" strokeWidth="1" />
            <line x1="0" y1="8" x2="100" y2="8" stroke="rgba(255,255,255,0.12)" strokeWidth="1" strokeDasharray="3 3" />
          </g>

          {/* ============================================================== */}
          {/* TAPE PATH RIBBON (Under tape guides, over heads) */}
          {/* ============================================================== */}
          <path
            d={tapePathD}
            fill="none"
            stroke={tapeStrokeColor}
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="transition-colors duration-150"
          />
          {/* Tape centerline grain */}
          <path
            d={tapePathD}
            fill="none"
            stroke="rgba(255, 255, 255, 0.15)"
            strokeWidth="0.8"
            strokeDasharray="2 3"
          />

          {/* TAPE TENSION ARMS & ROLLERS */}
          {/* Left Tension Arm */}
          <g>
            <line
              x1="260"
              y1="130"
              x2={L_ROLLER_X}
              y2={L_ROLLER_Y}
              stroke="rgba(255, 255, 255, 0.25)"
              strokeWidth="2.5"
              strokeLinecap="round"
            />
            <circle cx="260" cy="130" r="4.5" fill="#181A1B" stroke="rgba(255,255,255,0.3)" strokeWidth="1" />
            <circle cx={L_ROLLER_X} cy={L_ROLLER_Y} r="7" fill="#282A2E" stroke="rgba(255,255,255,0.4)" strokeWidth="1" />
            <circle cx={L_ROLLER_X} cy={L_ROLLER_Y} r="2.5" fill="#181A1B" stroke="#FAFAFA" strokeWidth="0.8" />
          </g>

          {/* Right Tension Arm */}
          <g>
            <line
              x1="700"
              y1="130"
              x2={R_ROLLER_X}
              y2={R_ROLLER_Y}
              stroke="rgba(255, 255, 255, 0.25)"
              strokeWidth="2.5"
              strokeLinecap="round"
            />
            <circle cx="700" cy="130" r="4.5" fill="#181A1B" stroke="rgba(255,255,255,0.3)" strokeWidth="1" />
            <circle cx={R_ROLLER_X} cy={R_ROLLER_Y} r="7" fill="#282A2E" stroke="rgba(255,255,255,0.4)" strokeWidth="1" />
            <circle cx={R_ROLLER_X} cy={R_ROLLER_Y} r="2.5" fill="#181A1B" stroke="#FAFAFA" strokeWidth="0.8" />
          </g>

          {/* ============================================================== */}
          {/* CENTER TAPE HEAD BLOCK (Erase, Sync, Playback, Capstan, Pinch) */}
          {/* ============================================================== */}
          <g className="cursor-pointer">
            {/* Base mounting block */}
            <rect
              x="375"
              y="52"
              width="210"
              height="70"
              rx="4"
              fill="#202225"
              stroke={activeZone === 'head' ? '#FF5500' : 'rgba(255, 255, 255, 0.14)'}
              strokeWidth="1.2"
              className="transition-colors"
            />

            {/* Left tape guide pillar */}
            <circle cx="390" cy={HEAD_Y} r="4.5" fill="#282A2E" stroke="rgba(255,255,255,0.3)" strokeWidth="1" />
            <circle cx="390" cy={HEAD_Y} r="1.8" fill="#181A1B" />

            {/* Erase Head */}
            <g transform="translate(415, 66)">
              <rect x="0" y="0" width="24" height="28" rx="2" fill="#181A1B" stroke="rgba(255,255,255,0.25)" strokeWidth="1" />
              <line x1="12" y1="2" x2="12" y2="26" stroke="#FF5500" strokeWidth="1" opacity="0.75" />
            </g>

            {/* Sync / Record Head */}
            <g transform="translate(468, 66)">
              <rect x="0" y="0" width="24" height="28" rx="2" fill="#181A1B" stroke="rgba(255,255,255,0.25)" strokeWidth="1" />
              <line x1="12" y1="2" x2="12" y2="26" stroke="#FAFAFA" strokeWidth="1" opacity="0.6" />
            </g>

            {/* Playback Head */}
            <g transform="translate(521, 66)">
              <rect x="0" y="0" width="24" height="28" rx="2" fill="#181A1B" stroke="rgba(255,255,255,0.25)" strokeWidth="1" />
              <line x1="12" y1="2" x2="12" y2="26" stroke="#FF5500" strokeWidth="1" opacity="0.75" />
            </g>

            {/* Right tape guide pillar */}
            <circle cx="570" cy={HEAD_Y} r="4.5" fill="#282A2E" stroke="rgba(255,255,255,0.3)" strokeWidth="1" />
            <circle cx="570" cy={HEAD_Y} r="1.8" fill="#181A1B" />

            {/* Capstan Shaft (Spinning steel pin) */}
            <g transform={`translate(${CAPSTAN_X}, ${CAPSTAN_Y}) rotate(${renderState.capstanAngle})`}>
              <circle cx="0" cy="0" r="5" fill="#FAFAFA" stroke="rgba(0,0,0,0.4)" strokeWidth="1" />
              <line x1="-3.5" y1="0" x2="3.5" y2="0" stroke="#181A1B" strokeWidth="1" />
            </g>

            {/* Rubber Pinch Roller */}
            <circle
              cx={PINCH_X}
              cy={PINCH_Y}
              r="11"
              fill="#181A1B"
              stroke="rgba(255, 255, 255, 0.4)"
              strokeWidth="1.5"
            />
            <circle cx={PINCH_X} cy={PINCH_Y} r="4" fill="#282A2E" stroke="rgba(255,255,255,0.2)" strokeWidth="1" />
          </g>

          {/* ============================================================== */}
          {/* LEFT REEL (SUPPLY · LARGE WOUND TAPE PACK) */}
          {/* ============================================================== */}
          <g className="cursor-pointer">
            {/* Outer reel chassis shadow/milled well */}
            <circle
              cx={LX}
              cy={LY}
              r={REEL_R + 3}
              fill="#181A1B"
              stroke="rgba(255, 255, 255, 0.05)"
              strokeWidth="1"
            />

            {/* Wound magnetic tape pack */}
            <circle
              cx={LX}
              cy={LY}
              r={TAPE_L_R}
              fill="url(#tapePackGrad)"
              stroke="rgba(255, 255, 255, 0.15)"
              strokeWidth="1"
            />
            {/* Tape winding concentric ring cues */}
            <circle cx={LX} cy={LY} r={TAPE_L_R - 8} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="0.8" />
            <circle cx={LX} cy={LY} r={TAPE_L_R - 16} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="0.8" />
            <circle cx={LX} cy={LY} r={TAPE_L_R - 24} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="0.8" />

            {/* Outer Aluminum Flange (Hairline stroke, highlights on hover) */}
            <circle
              cx={LX}
              cy={LY}
              r={REEL_R}
              fill="none"
              stroke={activeZone === 'left' ? '#FF5500' : 'rgba(255, 255, 255, 0.35)'}
              strokeWidth={activeZone === 'left' ? '1.8' : '1.2'}
              className="transition-colors"
            />
            <circle
              cx={LX}
              cy={LY}
              r={REEL_R - 2}
              fill="none"
              stroke="rgba(255, 255, 255, 0.12)"
              strokeWidth="0.8"
            />

            {/* Dynamic cutouts & rotating spokes */}
            {renderReelCutouts(LX, LY, renderState.leftAngle, TAPE_L_R)}

            {/* Center NAB Hub */}
            <circle cx={LX} cy={LY} r={HUB_R} fill="#202225" stroke="rgba(255, 255, 255, 0.3)" strokeWidth="1" />
            {/* 3 NAB hub locking splines */}
            {[0, 120, 240].map((deg) => {
              const a = ((renderState.leftAngle + deg) * Math.PI) / 180;
              return (
                <rect
                  key={`spline-l-${deg}`}
                  x={LX + Math.cos(a) * (BORE_R + 2) - 1.5}
                  y={LY + Math.sin(a) * (BORE_R + 2) - 1.5}
                  width="3"
                  height="3"
                  fill="#FAFAFA"
                  rx="0.5"
                />
              );
            })}
            {/* Center spindle bore */}
            <circle cx={LX} cy={LY} r={BORE_R} fill="#181A1B" stroke="#FF5500" strokeWidth="1.2" />
            <circle cx={LX} cy={LY} r="1.8" fill="#FAFAFA" />
          </g>

          {/* ============================================================== */}
          {/* RIGHT REEL (TAKE-UP · THIN TAPE PACK) */}
          {/* ============================================================== */}
          <g className="cursor-pointer">
            {/* Outer reel chassis shadow/milled well */}
            <circle
              cx={RX}
              cy={LY}
              r={REEL_R + 3}
              fill="#181A1B"
              stroke="rgba(255, 255, 255, 0.05)"
              strokeWidth="1"
            />

            {/* Wound magnetic tape pack (thin) */}
            <circle
              cx={RX}
              cy={LY}
              r={TAPE_R_R}
              fill="url(#tapePackGrad)"
              stroke="rgba(255, 255, 255, 0.15)"
              strokeWidth="1"
            />

            {/* Outer Aluminum Flange (Hairline stroke, highlights on hover) */}
            <circle
              cx={RX}
              cy={LY}
              r={REEL_R}
              fill="none"
              stroke={activeZone === 'right' ? '#FF5500' : 'rgba(255, 255, 255, 0.35)'}
              strokeWidth={activeZone === 'right' ? '1.8' : '1.2'}
              className="transition-colors"
            />
            <circle
              cx={RX}
              cy={LY}
              r={REEL_R - 2}
              fill="none"
              stroke="rgba(255, 255, 255, 0.12)"
              strokeWidth="0.8"
            />

            {/* Dynamic cutouts & rotating spokes */}
            {renderReelCutouts(RX, RY, renderState.rightAngle, TAPE_R_R)}

            {/* Center NAB Hub */}
            <circle cx={RX} cy={RY} r={HUB_R} fill="#202225" stroke="rgba(255, 255, 255, 0.3)" strokeWidth="1" />
            {/* 3 NAB hub locking splines */}
            {[0, 120, 240].map((deg) => {
              const a = ((renderState.rightAngle + deg) * Math.PI) / 180;
              return (
                <rect
                  key={`spline-r-${deg}`}
                  x={RX + Math.cos(a) * (BORE_R + 2) - 1.5}
                  y={RY + Math.sin(a) * (BORE_R + 2) - 1.5}
                  width="3"
                  height="3"
                  fill="#FAFAFA"
                  rx="0.5"
                />
              );
            })}
            {/* Center spindle bore */}
            <circle cx={RX} cy={RY} r={BORE_R} fill="#181A1B" stroke="rgba(255,255,255,0.4)" strokeWidth="1.2" />
            <circle cx={RX} cy={RY} r="1.8" fill="#FF5500" />
          </g>
        </svg>
      </div>

      {/* QUIET HARDWARE CONTROLS & STATUS DOCK (TEENAGE ENGINEERING STYLE) */}
      <div className="w-full shrink-0 flex items-center justify-between px-6 py-1.5 border-t border-white/5 bg-[#181A1B] z-10">
        {/* Left Status Readout */}
        <div className="flex items-center gap-2 text-[8px] font-mono tracking-widest uppercase">
          <span
            className={`w-1.5 h-1.5 rounded-full transition-colors ${
              isDropTargetOver
                ? 'bg-[#00FF66] animate-pulse'
                : activeZone !== 'none'
                ? 'bg-[#FF5500]'
                : 'bg-white/30'
            }`}
          />
          <span className="text-[#A1A1AA]">
            {isDropTargetOver
              ? 'RELEASE MEDIA TO THREAD TAPE'
              : activeZone === 'left'
              ? 'SUPPLY SPOOL // 1/4" HIGH BIAS'
              : activeZone === 'right'
              ? 'TAKE-UP SPOOL // MOTOR STANDBY'
              : activeZone === 'head'
              ? '3-HEAD PLAYBACK // AZIMUTH 90°'
              : 'EMPTY TRANSPORT // READY'}
          </span>
        </div>

        {/* Center Hardware Action Buttons */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => onLoadSample?.('dino')}
            className="px-3 py-1 text-[8px] font-mono font-bold tracking-widest uppercase rounded-[3px] border border-white/15 bg-[#202225] text-[#FAFAFA] hover:border-[#FF5500] hover:text-[#FF5500] active:scale-95 transition-all shadow-sm cursor-pointer"
          >
            + LOAD DINO RUNNER
          </button>

          <button
            type="button"
            onClick={() => onTriggerImport?.()}
            className="px-3 py-1 text-[8px] font-mono font-bold tracking-widest uppercase rounded-[3px] border border-white/15 bg-[#202225] text-[#FAFAFA] hover:border-[#FF5500] hover:text-[#FF5500] active:scale-95 transition-all shadow-sm cursor-pointer"
          >
            ⇪ IMPORT MEDIA
          </button>

          <button
            type="button"
            onClick={() => onLaunchLyrics?.()}
            className="px-3 py-1 text-[8px] font-mono font-bold tracking-widest uppercase rounded-[3px] border border-[#FF5500]/50 bg-[#FF5500]/15 text-[#FF5500] hover:bg-[#FF5500] hover:text-black active:scale-95 transition-all shadow-sm cursor-pointer"
          >
            ✦ KINETIC LYRICS
          </button>
        </div>

        {/* Right Speed / Frame Telemetry */}
        <div className="text-[8px] font-mono tracking-widest uppercase text-[#71717A]">
          30 FPS · 00:00:00:00
        </div>
      </div>
    </div>
  );
};
