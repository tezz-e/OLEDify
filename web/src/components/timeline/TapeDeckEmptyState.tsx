import React, { useState } from 'react';
import { motion } from 'framer-motion';

interface TapeDeckEmptyStateProps {
  isDark?: boolean;
  isDropTargetOver?: boolean;
  onLoadSample?: (sampleId: string) => void;
  onLaunchLyrics?: () => void;
  onTriggerImport?: () => void;
}

export const TapeDeckEmptyState: React.FC<TapeDeckEmptyStateProps> = ({
  isDark = true,
  isDropTargetOver = false,
  onLoadSample,
  onLaunchLyrics,
  onTriggerImport,
}) => {
  const [pointerOffset, setPointerOffset] = useState({ x: 0.5, y: 0.5 });

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const y = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height));
    setPointerOffset({ x, y });
  };

  const reelRotationLeft = (pointerOffset.x - 0.5) * 180;
  const reelRotationRight = (pointerOffset.x - 0.5) * -180;
  const tapeDeflection = (pointerOffset.y - 0.5) * 14;

  return (
    <div
      onPointerMove={handlePointerMove}
      className={`absolute inset-0 top-7 flex flex-col justify-between px-4 pt-2 pb-14 select-none overflow-hidden transition-colors ${
        isDropTargetOver
          ? isDark ? 'bg-[#FF5500]/10 border-2 border-dashed border-[#FF5500]' : 'bg-[#FF5500]/10 border-2 border-dashed border-[#FF5500]'
          : isDark ? 'bg-[#181A1B]' : 'bg-[#EAE7E1]'
      }`}
    >
      {/* TOP TRACK SPROCKET GUIDE */}
      <div className="w-full flex items-center justify-between px-2 text-[8px] font-mono tracking-widest text-white/20 border-b border-white/5 pb-1 shrink-0">
        <span className="flex items-center gap-1.5 text-white/40">
          <span className="w-1.5 h-1.5 rounded-full bg-[#FF5500]" />
          FEED REEL // MOTOR A
        </span>
        <div className="flex-1 flex justify-center gap-2 overflow-hidden mx-4 opacity-40">
          {Array.from({ length: 48 }).map((_, i) => (
            <span key={i} className="inline-block w-1 h-1 bg-white/30 rounded-[0.5px]" />
          ))}
        </div>
        <span className="text-white/40">TAKE-UP // 30 FPS MOTOR B</span>
      </div>

      {/* MAIN HARDWARE DECK (REEL A - SPLICING BAY - REEL B) */}
      <div className="flex-1 flex items-center justify-between gap-4 px-2 py-1 min-h-0 relative">
        {/* LEFT FEED REEL */}
        <div className="flex flex-col items-center justify-center shrink-0 w-28 h-full">
          <motion.div
            animate={{ rotate: reelRotationLeft }}
            transition={{ type: 'spring', damping: 20, stiffness: 120 }}
            className="w-20 h-20 rounded-full border border-white/20 bg-[#202225] shadow-inner relative flex items-center justify-center"
          >
            {/* Reel Spoke Cutouts */}
            <div className="absolute inset-2 rounded-full border border-dashed border-white/10" />
            <div className="w-6 h-6 rounded-full border-2 border-[#FF5500]/60 bg-[#181A1B] flex items-center justify-center">
              <div className="w-1.5 h-1.5 rounded-full bg-[#FAFAFA]" />
            </div>
            {/* 3 Spoke Markers */}
            {[0, 120, 240].map((deg) => (
              <div
                key={deg}
                className="absolute w-0.5 h-7 bg-white/25 origin-bottom"
                style={{ transform: `rotate(${deg}deg) translateY(-10px)` }}
              />
            ))}
          </motion.div>
          <span className="text-[7px] font-mono uppercase tracking-widest text-[#71717A] mt-1">REEL 01 // SUPPLY</span>
        </div>

        {/* CENTER SPLICING BLOCK & BUFFER APERTURE */}
        <div className="flex-1 max-w-2xl h-full flex flex-col items-center justify-center relative px-4">
          {/* Background Milled Channel */}
          <div className="absolute inset-x-2 inset-y-1 rounded-[4px] border border-white/10 bg-[#202225]/80 shadow-inner flex flex-col justify-between p-2 pointer-events-none">
            {/* Top Corner Registration */}
            <div className="flex justify-between items-center text-[7px] font-mono text-white/30">
              <span>┌ 45° SPLICING GATE</span>
              <span>AZIMUTH 90° ┐</span>
            </div>
            {/* Bottom Telemetry */}
            <div className="flex justify-between items-center text-[7px] font-mono text-white/30">
              <span>└ TAPE HEAD: STANDBY</span>
              <span>BUFFER: 0 FRAMES ┘</span>
            </div>
          </div>

          {/* Magnetic Head Tape Path Guide */}
          <svg className="absolute inset-0 w-full h-full pointer-events-none" preserveAspectRatio="none">
            <path
              d={`M 10 ${48 + tapeDeflection} Q ${250} ${42 - tapeDeflection}, ${500} ${48 + tapeDeflection}`}
              fill="none"
              stroke={isDropTargetOver ? '#00FF66' : 'rgba(255, 85, 0, 0.45)'}
              strokeWidth="2"
              strokeDasharray="4 3"
            />
          </svg>

          {/* Central Callout & Actions */}
          <div className="relative z-10 flex flex-col items-center text-center space-y-2 pointer-events-auto">
            <div>
              <p className={`text-[11px] font-mono font-bold tracking-widest uppercase ${
                isDropTargetOver ? 'text-[#00FF66]' : isDark ? 'text-[#FAFAFA]' : 'text-[#1A1A1A]'
              }`}>
                {isDropTargetOver ? '◄ RELEASE ASSET TO THREAD MAGNETIC TAPE ►' : 'MAGNETIC TAPE TRANSPORT // BUFFER EMPTY'}
              </p>
              <p className="text-[8px] font-mono tracking-wider text-[#A1A1AA] mt-0.5">
                Drop any video, GIF, or image asset anywhere on this track
              </p>
            </div>

            {/* Quick Action Hardware Buttons */}
            <div className="flex items-center gap-2 pt-1">
              <button
                type="button"
                onClick={() => onLoadSample?.('dino')}
                className="px-2.5 py-1 text-[8px] font-mono font-bold tracking-widest uppercase rounded-[3px] border border-white/15 bg-[#282A2E] text-[#FAFAFA] hover:border-[#FF5500] hover:text-[#FF5500] active:scale-95 transition-all shadow-sm cursor-pointer"
              >
                + LOAD DINO RUNNER
              </button>
              <button
                type="button"
                onClick={() => onTriggerImport?.()}
                className="px-2.5 py-1 text-[8px] font-mono font-bold tracking-widest uppercase rounded-[3px] border border-white/15 bg-[#282A2E] text-[#FAFAFA] hover:border-[#FF5500] hover:text-[#FF5500] active:scale-95 transition-all shadow-sm cursor-pointer"
              >
                ⇪ IMPORT MEDIA
              </button>
              <button
                type="button"
                onClick={() => onLaunchLyrics?.()}
                className="px-2.5 py-1 text-[8px] font-mono font-bold tracking-widest uppercase rounded-[3px] border border-[#FF5500]/50 bg-[#FF5500]/15 text-[#FF5500] hover:bg-[#FF5500] hover:text-black active:scale-95 transition-all shadow-sm cursor-pointer"
              >
                ✦ KINETIC LYRICS
              </button>
            </div>
          </div>
        </div>

        {/* RIGHT TAKE-UP REEL */}
        <div className="flex flex-col items-center justify-center shrink-0 w-28 h-full">
          <motion.div
            animate={{ rotate: reelRotationRight }}
            transition={{ type: 'spring', damping: 20, stiffness: 120 }}
            className="w-20 h-20 rounded-full border border-white/20 bg-[#202225] shadow-inner relative flex items-center justify-center"
          >
            {/* Reel Spoke Cutouts */}
            <div className="absolute inset-2 rounded-full border border-dashed border-white/10" />
            <div className="w-6 h-6 rounded-full border-2 border-white/40 bg-[#181A1B] flex items-center justify-center">
              <div className="w-1.5 h-1.5 rounded-full bg-[#FF5500]" />
            </div>
            {/* 4 Capstan Pins */}
            {[0, 90, 180, 270].map((deg) => (
              <div
                key={deg}
                className="absolute w-1 h-1 rounded-full bg-white/40"
                style={{ transform: `rotate(${deg}deg) translateY(-24px)` }}
              />
            ))}
          </motion.div>
          <span className="text-[7px] font-mono uppercase tracking-widest text-[#71717A] mt-1">REEL 02 // TAKE-UP</span>
        </div>
      </div>

      {/* BOTTOM TRACK SPROCKET GUIDE */}
      <div className="w-full flex items-center justify-between px-2 text-[8px] font-mono tracking-widest text-white/20 border-t border-white/5 pt-1 shrink-0">
        <span className="text-[#71717A]">CAPSTAN IDLE // 00:00:00:00</span>
        <div className="flex-1 flex justify-center gap-2 overflow-hidden mx-4 opacity-40">
          {Array.from({ length: 48 }).map((_, i) => (
            <span key={i} className="inline-block w-1 h-1 bg-white/30 rounded-[0.5px]" />
          ))}
        </div>
        <span className="text-[#71717A]">DMA BUFFER STANDBY</span>
      </div>
    </div>
  );
};
