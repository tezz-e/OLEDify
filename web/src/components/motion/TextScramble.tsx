import React, { useState, useEffect, useRef, useCallback } from 'react';

interface TextScrambleProps {
  text: string;
  className?: string;
  triggerOnHover?: boolean;
  durationMs?: number;
  chars?: string;
}

const DEFAULT_CHARS = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ_';

/**
 * TextScramble (Motion-Primitives inspired)
 * Cyberpunk / Teenage Engineering monospace glitch-decrypt effect on mount or hover.
 */
export const TextScramble: React.FC<TextScrambleProps> = ({
  text,
  className = '',
  triggerOnHover = true,
  durationMs = 280,
  chars = DEFAULT_CHARS,
}) => {
  const [displayText, setDisplayText] = useState(text);
  const isScramblingRef = useRef(false);
  const animFrameRef = useRef<number | null>(null);

  const scramble = useCallback(() => {
    if (isScramblingRef.current) return;
    isScramblingRef.current = true;

    const start = performance.now();
    const len = text.length;

    const frame = (now: number) => {
      const elapsed = now - start;
      const progress = Math.min(1, elapsed / durationMs);

      let result = '';
      for (let i = 0; i < len; i++) {
        if (text[i] === ' ' || text[i] === '•' || text[i] === '▲' || text[i] === '/') {
          result += text[i];
          continue;
        }

        // Revealed characters from left to right as progress increases
        if (i < progress * len) {
          result += text[i];
        } else {
          result += chars[Math.floor(Math.random() * chars.length)];
        }
      }

      setDisplayText(result);

      if (progress < 1) {
        animFrameRef.current = requestAnimationFrame(frame);
      } else {
        setDisplayText(text);
        isScramblingRef.current = false;
      }
    };

    animFrameRef.current = requestAnimationFrame(frame);
  }, [text, durationMs, chars]);

  useEffect(() => {
    setDisplayText(text);
  }, [text]);

  const handleMouseEnter = () => {
    if (triggerOnHover) {
      scramble();
    }
  };

  return (
    <span
      onMouseEnter={handleMouseEnter}
      className={`font-mono inline-block ${className}`}
    >
      {displayText}
    </span>
  );
};
