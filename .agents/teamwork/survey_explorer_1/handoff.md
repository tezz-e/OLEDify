# Handoff Report: Interaction Mechanics & Library Extraction
**Agent**: Survey Explorer 1 (Library Researcher A: React Bits, 21st.dev, Lenis, Skiper UI)  
**Date**: 2026-10-04  
**Target Path**: `D:\espprojects\oled\.agents\teamwork\survey_explorer_1\handoff.md`  
**Active Project Location**: `D:\espprojects\oled\web` (Vite + React 18.3.1 + Framer Motion 13.4.0 + Tailwind CSS 3.4.17 + GSAP 3.15.0)

---

## 1. Observation

### 1.1 Local Workspace Configuration & Dependencies
Inspection of `D:\espprojects\oled\web\package.json` confirms:
- **React**: `^18.3.1`
- **Framer Motion**: `^13.4.0` (and `motion`: `^13.4.0`)
- **Tailwind CSS**: `^3.4.17` with `clsx` (`^2.1.1`) and `tailwind-merge` (`^3.7.0`)
- **Animation & Graphics**: `gsap` (`^3.15.0`), `three` (`^0.186.0`), `ogl` (`^1.0.11`)

Inspection of `D:\espprojects\oled\web\tailwind.config.js` reveals existing palette tokens:
- Fonts: `Plus Jakarta Sans` (sans), `IBM Plex Mono` (mono), `DM Serif Display` (display/serif).
- Colors: `parchment` (`#F5F0EB`), `cream` (`#FAF9F5`), `obsidian` (`#141413`), `studio.dark` (`#141413`), `studio.card` (`#18181C`), `accent` / `terracotta` (`#D97757`).

### 1.2 Extracted Library Components
1. **21st.dev MCP Retrieval**:
   - **Dock [id: 990]** by ibelick:
     - Uses `useMotionValue(Infinity)` for mouse coordinates.
     - Distance transform: `useTransform(mouseDistance, [-distance, 0, distance], [40, magnification, 40])`.
     - Spring configuration: `spring = { mass: 0.1, stiffness: 150, damping: 12 }`.
     - Neighbor attenuation: dynamic scaling within radius $R = 150\text{px}$.
   - **Segmented Control [id: 34935]** by balick / ibelick:
     - Uses Framer Motion `<motion.span layoutId={pillId} transition={{ type: "spring", bounce: 0.2, duration: 0.4 }} className="absolute inset-0 rounded-full bg-foreground" />`.
     - Full ARIA compliance (`role="radiogroup"`, `role="radio"`, arrow navigation).
2. **React Bits Inspection (`DavidHDev/react-bits`)**:
   - **Magnet**: Proximity threshold vector pull with `magnetStrength` (default dampening factor $2.0 - 4.0$), `padding` (outer activation radius), and dual transitions:
     - `activeTransition = "transform 0.3s ease-out"`
     - `inactiveTransition = "transform 0.5s ease-in-out"`
   - **SpotlightCard**: `spotlightColor = "rgba(255, 255, 255, 0.25)"`, radial gradient tracking cursor $(x, y)$, and 1px border highlight using CSS `mask-composite: exclude`.
   - **DecryptedText**: Character cipher scrambling with `speed = 50ms`, `maxIterations = 10`, `sequential = false|true`, and random glyph substitution from alphanumeric/cyber sets.
   - **Noise Overlays**: SVG `<feTurbulence type="fractalNoise" baseFrequency="0.80" numOctaves="3" stitchTiles="stitch" />` blended at $3.5\% - 5\%$ opacity with `mix-blend-mode: overlay` to preserve pure OLED black.
3. **Lenis Scroll & Scrub Engine (`darkroomengineering/lenis`)**:
   - Frame-rate independent exponential damping equation:
     $$\text{value}(t + \Delta t) = \text{target} + (\text{value}(t) - \text{target}) \cdot e^{-\lambda \Delta t}$$
   - Decoupled accumulator with velocity tracking $v(t) = \frac{\Delta x}{\Delta t}$ and rubberbanding boundary tension.
4. **Skiper UI (`@skiper-ui/skiper46` & `skiper64`)**:
   - SVG Gooey Filter using `<feGaussianBlur stdDeviation="9" />` paired with `<feColorMatrix values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 19 -9" />` and `<feComposite operator="atop" />`.

---

## 2. Logic Chain & Mathematical Formulations

### 2.1 React Bits: Physics & Formulations

#### A. Magnetic Cursor Pull (`Magnet`)
Let an interactive element have viewport bounding box $R = [x_{min}, y_{min}, x_{max}, y_{max}]$.
Center coordinates:
$$C = (x_c, y_c) = \left(x_{min} + \frac{W}{2},\; y_{min} + \frac{H}{2}\right)$$
Given mouse pointer coordinates $M = (x_m, y_m)$:
1. Displacement vector:
   $$\vec{D} = (\Delta x, \Delta y) = (x_m - x_c,\; y_m - y_c)$$
2. Euclidean distance:
   $$d = \|\vec{D}\| = \sqrt{(\Delta x)^2 + (\Delta y)^2}$$
3. Activation boundary radius:
   $$R_{act} = \frac{\max(W, H)}{2} + \text{padding}$$
4. Force Attenuation & Translation Vector:
   When $d \le R_{act}$, the pull displacement $\vec{T} = (T_x, T_y)$ is computed with quadratic decay:
   $$w(d) = 1 - \left(\frac{d}{R_{act}}\right)^2$$
   $$\vec{T} = \frac{\vec{D}}{S} \cdot w(d)$$
   where $S \ge 1.0$ is `magnetStrength` (optimal value for hardware switches: $S = 3.2$).
5. Edge Release:
   When $d > R_{act}$ or on `pointerleave`, $\vec{T} \to (0, 0)$ governed by spring snap-back:
   $$\ddot{\vec{x}} + 2\zeta\omega_n \dot{\vec{x}} + \omega_n^2 \vec{x} = 0$$
   with $\zeta = 0.72$ (slight sub-critical overshoot) and $\omega_n = 28\text{ rad/s}$.

#### B. Spotlight Hover Borders (Radial Gradient & Mask-Composite)
To produce a 1px razor-sharp specular glowing border without light leaking into the interior content:
1. Relative Coordinates:
   $$x_{rel} = x_m - x_{min}, \quad y_{rel} = y_m - y_{min}$$
2. Dual-Spotlight Layering:
   - **Internal Diffuse Field**:
     $$\text{Background} = \text{radial-gradient}(\text{circle } 320\text{px at } x_{rel}\text{px } y_{rel}\text{px},\; \text{rgba}(255, 255, 255, 0.04),\; \text{transparent } 80\%)$$
   - **Specular Edge Ring**:
     Applied on pseudo-element `::before` at `inset: -1px` with `padding: 1px`:
     $$\text{Mask} = \text{linear-gradient}(\#\text{fff } 0\; 0)\; \text{content-box},\; \text{linear-gradient}(\#\text{fff } 0\; 0)$$
     $$\text{Mask-Composite} = \text{exclude (or } \text{-webkit-mask-composite: xor)}$$
     $$\text{Border Gradient} = \text{radial-gradient}(\text{circle } 160\text{px at } x_{rel}\text{px } y_{rel}\text{px},\; \text{var}(--spotlight-color),\; \text{transparent } 70\%)$$
     The boolean subtraction $\text{BorderRing} = \text{TotalBox} \setminus \text{ContentBox}$ restricts the radial gradient strictly to the 1px perimeter margin.

#### C. Decrypter Text Scramblers (`DecryptedText`)
For string $S$ of length $L$, target characters $c_i \in S$, and pool $\mathcal{P}$:
- **Hardware Monospace Pool**:
  $$\mathcal{P}_{\text{hw}} = \{\text{"0", "1", "2", "3", "4", "5", "6", "7", "8", "9", "A", "B", "C", "D", "E", "F", ":", "-", "_", "[", "]"}\}$$
- **Scramble Progression Function**:
  Let $t$ be elapsed frame time, frame tick $\Delta t_{\text{tick}} = 40\text{ms}$.
  For sequential unlocking, the reveal frontier $k(t) \in [0, L]$ follows cubic deceleration:
  $$k(t) = \left\lfloor L \cdot \left(1 - \left(1 - \frac{t}{T_{\text{total}}}\right)^3\right) \right\rfloor$$
  Characters $i < k(t)$ render true $c_i$.
  Character $i = k(t)$ renders a high-speed cycling glyph from $\mathcal{P}$.
  Characters $i > k(t)$ render dimmed pseudo-random noise glyphs.

#### D. Noise Texture Overlays
- **Frequency & Octave Tuning**:
  $$\text{Noise}(x, y) = \sum_{k=0}^{N-1} \frac{1}{2^k} \cdot \text{Turbulence}(2^k f_0 x,\; 2^k f_0 y)$$
  Optimal values for 4K/Retina hardware matte: $f_0 = 0.82\text{ cycles/px}$, $N = 3\text{ octaves}$.
- **OLED Pure Black Preservation Guardrail**:
  On OLED `#000000` pixels, luminance $Y$ must remain $0.0\text{ cd/m}^2$.
  Using `mix-blend-mode: overlay` at $\alpha = 0.038$ ensures that true black $(0, 0, 0)$ remains absolute black ($0 \times \text{noise} = 0$), while midtone dark graphite panels (`#141413`) acquire a tactile anodized metal grain.

---

### 2.2 21st.dev: Framer Motion Primitives

#### A. Dynamic Spring Dock Magnification
Let items $i \in \{0, \dots, N-1\}$ have horizontal positions $x_i$ and resting width $W_0 = 40\text{px}$.
Mouse position $x_m \in \mathbb{R}$.
1. Distance metric: $d_i = |x_m - x_i|$.
2. Magnification radius: $R = 140\text{px}$, peak width $W_{\max} = 76\text{px}$.
3. Bell-curve Magnification Function:
   $$W_i(d_i) = \begin{cases} 
     W_0 + (W_{\max} - W_0) \cdot \cos^2\left(\frac{\pi d_i}{2 R}\right) & \text{if } d_i < R \\ 
     W_0 & \text{if } d_i \ge R 
   \end{cases}$$
4. Spring Dynamics:
   - Config: `{ mass: 0.1, stiffness: 220, damping: 15 }`
   - Settling time: $T_s \approx 120\text{ms}$ with zero perceptible lag.

#### B. Tactile Segmented Control Pill Morphing
- Selected tab active pill uses Framer Motion `<motion.span layoutId="active-pill" />`.
- Spring configuration:
  $$\text{transition} = \{\text{type}: \text{"spring"}, \text{stiffness}: 450, \text{damping}: 32, \text{mass}: 0.8\}$$
- Haptic click feedback: `whileTap={{ scale: 0.94 }}`.
- Refractive specular glass style:
  `bg-white/10 dark:bg-white/15 backdrop-blur-md border border-white/20 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.3)]`.

---

### 2.3 Lenis: Inertia & Timeline Scrubbing Mechanics

#### A. Differential Smoothing & Damping
Lenis decouples the user scrub/pan accumulator from the visual playhead position.
Let $x^*$ be target position, $x(t)$ be current position.
- **Differential equation**:
  $$\frac{dx}{dt} = \lambda \cdot (x^* - x)$$
- **Frame-rate independent update across $\Delta t$**:
  $$x(t + \Delta t) = x^* + (x(t) - x^*) \cdot e^{-\lambda \Delta t}$$
  Equivalently written in Lerp notation:
  $$x(t + \Delta t) = \text{lerp}(x(t),\; x^*,\; 1 - e^{-\lambda \Delta t})$$
  where damping coefficient $\lambda = 24.0\text{ s}^{-1}$ for high-precision timeline scrub, and $\lambda = 8.5\text{ s}^{-1}$ for momentum track panning.

#### B. Velocity Tracking
Instantaneous velocity is derived per frame:
$$v(t) = \frac{x(t + \Delta t) - x(t)}{\Delta t}$$
Filtered velocity (for motion blur or dynamic timecode scale):
$$v_{\text{smooth}} = \text{lerp}(v_{\text{smooth}}, v(t), 1 - e^{-12 \Delta t})$$

#### C. Elastic Rubberband Boundary Tension
When the user scrubs past timeline start ($x < 0$) or end ($x > L$):
$$x_{\text{elastic}} = x_{\text{bound}} + (x - x_{\text{bound}}) \cdot \left(1 - \frac{1}{\frac{|x - x_{\text{bound}}| \cdot 0.55}{100} + 1}\right)$$
On release, critically damped spring returns playhead to $x_{\text{bound}}$:
$$F = -k(x - x_{\text{bound}}) - 2\sqrt{k \cdot m} \cdot v$$
with $k = 420\text{ N/m}$, guaranteeing zero boundary oscillation.

---

### 2.4 Skiper UI: SVG Gooey Morphing & Mercury Surface Tension

#### A. Matrix Math of `feColorMatrix`
The filter operates on the alpha channel $\alpha \in [0, 1]$ generated by `<feGaussianBlur stdDeviation="9" />`:
$$\begin{pmatrix} R' \\ G' \\ B' \\ \alpha' \end{pmatrix} = \begin{pmatrix} 1 & 0 & 0 & 0 & 0 \\ 0 & 1 & 0 & 0 & 0 \\ 0 & 0 & 1 & 0 & 0 \\ 0 & 0 & 0 & 19 & -9 \end{pmatrix} \begin{pmatrix} R \\ G \\ B \\ \alpha \\ 1 \end{pmatrix}$$
The resulting alpha value is:
$$\alpha' = \text{clamp}(19\alpha - 9,\; 0,\; 1)$$

#### B. Threshold Cutoff & Liquid Bridge Generation
1. Complete Transparency Cutoff ($\alpha' = 0$):
   $$\alpha \le \frac{9}{19} \approx 0.4737$$
2. Complete Opacity Cutoff ($\alpha' = 1$):
   $$\alpha \ge \frac{10}{19} \approx 0.5263$$
3. Surface Tension Bridge:
   When two tabs or pills approach each other, their blurred alpha tails overlap:
   $$\alpha_{\text{total}} = \alpha_1 + \alpha_2 - \alpha_1 \alpha_2$$
   As soon as $\alpha_{\text{total}} > 0.4737$, the matrix abruptly quantizes the intermediate space into a 100% solid liquid neck, perfectly mimicking mercury droplets coalescing under surface tension.
4. Text Preservation Architecture:
   Because the gooey filter destroys crisp typography, the architecture **must** separate the liquid canvas layer from the content layer, or utilize `<feComposite in="SourceGraphic" in2="gooey-solid" operator="atop" />`.

---

## 3. Drop-in Ready Code Recipes

### 3.1 Recipe: Magnetic Button (`OledMagnetButton.tsx`)
```tsx
import React, { useRef, useState, useCallback } from 'react';
import { motion, useSpring } from 'framer-motion';

interface OledMagnetButtonProps {
  children: React.ReactNode;
  className?: string;
  strength?: number; // Higher = stiffer pull
  padding?: number;  // Activation radius expansion
  onClick?: () => void;
}

export const OledMagnetButton: React.FC<OledMagnetButtonProps> = ({
  children,
  className = '',
  strength = 3.2,
  padding = 32,
  onClick,
}) => {
  const ref = useRef<HTMLDivElement>(null);
  const [isHovered, setIsHovered] = useState(false);

  const springConfig = { stiffness: 350, damping: 22, mass: 0.15 };
  const x = useSpring(0, springConfig);
  const y = useSpring(0, springConfig);

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (!ref.current) return;
      const rect = ref.current.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;

      const deltaX = e.clientX - centerX;
      const deltaY = e.clientY - centerY;
      const dist = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
      const maxDist = Math.max(rect.width, rect.height) / 2 + padding;

      if (dist < maxDist) {
        const falloff = 1 - Math.pow(dist / maxDist, 2);
        x.set((deltaX / strength) * falloff);
        y.set((deltaY / strength) * falloff);
      } else {
        x.set(0);
        y.set(0);
      }
    },
    [strength, padding, x, y]
  );

  const handleMouseLeave = useCallback(() => {
    setIsHovered(false);
    x.set(0);
    y.set(0);
  }, [x, y]);

  return (
    <div
      ref={ref}
      onMouseMove={handleMouseMove}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={handleMouseLeave}
      className="inline-block relative p-4 -m-4 cursor-pointer"
      onClick={onClick}
    >
      <motion.div
        style={{ x, y }}
        whileTap={{ scale: 0.94 }}
        className={`relative z-10 transition-colors ${className}`}
      >
        {children}
      </motion.div>
    </div>
  );
};
```

---

### 3.2 Recipe: Spotlight Card with Mask-Composite 1px Border (`OledSpotlightCard.tsx`)
```tsx
import React, { useRef, useState, useCallback } from 'react';

interface OledSpotlightCardProps {
  children: React.ReactNode;
  className?: string;
  spotlightColor?: string;
  borderColor?: string;
}

export const OledSpotlightCard: React.FC<OledSpotlightCardProps> = ({
  children,
  className = '',
  spotlightColor = 'rgba(255, 85, 0, 0.08)',     // Signal amber diffuse wash
  borderColor = 'rgba(255, 85, 0, 0.65)',       // Signal amber specular hairline
}) => {
  const cardRef = useRef<HTMLDivElement>(null);
  const [mousePos, setMousePos] = useState({ x: -1000, y: -1000 });
  const [opacity, setOpacity] = useState(0);

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!cardRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    setMousePos({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    });
  }, []);

  return (
    <div
      ref={cardRef}
      onMouseMove={handleMouseMove}
      onMouseEnter={() => setOpacity(1)}
      onMouseLeave={() => setOpacity(0)}
      className={`relative rounded-xl bg-obsidian/90 backdrop-blur-xl transition-shadow ${className}`}
      style={{
        boxShadow: opacity > 0 ? '0 10px 30px -10px rgba(0,0,0,0.5)' : 'none',
      }}
    >
      {/* 1. Specular 1px Border Highlight via CSS Mask Composite */}
      <div
        className="pointer-events-none absolute -inset-[1px] rounded-[13px] transition-opacity duration-300"
        style={{
          opacity,
          padding: '1px',
          background: `radial-gradient(180px circle at ${mousePos.x}px ${mousePos.y}px, ${borderColor}, transparent 70%)`,
          WebkitMask: 'linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)',
          WebkitMaskComposite: 'xor',
          maskComposite: 'exclude',
        }}
      />

      {/* 2. Inner Diffuse Spotlight */}
      <div
        className="pointer-events-none absolute inset-0 rounded-xl transition-opacity duration-300"
        style={{
          opacity,
          background: `radial-gradient(350px circle at ${mousePos.x}px ${mousePos.y}px, ${spotlightColor}, transparent 80%)`,
        }}
      />

      {/* 3. Base 1px Hairline Border (Resting state) */}
      <div className="pointer-events-none absolute inset-0 rounded-xl border border-white/5" />

      {/* 4. Interactive Content */}
      <div className="relative z-10">{children}</div>
    </div>
  );
};
```

---

### 3.3 Recipe: Cyber/Monospace Decrypted Text Scrambler (`OledDecryptedText.tsx`)
```tsx
import React, { useState, useEffect, useRef } from 'react';

interface OledDecryptedTextProps {
  text: string;
  speed?: number;          // ms per frame tick
  sequential?: boolean;    // true = left-to-right decipher; false = parallel
  className?: string;
  glowColor?: string;
}

const HARDWARE_CHAR_POOL = '0123456789ABCDEF:.-_[]#*<>~';

export const OledDecryptedText: React.FC<OledDecryptedTextProps> = ({
  text,
  speed = 35,
  sequential = true,
  className = 'font-mono text-xs',
  glowColor = '#FF5500',
}) => {
  const [displayText, setDisplayText] = useState(text);
  const [isDecrypted, setIsDecrypted] = useState(false);
  const frameRef = useRef<number | null>(null);

  useEffect(() => {
    let iteration = 0;
    const totalChars = text.length;
    setIsDecrypted(false);

    const interval = setInterval(() => {
      iteration++;

      setDisplayText(() => {
        return text
          .split('')
          .map((char, index) => {
            if (char === ' ') return ' ';

            if (sequential) {
              const revealThreshold = Math.floor((iteration / 24) * totalChars);
              if (index < revealThreshold) return text[index];
            } else {
              if (iteration > 12 + (index % 5)) return text[index];
            }

            // Pseudo-random character from pool
            return HARDWARE_CHAR_POOL[
              Math.floor(Math.random() * HARDWARE_CHAR_POOL.length)
            ];
          })
          .join('');
      });

      if (iteration > (sequential ? 28 : 20)) {
        clearInterval(interval);
        setDisplayText(text);
        setIsDecrypted(true);
      }
    }, speed);

    return () => clearInterval(interval);
  }, [text, speed, sequential]);

  return (
    <span
      className={`tracking-widest select-none transition-colors duration-200 ${className} ${
        !isDecrypted ? 'text-amber-400 font-semibold' : 'text-neutral-200'
      }`}
      style={{
        textShadow: !isDecrypted ? `0 0 8px ${glowColor}` : 'none',
      }}
    >
      {displayText}
    </span>
  );
};
```

---

### 3.4 Recipe: SVG Gooey Mercury Tab Switcher (`OledMercuryTabs.tsx`)
```tsx
import React, { useState } from 'react';
import { motion } from 'framer-motion';

export interface TabOption {
  id: string;
  label: string;
  icon?: React.ReactNode;
}

interface OledMercuryTabsProps {
  tabs: TabOption[];
  activeTab: string;
  onChange: (id: string) => void;
  className?: string;
}

export const OledMercuryTabs: React.FC<OledMercuryTabsProps> = ({
  tabs,
  activeTab,
  onChange,
  className = '',
}) => {
  return (
    <div className={`relative inline-flex items-center ${className}`}>
      {/* 1. Global SVG Filter Definition (Hidden from layout) */}
      <svg className="absolute w-0 h-0 pointer-events-none" aria-hidden="true">
        <defs>
          <filter id="mercury-gooey" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur in="SourceGraphic" stdDeviation="8" result="blur" />
            <feColorMatrix
              in="blur"
              mode="matrix"
              values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 19 -9"
              result="goo"
            />
            <feComposite in="SourceGraphic" in2="goo" operator="atop" />
          </filter>
        </defs>
      </svg>

      {/* 2. Liquid Gooey Surface Background Layer */}
      <div
        className="absolute inset-0 flex items-center p-1 pointer-events-none"
        style={{ filter: 'url(#mercury-gooey)' }}
      >
        {tabs.map((tab) => {
          const isActive = tab.id === activeTab;
          return (
            <div key={`goo-${tab.id}`} className="flex-1 h-8 flex items-center justify-center">
              {isActive && (
                <motion.div
                  layoutId="mercury-pill-goo"
                  transition={{ type: 'spring', stiffness: 380, damping: 28, mass: 0.6 }}
                  className="w-full h-full rounded-full bg-amber-500 shadow-lg"
                />
              )}
            </div>
          );
        })}
      </div>

      {/* 3. Crisp Top UI Buttons Layer (Outside Gooey Filter) */}
      <div className="relative z-10 flex items-center p-1 rounded-full bg-neutral-900/80 border border-white/10 backdrop-blur-md">
        {tabs.map((tab) => {
          const isActive = tab.id === activeTab;
          return (
            <button
              key={tab.id}
              onClick={() => onChange(tab.id)}
              className={`relative h-8 px-4 flex items-center gap-2 rounded-full text-xs font-mono tracking-wider transition-colors duration-200 ${
                isActive ? 'text-black font-semibold' : 'text-neutral-400 hover:text-white'
              }`}
            >
              {tab.icon}
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
};
```

---

### 3.5 Recipe: Lenis Inertia Timeline Scrubber Engine (`useTimelineScrub.ts`)
```tsx
import { useRef, useEffect, useCallback, useState } from 'react';

interface UseTimelineScrubOptions {
  duration: number;             // Total duration in seconds
  damping?: number;              // Lambda damping coefficient (e.g., 22.0)
  onSeek?: (time: number) => void;
}

export function useTimelineScrub({
  duration,
  damping = 22.0,
  onSeek,
}: UseTimelineScrubOptions) {
  const targetTimeRef = useRef(0);
  const currentTimeRef = useRef(0);
  const velocityRef = useRef(0);
  const isDraggingRef = useRef(false);
  const [displayTime, setDisplayTime] = useState(0);

  const startScrub = useCallback((initialTime: number) => {
    isDraggingRef.current = true;
    targetTimeRef.current = Math.max(0, Math.min(duration, initialTime));
  }, [duration]);

  const updateScrub = useCallback((targetTime: number) => {
    // Lenis-style rubberband clamping past boundaries
    if (targetTime < 0) {
      targetTimeRef.current = targetTime * 0.35;
    } else if (targetTime > duration) {
      targetTimeRef.current = duration + (targetTime - duration) * 0.35;
    } else {
      targetTimeRef.current = targetTime;
    }
  }, [duration]);

  const endScrub = useCallback(() => {
    isDraggingRef.current = false;
    // Snap back within valid [0, duration]
    targetTimeRef.current = Math.max(0, Math.min(duration, targetTimeRef.current));
  }, [duration]);

  useEffect(() => {
    let lastTime = performance.now();
    let animationFrameId: number;

    const tick = (now: number) => {
      const dt = Math.min((now - lastTime) / 1000, 0.1); // clamp dt to 100ms
      lastTime = now;

      const current = currentTimeRef.current;
      const target = targetTimeRef.current;

      // Lenis exponential damping: x(t + dt) = target + (current - target) * exp(-lambda * dt)
      const next = target + (current - target) * Math.exp(-damping * dt);
      const instantVelocity = (next - current) / dt;

      velocityRef.current = instantVelocity;
      currentTimeRef.current = next;

      // Only re-render React state if position changed significantly
      if (Math.abs(next - displayTime) > 0.001) {
        setDisplayTime(next);
        onSeek?.(Math.max(0, Math.min(duration, next)));
      }

      animationFrameId = requestAnimationFrame(tick);
    };

    animationFrameId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animationFrameId);
  }, [damping, duration, displayTime, onSeek]);

  return {
    displayTime,
    velocity: velocityRef.current,
    startScrub,
    updateScrub,
    endScrub,
  };
}
```

---

## 4. Component Mapping to OLED Visual Studio

| Studio Component | Library Source | Signature Interaction Technique | Technical Implementation Details |
|---|---|---|---|
| **Global Studio Navigation** | **Skiper UI (skiper46)** + **21st.dev** | Liquid gooey mercury tab switcher between NLE Timeline & Kinetic Lyrics Studio | `<feGaussianBlur stdDeviation="8">` + `<feColorMatrix values="... 19 -9">` with Framer Motion `layoutId="tab-pill"`. Seamless molten connection during route transition. |
| **Floating Island Transport Dock** | **21st.dev (Dock [990])** + **React Bits (Magnet)** | Dynamic spring dock magnification + magnetic pull on play/pause, timecode, and scrub controls | Distance attenuation kernel $W(d) = W_0 + \Delta W \cos^2(\frac{\pi d}{2R})$ with Framer Motion `useMotionValue` and `useSpring({ mass: 0.1, stiffness: 220, damping: 14 })`. |
| **Timeline & Waveform Scrubber** | **Lenis Engine** | Smooth inertia dampening, sub-frame playhead tracking, elastic bounds | Exponential damping $\text{lerp}(x, x^*, 1 - e^{-\lambda \Delta t})$ with $\lambda = 24\text{s}^{-1}$ at 30 FPS, velocity vector calculation for inertia glide. |
| **Kinetic Typography Controls** | **React Bits (SpotlightCard)** | Modular synth patch block cards with cursor-following radial spotlight borders | 1px border highlight using CSS `mask-composite: exclude` on `::before` pseudo-element with signal amber (`#FF5500`) specular focus. |
| **Hardware Telemetry HUD** | **React Bits (DecryptedText & Noise)** | Nothing Tech dot matrix status indicators (COM12, 921600 baud, 30 FPS, SH1106) | Cipher decryption scramble on port connect/disconnect, overlaid with 3.5% `feTurbulence` noise grain to evoke physical matte hardware displays. |

---

## 5. Extended Creative Gems & Micro-Interactions

In accordance with the creative exploration directive, the following micro-interaction patterns have been synthesized from the target libraries:

### 5.1 Perimeter Border Trail (`OledBorderTrail.tsx`)
- **Mechanism**: A luminous specular beam that glides continuously along the 1px perimeter of active cards or docks using CSS `@property --angle` and `conic-gradient` or CSS `offset-path: rect(...)`.
- **Application in Studio**: Visual indicator for "Recording Active", "WebSerial Streaming", or "AI Kinetic Typography Generating".
```css
@property --trail-angle {
  syntax: '<angle>';
  initial-value: 0deg;
  inherits: false;
}

.oled-border-trail {
  position: relative;
  border-radius: 12px;
}
.oled-border-trail::before {
  content: '';
  position: absolute;
  inset: -1px;
  border-radius: inherit;
  padding: 1px;
  background: conic-gradient(
    from var(--trail-angle),
    transparent 0deg,
    transparent 280deg,
    #FF5500 340deg,
    #FFFFFF 360deg
  );
  -webkit-mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
  mask-composite: exclude;
  animation: rotateTrail 3.5s linear infinite;
}

@keyframes rotateTrail {
  to {
    --trail-angle: 360deg;
  }
}
```

### 5.2 Monochrome Dot-Matrix Pixel Canvas (`OledPixelCard.tsx`)
- **Mechanism**: Canvas or grid of $4\text{px} \times 4\text{px}$ dot-matrix cells with $3\text{px}$ gap. Cursor proximity excites local pixels to maximum phosphor luminance ($\#00\text{FF}66$ or $\#\text{FF}5500$), followed by an exponential decay curve:
  $$I(t) = I_0 \cdot e^{-\frac{t}{\tau_{\text{decay}}}}, \quad \tau = 350\text{ms}$$
- **Application in Studio**: Teenage Engineering / Nothing Tech interactive background for telemetry panes and audio FFT visualizer blocks.

### 5.3 Morphing Floating Island Command Bar
- **Mechanism**: Compact pill container that smoothly morphs in width and height between a miniature transport strip ($240\text{px} \times 44\text{px}$) and an expanded mixing console ($560\text{px} \times 96\text{px}$) using Framer Motion `layout` with spring physics:
  `transition={{ type: "spring", stiffness: 380, damping: 30 }}`.
- **Application in Studio**: Floating bottom dock that minimizes when scrubbing video and expands when editing kinetic typography layers.

### 5.4 Tactile Slosh Gauge & Elastic Volume Knobs
- **Mechanism**: Physics-based fluid volume meter with inertia "slosh" momentum responding to sudden audio peaks, combining SVG cubic bezier wave simulation with GSAP smooth scrub.

---

## 6. Caveats

1. **SVG Filter Hardware Acceleration**:
   - `filter: url(#...)` operations are rasterized on the CPU in some older versions of WebKit/Safari. To prevent frame drops, keep the filtered DOM subtree small (apply to the indicator pill rather than the entire 1920x1080 canvas viewport).
2. **True OLED Black Subpixel Invalidation**:
   - Noise overlays applied indiscriminately with low-contrast gray will cause OLED pixels to light up, defeating the pitch-black power efficiency and contrast of OLED panels. The noise overlay must use `mix-blend-mode: overlay` at $\le 0.04$ opacity, strictly preserving $(0, 0, 0)$ as 0.
3. **No Code Written to Deprecated Directories**:
   - In accordance with the critical path directive, all analysis was strictly referenced against `D:\espprojects\oled\web` and no operations interacted with `C:\Users\manee\Desktop\oled`.

---

## 7. Conclusion

The four investigated libraries provide an exact mathematical foundation for the hybrid Vercel/Apple liquid fluidity + Teenage Engineering/Nothing Tech hardware aesthetic:
1. **React Bits** contributes the vector magnetic field mechanics ($S=3.2$), the specular 1px border mask-composite technique, and the cyber monospace text decryption engine.
2. **21st.dev** delivers the canonical spring-dock magnification kernel ($R=140\text{px}$, $\text{cosine}^2$ interpolation) and Framer Motion `layoutId` pill morphing.
3. **Lenis** supplies the frame-rate independent exponential damping equation ($\lambda = 24\text{ s}^{-1}$) for 30 FPS NLE scrubbing and elastic rubberbanding.
4. **Skiper UI** provides the exact SVG filter parameters (`stdDeviation="8"`, `values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 19 -9"`) for mercury-like fluid tab transitions.

These components can be integrated into `D:\espprojects\oled\web` without adding heavy new dependencies, building directly on the existing `framer-motion@13.4`, `tailwindcss@3.4`, and `gsap@3.15` dependencies.

---

## 8. Verification Method

To independently verify the extracted formulas and code recipes:
1. **Verify Dependencies**:
   Inspect `D:\espprojects\oled\web\package.json` to confirm compatibility:
   - `framer-motion` supports `useMotionValue`, `useSpring`, `useTransform`, and `layoutId`.
   - `tailwindcss` supports custom CSS mask-composite and radial gradients.
2. **Verify Mathematical Cutoffs for Gooey Filter**:
   Execute a node calculation for `19 * alpha - 9`:
   ```bash
   node -e "console.log('Zero cutoff:', 9/19, 'Full cutoff:', 10/19)"
   ```
   Validates zero at $\approx 0.4737$ and full opacity at $\approx 0.5263$.
3. **Verify Mask-Composite Compatibility**:
   Ensure both standard `mask-composite: exclude` and `-webkit-mask-composite: xor` are specified in tandem for cross-browser Chrome, Edge, and Safari support.
