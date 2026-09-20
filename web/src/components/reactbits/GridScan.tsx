import React, { useEffect, useRef } from 'react';

interface GridScanProps {
  gridColor?: string;
  scanColor?: string;
  gridSize?: number;
  scanSpeed?: number;
  className?: string;
}

export const GridScan: React.FC<GridScanProps> = ({
  gridColor = '#1A1A1A20',
  scanColor = '#E85D2A',
  gridSize = 40,
  scanSpeed = 2,
  className = ''
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const scanlineRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let animationFrameId: number;
    let position = -200;
    
    const animate = () => {
      if (!containerRef.current || !scanlineRef.current) return;
      const height = containerRef.current.offsetHeight;
      
      position += scanSpeed;
      if (position > height + 200) {
        position = -200;
      }
      
      scanlineRef.current.style.transform = `translateY(${position}px)`;
      animationFrameId = requestAnimationFrame(animate);
    };
    
    animate();
    return () => cancelAnimationFrame(animationFrameId);
  }, [scanSpeed]);

  return (
    <div 
      ref={containerRef}
      className={`absolute inset-0 overflow-hidden pointer-events-none ${className}`}
      style={{
        backgroundImage: `
          repeating-linear-gradient(0deg, ${gridColor} 0 1px, transparent 1px ${gridSize}px),
          repeating-linear-gradient(90deg, ${gridColor} 0 1px, transparent 1px ${gridSize}px)
        `,
        backgroundPosition: 'center center'
      }}
    >
      <div 
        ref={scanlineRef}
        className="absolute left-0 right-0 h-[4px] opacity-70"
        style={{
          background: scanColor,
          boxShadow: `0 0 15px ${scanColor}, 0 0 30px ${scanColor}`
        }}
      />
    </div>
  );
};
