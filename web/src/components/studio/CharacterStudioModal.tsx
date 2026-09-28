import React, { useState, useEffect, useRef } from 'react';
import { createAvatar } from '@dicebear/core';
import { bottts, pixelArt, funEmoji, adventurer } from '@dicebear/collection';
import { WigglyEngine } from '../../engine/wigglyEngine';
import { DecodedMedia, ExtractedFrame } from '../../types/media';

interface CharacterStudioModalProps {
  onClose: () => void;
  onInject: (media: DecodedMedia) => void;
}

export function CharacterStudioModal({ onClose, onInject }: CharacterStudioModalProps) {
  const [mode, setMode] = useState<'avatar' | 'text'>('text');
  const [textContent, setTextContent] = useState('OLED_STUDIO');
  const [fontFamily, setFontFamily] = useState('VT323');
  const [seed, setSeed] = useState('oled-studio');
  const [archetype, setArchetype] = useState<'bottts' | 'pixelArt' | 'adventurer' | 'funEmoji'>('bottts');
  const [roughness, setRoughness] = useState(2.0);
  const [isGenerating, setIsGenerating] = useState(false);
  const previewCanvasRef = useRef<HTMLCanvasElement>(null);
  const [wigglyCache, setWigglyCache] = useState<HTMLCanvasElement[]>([]);
  
  // Ref for animation loop
  const requestRef = useRef<number>();
  const startTimeRef = useRef<number>();

  // Generate SVG
  const generateSvg = () => {
    if (mode === 'text') {
      const fontUrl = fontFamily === 'VT323' ? 'VT323' : fontFamily;
      return `
        <svg width="128" height="64" xmlns="http://www.w3.org/2000/svg">
          <style>
            @import url('https://fonts.googleapis.com/css2?family=${fontUrl}&amp;display=swap');
            text { font-family: '${fontFamily}', ${fontFamily === 'VT323' ? 'monospace' : 'sans-serif'}; }
          </style>
          <rect width="128" height="64" fill="transparent" />
          <text x="64" y="32" font-size="24" fill="white" text-anchor="middle" dominant-baseline="middle">${textContent}</text>
        </svg>
      `;
    } else {
      let collection;
      switch (archetype) {
        case 'pixelArt': collection = pixelArt; break;
        case 'adventurer': collection = adventurer; break;
        case 'funEmoji': collection = funEmoji; break;
        case 'bottts': default: collection = bottts; break;
      }
      
      const avatar = createAvatar(collection as any, {
        seed: seed,
        size: 128,
        backgroundColor: ["transparent"],
      });
      return avatar.toString();
    }
  };

  // Re-generate wiggly cache when params change
  useEffect(() => {
    const updateCache = async () => {
      setIsGenerating(true);
      const svg = generateSvg();
      
      if (mode === 'text') {
        const cache = await WigglyEngine.createWigglyCache(svg, 128, 64, roughness);
        setWigglyCache(cache);
      } else {
        // Avatars use 64x64 mapped to center
        const cache = await WigglyEngine.createWigglyCache(svg, 64, 64, roughness);
        setWigglyCache(cache);
      }
      setIsGenerating(false);
    };
    updateCache();
  }, [mode, textContent, fontFamily, seed, archetype, roughness]);

  // Render loop for preview
  const renderFrame = (time: number) => {
    if (!startTimeRef.current) startTimeRef.current = time;
    const elapsedSeconds = (time - startTimeRef.current) / 1000;
    
    if (previewCanvasRef.current && wigglyCache.length === 3) {
      const ctx = previewCanvasRef.current.getContext('2d');
      if (ctx) {
        // Clear background
        ctx.fillStyle = '#000';
        ctx.fillRect(0, 0, 128, 64);
        
        // Get current frame from wiggly engine
        const phaseIndex = WigglyEngine.getActivePhase(elapsedSeconds);
        const activeFrame = wigglyCache[phaseIndex];
        
        // Basic physics: bounce effect
        const bounceAmplitude = 4;
        const bounceSpeed = 4; // bounces per second
        const yOffset = mode === 'avatar' ? Math.sin(elapsedSeconds * bounceSpeed * Math.PI) * bounceAmplitude : 0;
        
        // Draw character (centered horizontally, bouncing vertically)
        // Draw at integer coordinates to prevent anti-aliasing of 1-bit dithered image
        ctx.imageSmoothingEnabled = false;
        if (mode === 'text') {
           ctx.drawImage(activeFrame, 0, 0);
        } else {
           ctx.drawImage(activeFrame, 32, Math.round(yOffset - 10));
        }
      }
    }
    requestRef.current = requestAnimationFrame(renderFrame);
  };

  useEffect(() => {
    requestRef.current = requestAnimationFrame(renderFrame);
    return () => cancelAnimationFrame(requestRef.current!);
  }, [wigglyCache]);

  const handleInject = () => {
    if (wigglyCache.length !== 3) return;
    
    // Create a 30-frame sequence (1 second) of the bouncing character
    const frames: ExtractedFrame[] = [];
    const totalFrames = 30;
    const fps = 30;
    
    for (let i = 0; i < totalFrames; i++) {
      const elapsedSeconds = i / fps;
      const phaseIndex = WigglyEngine.getActivePhase(elapsedSeconds);
      
      const canvas = document.createElement('canvas');
      canvas.width = 128;
      canvas.height = 64;
      const ctx = canvas.getContext('2d')!;
      
      // Black background
      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, 128, 64);
      
      // Bounce
      const bounceAmplitude = 4;
      const bounceSpeed = 4;
      const yOffset = mode === 'avatar' ? Math.sin(elapsedSeconds * bounceSpeed * Math.PI) * bounceAmplitude : 0;
      
      ctx.imageSmoothingEnabled = false;
      if (mode === 'text') {
         ctx.drawImage(wigglyCache[phaseIndex], 0, 0);
      } else {
         ctx.drawImage(wigglyCache[phaseIndex], 32, Math.round(yOffset - 10));
      }
      
      // Convert to ImageData
      const imageData = ctx.getImageData(0, 0, 128, 64);
      frames.push({
        index: i,
        imageData,
        timestampMs: elapsedSeconds * 1000,
        durationMs: 1000 / fps
      });
    }

    const media: DecodedMedia = {
      sourceInfo: {
        type: 'sequence',
        filename: mode === 'text' ? `Wiggly_Text_${textContent.replace(/\s+/g, '_')}.oled` : `Wiggly_${archetype}_${seed}.oled`,
        sourceWidth: 128,
        sourceHeight: 64,
        durationMs: 1000,
        frameCount: totalFrames,
        fps: fps
      },
      frames
    };

    onInject(media);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="bg-[#f5f0eb] border-2 border-[#1a1a1a] shadow-[8px_8px_0_#1a1a1a] w-full max-w-3xl flex flex-col">
        {/* Header */}
        <div className="bg-[#1a1a1a] text-[#f5f0eb] p-3 flex justify-between items-center">
          <h2 className="font-mono text-xl tracking-widest uppercase">✨ Character Studio</h2>
          <button onClick={onClose} className="hover:text-[#e85d2a]">✕</button>
        </div>

        <div className="p-6 flex flex-col md:flex-row gap-6">
          {/* Controls */}
          <div className="flex-1 flex flex-col gap-4 font-mono text-[#1a1a1a]">
            {/* Mode Switch */}
            <div className="flex gap-2">
              <button 
                onClick={() => setMode('text')}
                className={`flex-1 py-2 font-bold uppercase tracking-widest border-2 border-[#1a1a1a] ${mode === 'text' ? 'bg-[#1a1a1a] text-white' : 'bg-white hover:bg-gray-100'}`}
              >
                Text
              </button>
              <button 
                onClick={() => setMode('avatar')}
                className={`flex-1 py-2 font-bold uppercase tracking-widest border-2 border-[#1a1a1a] ${mode === 'avatar' ? 'bg-[#1a1a1a] text-white' : 'bg-white hover:bg-gray-100'}`}
              >
                Avatar
              </button>
            </div>

            {mode === 'text' ? (
              <>
                <div>
                  <label className="block text-xs uppercase tracking-wider font-bold mb-1">Lyric Text</label>
                  <input 
                    type="text" 
                    value={textContent}
                    onChange={e => setTextContent(e.target.value)}
                    className="w-full bg-white border-2 border-[#1a1a1a] p-2 outline-none focus:border-[#e85d2a]"
                  />
                </div>
                <div>
                  <label className="block text-xs uppercase tracking-wider font-bold mb-1">Font</label>
                  <select 
                    value={fontFamily}
                    onChange={e => setFontFamily(e.target.value)}
                    className="w-full bg-white border-2 border-[#1a1a1a] p-2 outline-none focus:border-[#e85d2a]"
                  >
                    <option value="VT323">VT323 (Pixel)</option>
                    <option value="Impact">Impact (Heavy)</option>
                    <option value="Bangers">Bangers (Comic)</option>
                    <option value="Oswald">Oswald (Tall)</option>
                  </select>
                </div>
              </>
            ) : (
              <>
                <div>
                  <label className="block text-xs uppercase tracking-wider font-bold mb-1">Archetype</label>
                  <select 
                    value={archetype}
                    onChange={e => setArchetype(e.target.value as any)}
                    className="w-full bg-white border-2 border-[#1a1a1a] p-2 outline-none focus:border-[#e85d2a]"
                  >
                    <option value="bottts">Robot (Bottts)</option>
                    <option value="pixelArt">Pixel Character</option>
                    <option value="funEmoji">Fun Emoji</option>
                    <option value="adventurer">Adventurer</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs uppercase tracking-wider font-bold mb-1">Seed (DNA)</label>
                  <div className="flex gap-2">
                    <input 
                      type="text" 
                      value={seed}
                      onChange={e => setSeed(e.target.value)}
                      className="flex-1 bg-white border-2 border-[#1a1a1a] p-2 outline-none focus:border-[#e85d2a]"
                    />
                    <button 
                      onClick={() => setSeed(Math.random().toString(36).substring(7))}
                      className="bg-[#1a1a1a] text-white px-4 border-2 border-[#1a1a1a] hover:bg-[#e85d2a] hover:border-[#e85d2a]"
                    >
                      🎲
                    </button>
                  </div>
                </div>
              </>
            )}

            <div>
              <label className="block text-xs uppercase tracking-wider font-bold mb-1">Wiggly Roughness: {roughness}</label>
              <input 
                type="range" min="0" max="10" step="0.5" value={roughness}
                onChange={e => setRoughness(parseFloat(e.target.value))}
                className="w-full"
              />
            </div>
          </div>

          {/* Preview */}
          <div className="flex-1 flex flex-col items-center justify-center gap-4">
            <div className="relative">
              {/* Scale it up for visibility */}
              <canvas 
                ref={previewCanvasRef} 
                width={128} 
                height={64} 
                className="w-[256px] h-[128px] border-4 border-[#1a1a1a] shadow-[4px_4px_0_#1a1a1a]"
                style={{ imageRendering: 'pixelated' }}
              />
              {isGenerating && (
                <div className="absolute inset-0 bg-black/50 flex items-center justify-center text-white font-mono text-xs">
                  BOILING...
                </div>
              )}
            </div>
            
            <button 
              onClick={handleInject}
              disabled={isGenerating}
              className="w-full py-3 bg-[#e85d2a] text-white font-mono font-bold tracking-widest border-2 border-[#1a1a1a] shadow-[4px_4px_0_#1a1a1a] hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[2px_2px_0_#1a1a1a] transition-all disabled:opacity-50"
            >
              INJECT TO TIMELINE ↴
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
