import React from 'react';
import { motion } from 'framer-motion';
import { HW_SPRINGS } from '../../theme/springPresets';

interface SlidingNumberProps {
  value: number;
  className?: string;
  padDigits?: number;
}

const DIGITS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];

function SingleDigitColumn({ digit }: { digit: number }) {
  return (
    <span className="relative inline-block h-[1em] w-[1ch] overflow-hidden align-baseline tabular-nums leading-none select-none">
      <motion.span
        initial={false}
        animate={{ y: `-${digit * 10}%` }}
        transition={HW_SPRINGS.snappy}
        className="absolute top-0 left-0 flex flex-col items-center justify-start"
        style={{ height: '1000%' }}
      >
        {DIGITS.map((n) => (
          <span key={n} className="flex h-[1em] w-[1ch] items-center justify-center leading-none">
            {n}
          </span>
        ))}
      </motion.span>
    </span>
  );
}

/**
 * Mechanical Rolling Odometer / Sliding Number (Motion-Primitives / Bencho inspired)
 * Seamlessly rolls digits with hardware-grade spring damping.
 */
export const SlidingNumber: React.FC<SlidingNumberProps> = ({
  value,
  className = '',
  padDigits = 0,
}) => {
  const isNegative = value < 0;
  const absInt = Math.abs(Math.round(value));
  let str = absInt.toString();
  if (padDigits > 0 && str.length < padDigits) {
    str = str.padStart(padDigits, '0');
  }

  return (
    <span className={`inline-flex items-center font-mono tabular-nums leading-none ${className}`}>
      {isNegative && <span>-</span>}
      {str.split('').map((char, idx) => {
        const num = parseInt(char, 10);
        if (isNaN(num)) {
          return <span key={idx}>{char}</span>;
        }
        return <SingleDigitColumn key={idx} digit={num} />;
      })}
    </span>
  );
};
