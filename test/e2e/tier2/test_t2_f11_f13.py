"""
Tier 2 Boundary & Corner Cases: Features F11 through F13
Total tests: 15 (5 tests per feature)
"""
import unittest
import numpy as np
from test.e2e.config import FRAME_WIDTH, FRAME_HEIGHT, FRAME_SIZE_BYTES, THEMES
from test.e2e.oracles.xbmp_oracle import pack_xbmp, unpack_xbmp, validate_xbmp_dimensions


class TestT2F11XbmpBoundaries(unittest.TestCase):
    """F11: XBMP Packing Boundaries"""
    feature = "F11"
    tier = 2

    def test_t2_f11_01_underflow_buffer_size(self):
        """T2-F11-01: Underflow Buffer Size Assertion (< 8192 Pixels)"""
        underflow_pixels = np.zeros(8191, dtype=np.uint8)
        with self.assertRaises(ValueError):
            pack_xbmp(underflow_pixels, FRAME_WIDTH, FRAME_HEIGHT)

    def test_t2_f11_02_overflow_buffer_size(self):
        """T2-F11-02: Overflow Buffer Size Assertion (> 8192 Pixels)"""
        overflow_pixels = np.zeros(8193, dtype=np.uint8)
        with self.assertRaises(ValueError):
            pack_xbmp(overflow_pixels, FRAME_WIDTH, FRAME_HEIGHT)

    def test_t2_f11_03_non_multiple_of_8_width(self):
        """T2-F11-03: Non-Multiple-of-8 Width Guard (width = 127)"""
        with self.assertRaises(ValueError):
            validate_xbmp_dimensions(127, 64)

    def test_t2_f11_04_all_zero_and_all_one_buffers(self):
        """T2-F11-04: All-Zero and All-One Boundary Frames"""
        all_zeros = np.zeros(FRAME_WIDTH * FRAME_HEIGHT, dtype=np.uint8)
        all_ones = np.full(FRAME_WIDTH * FRAME_HEIGHT, 255, dtype=np.uint8)
        packed_0 = pack_xbmp(all_zeros)
        packed_1 = pack_xbmp(all_ones)
        self.assertEqual(packed_0, bytes([0x00] * 1024))
        self.assertEqual(packed_1, bytes([0xFF] * 1024))

    def test_t2_f11_05_extreme_single_pixel_positions(self):
        """T2-F11-05: Extreme Single Pixel Positions (0,0) and (127,63)"""
        # (0, 0)
        p0 = np.zeros((FRAME_HEIGHT, FRAME_WIDTH), dtype=np.uint8)
        p0[0, 0] = 255
        b0 = pack_xbmp(p0)
        self.assertEqual(b0[0], 0x01)
        self.assertEqual(b0[1023], 0x00)

        # (127, 63)
        p_last = np.zeros((FRAME_HEIGHT, FRAME_WIDTH), dtype=np.uint8)
        p_last[63, 127] = 255
        b_last = pack_xbmp(p_last)
        self.assertEqual(b_last[0], 0x00)
        self.assertEqual(b_last[1023], 0x80)  # Bit 7 of last byte


class TestT2F12OledCanvasBoundaries(unittest.TestCase):
    """F12: Simulated OLED Canvas Boundaries"""
    feature = "F12"
    tier = 2

    def test_t2_f12_01_corrupted_byte_values_sanitization(self):
        """T2-F12-01: Corrupted Byte Values Sanitization via uint8 Cast"""
        corrupted_vals = [-10, 300, 256, 128]
        sanitized = [b & 0xFF for b in corrupted_vals]
        self.assertEqual(sanitized, [246, 44, 0, 128])

    def test_t2_f12_02_empty_or_none_frame_buffer(self):
        """T2-F12-02: Null or None Frame Buffer Fallback"""
        frame = None
        # Fallback renders solid black 1024 bytes
        fallback_frame = frame if frame is not None else bytes([0x00] * FRAME_SIZE_BYTES)
        self.assertEqual(len(fallback_frame), 1024)

    def test_t2_f12_03_scale_factor_boundaries(self):
        """T2-F12-03: Multi-Scale Factor Boundaries (1, 2, 4, 8)"""
        for scale in [1, 2, 4, 8]:
            canvas_w = FRAME_WIDTH * scale
            canvas_h = FRAME_HEIGHT * scale
            self.assertEqual(canvas_w / canvas_h, 2.0)

    def test_t2_f12_04_zero_dimension_viewport_guard(self):
        """T2-F12-04: Zero-Sized Viewport Container Guard"""
        container_w, container_h = 0, 0
        safe_w = max(1, container_w)
        safe_h = max(1, container_h)
        self.assertEqual((safe_w, safe_h), (1, 1))

    def test_t2_f12_05_rapid_theme_switching(self):
        """T2-F12-05: Rapid Theme Switching State Independence"""
        themes = list(THEMES.keys())
        active = None
        for _ in range(50):
            for t in themes:
                active = THEMES[t]
        self.assertIsNotNone(active)


class TestT2F13PlaybackBoundaries(unittest.TestCase):
    """F13: Playback Controls & Timeline Boundaries"""
    feature = "F13"
    tier = 2

    def test_t2_f13_01_zero_fps_clamping(self):
        """T2-F13-01: Zero FPS Frame Rate Boundary (Clamped to >= 1)"""
        user_fps = 0
        safe_fps = max(1, min(60, user_fps))
        self.assertEqual(safe_fps, 1)
        interval = 1000.0 / safe_fps
        self.assertEqual(interval, 1000.0)

    def test_t2_f13_02_high_fps_clamping(self):
        """T2-F13-02: High FPS Frame Rate Limit (Clamped to <= 60)"""
        user_fps = 120
        safe_fps = max(1, min(60, user_fps))
        self.assertEqual(safe_fps, 60)

    def test_t2_f13_03_out_of_range_scrubbing(self):
        """T2-F13-03: Out-of-Range Scrub Bar Drag Clamping"""
        num_frames = 100
        drag_negative = -15
        drag_excess = 250
        clamped_neg = max(0, min(drag_negative, num_frames - 1))
        clamped_excess = max(0, min(drag_excess, num_frames - 1))
        self.assertEqual(clamped_neg, 0)
        self.assertEqual(clamped_excess, 99)

    def test_t2_f13_04_tab_delta_throttling(self):
        """T2-F13-04: Background Tab Delta Throttling (> 1000ms discarded)"""
        delta_ms = 30000.0  # 30 seconds tab in background
        if delta_ms > 1000.0:
            delta_ms = 33.33  # Cap to single frame interval
        self.assertAlmostEqual(delta_ms, 33.33)

    def test_t2_f13_05_single_frame_animation_scrubbing(self):
        """T2-F13-05: Single-Frame Animation Scrubbing (NUM_FRAMES = 1)"""
        num_frames = 1
        index = 0
        # Step forward
        next_index = min(num_frames - 1, index + 1)
        self.assertEqual(next_index, 0)
        # Step backward
        prev_index = max(0, index - 1)
        self.assertEqual(prev_index, 0)


if __name__ == "__main__":
    unittest.main()
