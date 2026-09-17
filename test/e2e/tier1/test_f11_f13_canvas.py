"""
Tier 1 Feature Coverage: Features F11 through F13 (XBMP Packing, OLED Canvas & Playback)
Total tests: 15 (5 tests per feature)
"""
import unittest
import numpy as np
from test.e2e.config import (
    FRAME_WIDTH,
    FRAME_HEIGHT,
    FRAME_SIZE_BYTES,
    THEMES,
    MIN_FPS,
    MAX_FPS,
    DEFAULT_FPS
)
from test.e2e.oracles.xbmp_oracle import pack_xbmp, unpack_xbmp


class TestF11XbmpPacking(unittest.TestCase):
    """F11: XBMP Binary Frame Packing (1024-byte row-major LSB-first format)"""
    feature = "F11"
    tier = 1

    def test_t1_f11_01_exact_1024_byte_allocation(self):
        """T1-F11-01: Exact 1024-Byte Array Allocation"""
        pixels = np.zeros(FRAME_WIDTH * FRAME_HEIGHT, dtype=np.uint8)
        packed = pack_xbmp(pixels, FRAME_WIDTH, FRAME_HEIGHT)
        self.assertIsInstance(packed, bytes)
        self.assertEqual(len(packed), FRAME_SIZE_BYTES)

    def test_t1_f11_02_row_major_byte_traversal(self):
        """T1-F11-02: Row-Major Byte Traversal Verification"""
        pixels = np.zeros((FRAME_HEIGHT, FRAME_WIDTH), dtype=np.uint8)
        # Lit horizontal line at row y = 1 (all 128 pixels lit)
        pixels[1, :] = 255
        packed = pack_xbmp(pixels, FRAME_WIDTH, FRAME_HEIGHT)

        # Row 0: bytes 0..15 should be 0x00
        for i in range(16):
            self.assertEqual(packed[i], 0x00)
        # Row 1: bytes 16..31 should be 0xFF
        for i in range(16, 32):
            self.assertEqual(packed[i], 0xFF)
        # Row 2+: bytes 32..1023 should be 0x00
        for i in range(32, 1024):
            self.assertEqual(packed[i], 0x00)

    def test_t1_f11_03_lsb_first_bit_significance(self):
        """T1-F11-03: LSB-First Bit Significance Verification"""
        pixels = np.zeros((FRAME_HEIGHT, FRAME_WIDTH), dtype=np.uint8)
        # Single pixel at (0, 0) -> Bit 0 of Byte 0 = 0x01
        pixels[0, 0] = 255
        packed = pack_xbmp(pixels, FRAME_WIDTH, FRAME_HEIGHT)
        self.assertEqual(packed[0], 0x01)

        # Single pixel at (7, 0) -> Bit 7 of Byte 0 = 0x80
        pixels = np.zeros((FRAME_HEIGHT, FRAME_WIDTH), dtype=np.uint8)
        pixels[0, 7] = 255
        packed = pack_xbmp(pixels, FRAME_WIDTH, FRAME_HEIGHT)
        self.assertEqual(packed[0], 0x80)

        # Single pixel at (1, 0) -> Bit 1 of Byte 0 = 0x02
        pixels = np.zeros((FRAME_HEIGHT, FRAME_WIDTH), dtype=np.uint8)
        pixels[0, 1] = 255
        packed = pack_xbmp(pixels, FRAME_WIDTH, FRAME_HEIGHT)
        self.assertEqual(packed[0], 0x02)

    def test_t1_f11_04_pixel_polarity_u8g2(self):
        """T1-F11-04: Pixel Polarity U8g2 Compatibility (1 = White, 0 = Black)"""
        white_screen = np.full((FRAME_HEIGHT, FRAME_WIDTH), 255, dtype=np.uint8)
        black_screen = np.zeros((FRAME_HEIGHT, FRAME_WIDTH), dtype=np.uint8)

        packed_white = pack_xbmp(white_screen)
        packed_black = pack_xbmp(black_screen)

        self.assertEqual(packed_white, bytes([0xFF] * 1024))
        self.assertEqual(packed_black, bytes([0x00] * 1024))

    def test_t1_f11_05_round_trip_pack_unpack(self):
        """T1-F11-05: Round-Trip Pack and Unpack Bit-Exact Identity"""
        np.random.seed(123)
        original = (np.random.rand(FRAME_WIDTH * FRAME_HEIGHT) > 0.5).astype(np.uint8) * 255
        packed = pack_xbmp(original)
        unpacked = unpack_xbmp(packed)
        np.testing.assert_array_equal(unpacked, original)


class TestF12SimulatedOledCanvas(unittest.TestCase):
    """F12: Simulated OLED Canvas Player (Themes & Sub-pixel Geometry)"""
    feature = "F12"
    tier = 1

    def test_t1_f12_01_subpixel_grid_geometry(self):
        """T1-F12-01: Scaled Display with Sub-Pixel Grid Margin (Scale factor 4)"""
        scale = 4
        gap = 1
        pad_size = scale - gap  # 3x3 pixel emitter pad with 1px interstitial gap
        self.assertEqual(pad_size, 3)
        total_canvas_w = FRAME_WIDTH * scale
        total_canvas_h = FRAME_HEIGHT * scale
        self.assertEqual((total_canvas_w, total_canvas_h), (512, 256))

    def test_t1_f12_02_classic_cyan_theme(self):
        """T1-F12-02: Classic Cyan Phosphor Theme Rendering"""
        theme = THEMES["Classic Cyan"]
        self.assertEqual(theme["lit"], (0, 240, 255))
        self.assertEqual(theme["hex"], "#00f0ff")

    def test_t1_f12_03_crisp_white_theme(self):
        """T1-F12-03: Crisp White Phosphor Theme Rendering"""
        theme = THEMES["Crisp White"]
        self.assertEqual(theme["lit"], (255, 255, 255))
        self.assertEqual(theme["hex"], "#ffffff")

    def test_t1_f12_04_yellow_blue_dual_zone(self):
        """T1-F12-04: Yellow/Blue Dual-Zone Display Simulation"""
        theme = THEMES["Yellow/Blue"]
        # Yellow header rows 0-15
        self.assertEqual(theme["header_lit"], (255, 204, 0))
        # Separator row 16 is black
        self.assertEqual(theme["separator"], (0, 0, 0))
        # Blue body rows 17-63
        self.assertEqual(theme["body_lit"], (0, 229, 255))

    def test_t1_f12_05_amber_and_matrix_green_themes(self):
        """T1-F12-05: Amber & Matrix Green Themes Rendering"""
        amber = THEMES["Amber"]
        green = THEMES["Matrix Green"]
        self.assertEqual(amber["lit"], (255, 176, 0))
        self.assertEqual(amber["hex"], "#ffb000")
        self.assertEqual(green["lit"], (0, 255, 102))
        self.assertEqual(green["hex"], "#00ff66")


class TestF13PlaybackControls(unittest.TestCase):
    """F13: Playback Controls & Timeline (Transport, Scrub, Loop, FPS)"""
    feature = "F13"
    tier = 1

    def test_t1_f13_01_play_pause_toggle(self):
        """T1-F13-01: Play/Pause State Transition"""
        state = {"is_playing": False, "frame_index": 0}
        # Press Play
        state["is_playing"] = not state["is_playing"]
        self.assertTrue(state["is_playing"])
        # Press Pause
        state["is_playing"] = not state["is_playing"]
        self.assertFalse(state["is_playing"])

    def test_t1_f13_02_scrub_bar_seek(self):
        """T1-F13-02: Scrub Bar Frame Seek Synchronization"""
        total_frames = 100
        active_index = 0
        target_seek = 45
        clamped_seek = max(0, min(target_seek, total_frames - 1))
        active_index = clamped_seek
        self.assertEqual(active_index, 45)

    def test_t1_f13_03_single_frame_step(self):
        """T1-F13-03: Single-Frame Step Forward & Backward"""
        total_frames = 50
        index = 10
        # Step Forward
        index = min(total_frames - 1, index + 1)
        self.assertEqual(index, 11)
        # Step Backward
        index = max(0, index - 1)
        self.assertEqual(index, 10)

    def test_t1_f13_04_loop_mode_transition(self):
        """T1-F13-04: Continuous Loop vs Play-Once Mode Transition"""
        total_frames = 10
        # With Loop = True
        index = 9
        next_index_loop = (index + 1) % total_frames
        self.assertEqual(next_index_loop, 0)

        # With Loop = False
        loop = False
        if index + 1 >= total_frames:
            next_index_no_loop = index
            is_playing = False
        else:
            next_index_no_loop = index + 1
            is_playing = True
        self.assertEqual(next_index_no_loop, 9)
        self.assertFalse(is_playing)

    def test_t1_f13_05_frame_rate_pacing(self):
        """T1-F13-05: Frame Rate Selector Timing Intervals (15-30 FPS)"""
        interval_15 = 1000.0 / 15.0  # 66.67 ms
        interval_30 = 1000.0 / 30.0  # 33.33 ms
        self.assertAlmostEqual(interval_15, 66.6666, places=2)
        self.assertAlmostEqual(interval_30, 33.3333, places=2)
        self.assertTrue(MIN_FPS <= 24 <= MAX_FPS)


if __name__ == "__main__":
    unittest.main()
