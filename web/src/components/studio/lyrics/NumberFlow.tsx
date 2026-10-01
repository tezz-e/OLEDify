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

  return (
    <span className={`inline-flex items-baseline font-mono tabular-nums leading-none select-none ${className}`}>
      {str.split('').map((char, idx) => {
        const isDigit = char >= '0' && char <= '9';
        if (!isDigit) {
          return (
            <span key={`static-${idx}-${char}`} className="inline-block whitespace-pre">
              {char}
            </span>
          );
        }

        const digitVal = parseInt(char, 10);

        return (
          <span
            key={`digit-slot-${idx}`}
            className={`inline-block overflow-hidden relative h-[1.15em] w-[0.62em] align-text-bottom ${digitClassName}`}
          >
            <motion.span
              animate={{ y: `-${digitVal * 10}%` }}
              transition={{
                type: 'spring',
                stiffness: 300,
                damping: 26,
                mass: 0.5,
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
      })}
    </span>
  );
};
