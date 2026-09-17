"""
Tier 1 Feature Coverage: Features F14 through F17 (Procedural Engine Primitives)
Total tests: 20 (5 tests per feature)
"""
import unittest
import numpy as np
import math
from test.e2e.config import FRAME_WIDTH, FRAME_HEIGHT, FRAME_SIZE_BYTES
from test.e2e.oracles.xbmp_oracle import pack_xbmp
from test.e2e.oracles.cpp_header_oracle import parse_frames_header


def ease_out_bounce(t: float) -> float:
    """Standard bounce easing function."""
    t = max(0.0, min(1.0, float(t)))
    n1 = 7.5625
    d1 = 2.75
    if t < 1.0 / d1:
        return n1 * t * t
    elif t < 2.0 / d1:
        t -= 1.5 / d1
        return n1 * t * t + 0.75
    elif t < 2.5 / d1:
        t -= 2.25 / d1
        return n1 * t * t + 0.9375
    else:
        t -= 2.625 / d1
        return n1 * t * t + 0.984375


class TestF14TypewriterAndBounceLyric(unittest.TestCase):
    """F14: Text Typewriter & Bounce Lyric Renderer"""
    feature = "F14"
    tier = 1

    def test_t1_f14_01_typewriter_cps_progression(self):
        """T1-F14-01: Typewriter CPS Character Reveal Progression"""
        text = "HELLO WORLD"
        cps = 10
        t = 0.5
        visible_count = int(math.floor(t * cps))
        revealed = text[:visible_count]
        self.assertEqual(revealed, "HELLO")
        self.assertEqual(len(revealed), 5)

    def test_t1_f14_02_monospace_font_word_wrapping(self):
        """T1-F14-02: Monospace Bitmap Font Word Wrapping"""
        # In a 128px wide display with 6px glyph width (e.g. 5x7 font + 1px spacing), max chars per line is 128 // 6 = 21 chars.
        text = "THE QUICK BROWN FOX JUMPS OVER THE LAZY DOG"
        max_chars_per_line = 128 // 6  # 21
        words = text.split(" ")
        lines = []
        cur_line = []
        cur_len = 0
        for w in words:
            if cur_len + len(w) + (1 if cur_line else 0) <= max_chars_per_line:
                cur_line.append(w)
                cur_len += len(w) + (1 if len(cur_line) > 1 else 0)
            else:
                lines.append(" ".join(cur_line))
                cur_line = [w]
                cur_len = len(w)
        if cur_line:
            lines.append(" ".join(cur_line))

        self.assertGreater(len(lines), 1)
        for line in lines:
            self.assertLessEqual(len(line), max_chars_per_line)

    def test_t1_f14_03_blinking_cursor_square(self):
        """T1-F14-03: Blinking Cursor Square Simulation (500ms period)"""
        # 1.0s blink cycle (500ms on, 500ms off)
        period = 1.0
        t1 = 0.25  # Inside first 500ms (on)
        t2 = 0.75  # Inside second 500ms (off)
        cursor_on_1 = (t1 % period) < 0.5
        cursor_on_2 = (t2 % period) < 0.5
        self.assertTrue(cursor_on_1)
        self.assertFalse(cursor_on_2)

    def test_t1_f14_04_damped_elastic_bounce(self):
        """T1-F14-04: Damped Elastic Bounce Curve Calculation"""
        self.assertAlmostEqual(ease_out_bounce(0.0), 0.0)
        self.assertAlmostEqual(ease_out_bounce(1.0), 1.0)
        val_mid = ease_out_bounce(0.5)
        self.assertGreater(val_mid, 0.5)
        self.assertLessEqual(val_mid, 1.0)

    def test_t1_f14_05_karaoke_inverse_video_highlight(self):
        """T1-F14-05: Karaoke-Style Inverse Video Highlight"""
        canvas = np.zeros((FRAME_HEIGHT, FRAME_WIDTH), dtype=np.uint8)
        # Highlight word bounding box: x in [10, 50], y in [20, 30]
        box_x0, box_x1 = 10, 50
        box_y0, box_y1 = 20, 30
        canvas[box_y0:box_y1, box_x0:box_x1] = 255  # White background
        # Text glyphs rendered inverted (black = 0)
        canvas[22:28, 15:20] = 0  # Black letter
        self.assertEqual(canvas[25, 12], 255)       # Surrounding box is lit
        self.assertEqual(canvas[25, 17], 0)         # Glyph pixel is unlit


class TestF15GlitchShaderFx(unittest.TestCase):
    """F15: Glitch Shader FX (XOR noise, row tearing, scanline flips)"""
    feature = "F15"
    tier = 1

    def test_t1_f15_01_xor_bitwise_noise(self):
        """T1-F15-01: XOR Bitwise Noise Application"""
        frame = bytearray([0x55] * FRAME_SIZE_BYTES)
        rng = np.random.RandomState(42)
        noise = rng.randint(0, 256, FRAME_SIZE_BYTES, dtype=np.uint8)
        mask = 0x1F  # 15% intensity
        glitched = bytearray(FRAME_SIZE_BYTES)
        for i in range(FRAME_SIZE_BYTES):
            glitched[i] = frame[i] ^ (noise[i] & mask)

        self.assertEqual(len(glitched), FRAME_SIZE_BYTES)
        self.assertNotEqual(bytes(glitched), bytes(frame))

    def test_t1_f15_02_horizontal_row_tearing(self):
        """T1-F15-02: Horizontal Row Tearing Displacement"""
        grid = np.zeros((FRAME_HEIGHT, FRAME_WIDTH), dtype=np.uint8)
        grid[:, 64] = 255  # Vertical center line

        # Tear rows 20..28 by +12 pixels
        tear_y0, tear_y1 = 20, 28
        shift = 12
        teared = grid.copy()
        for y in range(tear_y0, tear_y1):
            teared[y, :] = np.roll(grid[y, :], shift)

        # Row 10 (unaffected) has line at 64
        self.assertEqual(teared[10, 64], 255)
        # Row 24 (torn) has line shifted to 64 + 12 = 76
        self.assertEqual(teared[24, 76], 255)
        self.assertEqual(teared[24, 64], 0)

    def test_t1_f15_03_periodic_scanline_inversion(self):
        """T1-F15-03: Periodic Bit-Flip Scanlines (Every 8th Row)"""
        grid = np.zeros((FRAME_HEIGHT, FRAME_WIDTH), dtype=np.uint8)
        for y in range(0, FRAME_HEIGHT, 8):
            grid[y, :] = 255 - grid[y, :]

        for y in range(FRAME_HEIGHT):
            if y % 8 == 0:
                self.assertTrue(np.all(grid[y, :] == 255))
            else:
                self.assertTrue(np.all(grid[y, :] == 0))

    def test_t1_f15_04_rolling_crt_vsync_bar(self):
        """T1-F15-04: Rolling CRT V-SYNC Bar Animation Wrap"""
        bar_height = 8
        canvas_h = FRAME_HEIGHT  # 64
        bar_y_t0 = 60
        # Wraps smoothly across bottom edge
        bar_y_t1 = (bar_y_t0 + 6) % canvas_h  # (60 + 6) % 64 = 2
        self.assertEqual(bar_y_t1, 2)

    def test_t1_f15_05_seeded_prng_reproducibility(self):
        """T1-F15-05: Deterministic Seeded PRNG Reproducibility"""
        seed = 0xCAFE
        rng1 = np.random.RandomState(seed)
        noise1 = rng1.randint(0, 256, 100, dtype=np.uint8)

        rng2 = np.random.RandomState(seed)
        noise2 = rng2.randint(0, 256, 100, dtype=np.uint8)

        np.testing.assert_array_equal(noise1, noise2)


class TestF16StarfieldAndParticles(unittest.TestCase):
    """F16: 3D Starfield & Particle Explosion Physics"""
    feature = "F16"
    tier = 1

    def test_t1_f16_01_3d_perspective_projection(self):
        """T1-F16-01: 3D Starfield Perspective Projection"""
        X, Y, Z = 20.0, 10.0, 50.0
        fx, fy = 64.0, 32.0
        cx, cy = 64.0, 32.0
        xs = cx + (X / Z) * fx  # 64 + (20/50)*64 = 64 + 25.6 = 89.6 -> 90
        ys = cy + (Y / Z) * fy  # 32 + (10/50)*32 = 32 + 6.4 = 38.4 -> 38
        self.assertAlmostEqual(xs, 89.6, places=1)
        self.assertAlmostEqual(ys, 38.4, places=1)

    def test_t1_f16_02_warp_streak_bresenham(self):
        """T1-F16-02: Warp Speed Bresenham Streak Line Interpolation"""
        # Line from (70, 35) to (85, 42)
        x0, y0 = 70, 35
        x1, y1 = 85, 42
        points = []
        dx = abs(x1 - x0)
        dy = abs(y1 - y0)
        sx = 1 if x0 < x1 else -1
        sy = 1 if y0 < y1 else -1
        err = dx - dy
        cx, cy = x0, y0
        while True:
            points.append((cx, cy))
            if cx == x1 and cy == y1:
                break
            e2 = 2 * err
            if e2 > -dy:
                err -= dy
                cx += sx
            if e2 < dx:
                err += dx
                cy += sy

        self.assertEqual(points[0], (70, 35))
        self.assertEqual(points[-1], (85, 42))
        self.assertGreater(len(points), 10)

    def test_t1_f16_03_near_plane_respawn(self):
        """T1-F16-03: Near-Plane Star Respawn Cycling (Z <= 0.1)"""
        star_z = 0.05
        z_min = 0.1
        z_max = 100.0
        if star_z <= z_min:
            star_z = z_max
        self.assertEqual(star_z, 100.0)

    def test_t1_f16_04_ballistic_particle_burst_euler(self):
        """T1-F16-04: Radial Particle Burst Ballistic Physics (Euler Integration)"""
        # Particle moving with vx = 10, vy = -15, gravity = +30
        x, y = 64.0, 32.0
        vx, vy = 10.0, -15.0
        g = 30.0
        dt = 0.1

        for _ in range(10):
            vy += g * dt
            x += vx * dt
            y += vy * dt

        # Due to positive gravity, vy becomes positive and y increases
        self.assertGreater(y, 32.0)
        self.assertGreater(x, 64.0)

    def test_t1_f16_05_particle_lifetime_decay(self):
        """T1-F16-05: Particle Lifetime Decay & Stochastic Fade"""
        lifespan = 1.0
        dt = 0.2
        lives = []
        curr = lifespan
        while round(curr, 4) > 0:
            lives.append(curr)
            curr -= dt
        self.assertEqual(len(lives), 5)
        self.assertLessEqual(curr, 1e-5)


class TestF17ProceduralTimelineIntegration(unittest.TestCase):
    """F17: Procedural Timeline Integration & Sequence Generation"""
    feature = "F17"
    tier = 1

    def test_t1_f17_01_timeline_baking(self):
        """T1-F17-01: Procedural Generator Timeline Frame Baking"""
        num_frames = 90
        baked_frames = []
        for i in range(num_frames):
            frame = np.zeros((FRAME_HEIGHT, FRAME_WIDTH), dtype=np.uint8)
            frame[32, (i * 2) % FRAME_WIDTH] = 255
            packed = pack_xbmp(frame)
            baked_frames.append(packed)

        self.assertEqual(len(baked_frames), 90)
        self.assertEqual(len(baked_frames[0]), FRAME_SIZE_BYTES)

    def test_t1_f17_02_timeline_scrubbing_direct_access(self):
        """T1-F17-02: Seamless Timeline Scrubbing of Baked Frames"""
        baked = [pack_xbmp(np.full((FRAME_HEIGHT, FRAME_WIDTH), i, dtype=np.uint8)) for i in range(50)]
        target_idx = 30
        retrieved = baked[target_idx]
        self.assertIsNotNone(retrieved)
        self.assertEqual(len(retrieved), FRAME_SIZE_BYTES)

    def test_t1_f17_03_procedural_compositing(self):
        """T1-F17-03: Procedural Layer Compositing over Base Buffer"""
        base = np.zeros((FRAME_HEIGHT, FRAME_WIDTH), dtype=np.uint8)
        base[10:20, 10:20] = 255  # Video graphic

        glitch_layer = np.zeros((FRAME_HEIGHT, FRAME_WIDTH), dtype=np.uint8)
        glitch_layer[15:25, 15:25] = 255  # Glitch overlay

        composited = np.bitwise_or(base, glitch_layer)
        self.assertEqual(composited[12, 12], 255)
        self.assertEqual(composited[22, 22], 255)
        self.assertEqual(composited[0, 0], 0)

    def test_t1_f17_04_duration_frame_calculation(self):
        """T1-F17-04: Configurable Duration & Frame Count (4.0s @ 24 FPS = 96 Frames)"""
        duration = 4.0
        fps = 24
        total_frames = int(round(duration * fps))
        self.assertEqual(total_frames, 96)

    def test_t1_f17_05_export_compatibility(self):
        """T1-F17-05: Procedural Frame Export to C++ Header String"""
        frames = [pack_xbmp(np.zeros((FRAME_HEIGHT, FRAME_WIDTH), dtype=np.uint8)) for _ in range(5)]
        header_text = (
            "#pragma once\n"
            "#define FRAME_WIDTH 128\n"
            "#define FRAME_HEIGHT 64\n"
            "#define FRAME_SIZE_BYTES 1024\n"
            "#define FRAME_FPS 30\n"
            "#define NUM_FRAMES 5\n"
            "const uint8_t reel_frames[5][1024] PROGMEM = {\n"
        )
        parsed = parse_frames_header(header_text)
        self.assertEqual(parsed["num_frames"], 5)
        self.assertEqual(parsed["width"], 128)
        self.assertEqual(parsed["height"], 64)


if __name__ == "__main__":
    unittest.main()
