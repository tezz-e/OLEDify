import React from 'react';
import { motion } from 'framer-motion';

interface NumberFlowProps {
  value: string | number;
  className?: string;
  digitClassName?: string;
}

const DIGITS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];

/**
 * NumberFlow / Odometer rolling digit transition component.
 * Inspired by Skiper UI #69 Number Flow & React Bits CountUp.
 * Smoothly animates digit transitions on vertical spring reels with zero layout shift.
 */
export const NumberFlow: React.FC<NumberFlowProps> = ({
  value,
  className = '',
  digitClassName = '',
}) => {
  const str = String(value);

  // Tokenize string into numbers (with optional decimals) and non-numeric delimiters
  // e.g. "0000 / 0180 FRAMES" -> ["0000", " / ", "0180", " FRAMES"]
  // e.g. "00:04.2s" -> ["00", ":", "04.2", "s"]
  // e.g. "9.99s" -> ["9.99", "s"]
  const tokens = str.match(/(\d+(?:\.\d+)?|\.\d+|\D+)/g) || [];

  return (
    <span className={`inline-flex items-baseline font-mono tabular-nums leading-none select-none ${className}`}>
      {tokens.map((token, tokenIdx) => {
        const isNumeric = /^\d+(\.\d+)?$|^\.\d+$/.test(token);

        if (!isNumeric) {
          return (
            <span key={`delim-${tokenIdx}-${token}`} className="inline-block whitespace-pre">
              {token}
            </span>
          );
        }

        const parts = token.split('.');
        const hasDot = parts.length === 2;
        const intPart = parts[0] || '';
        const fracPart = hasDot ? parts[1] : null;

        const renderedDigits: React.ReactNode[] = [];

        // Render integer part digits keyed by place value from the right (ones=0, tens=1, etc.)
        for (let i = 0; i < intPart.length; i++) {
          const char = intPart[i];
          const posFromRight = intPart.length - 1 - i;
          const digitVal = parseInt(char, 10);
          const key = `tok-${tokenIdx}-int-${posFromRight}`;

          renderedDigits.push(
            <span
              key={key}
              className={`inline-block overflow-hidden relative h-[1.15em] w-[0.66em] align-text-bottom ${digitClassName}`}
            >
              <motion.span
                animate={{ y: `-${digitVal * 10}%` }}
                transition={{
                  type: 'spring',
                  stiffness: 320,
                  damping: 28,
                  mass: 0.4,
                }}
                className="flex flex-col absolute top-0 left-0 right-0 leading-[1.15em] text-center"
              >
                {DIGITS.map((d) => (
                  <span key={d} className="h-[1.15em] flex items-center justify-center">
                    {d}
                  </span>
                ))}
              </motion.span>
            </span>
          );
        }

        // Render decimal point if present with stable key
        if (hasDot) {
          renderedDigits.push(
            <span key={`tok-${tokenIdx}-dot`} className="inline-block whitespace-pre">
              .
            </span>
          );
        }

        // Render fractional part digits keyed by decimal place from left (tenths=0, hundredths=1, etc.)
        if (fracPart) {
          for (let f = 0; f < fracPart.length; f++) {
            const char = fracPart[f];
            const digitVal = parseInt(char, 10);
            const key = `tok-${tokenIdx}-frac-${f}`;

            renderedDigits.push(
              <span
                key={key}
                className={`inline-block overflow-hidden relative h-[1.15em] w-[0.66em] align-text-bottom ${digitClassName}`}
              >
                <motion.span
                  animate={{ y: `-${digitVal * 10}%` }}
                  transition={{
                    type: 'spring',
                    stiffness: 320,
                    damping: 28,
                    mass: 0.4,
                  }}
                  className="flex flex-col absolute top-0 left-0 right-0 leading-[1.15em] text-center"
                >
                  {DIGITS.map((d) => (
                    <span key={d} className="h-[1.15em] flex items-center justify-center">
                      {d}
                    </span>
                  ))}
                </motion.span>
              </span>
            );
          }
        }

        return (
          <React.Fragment key={`num-group-${tokenIdx}`}>
            {renderedDigits}
          </React.Fragment>
        );
      })}
    </span>
  );
};
