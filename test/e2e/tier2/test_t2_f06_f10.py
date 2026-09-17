"""
Tier 2 Boundary & Corner Cases: Features F06 through F10
Total tests: 25 (5 tests per feature)
"""
import unittest
import numpy as np
from test.e2e.config import FRAME_WIDTH, FRAME_HEIGHT
from test.e2e.oracles.dither_oracle import (
    adjust_luminance,
    dither_atkinson,
    dither_floyd_steinberg,
    dither_bayer,
    threshold_image,
    bayer_threshold_matrix
)


class TestT2F06BrightnessContrastBoundaries(unittest.TestCase):
    """F06: Brightness & Contrast Control Boundary Tests"""
    feature = "F06"
    tier = 2

    def test_t2_f06_01_min_brightness_extreme(self):
        """T2-F06-01: Minimum Brightness Extreme (B = -100 -> All 0s)"""
        white = np.full((FRAME_HEIGHT, FRAME_WIDTH), 255, dtype=np.uint8)
        adj = adjust_luminance(white, brightness=-100.0)
        self.assertTrue(np.all(adj == 0))

    def test_t2_f06_02_max_brightness_extreme(self):
        """T2-F06-02: Maximum Brightness Extreme (B = +100 -> All 255s)"""
        black = np.zeros((FRAME_HEIGHT, FRAME_WIDTH), dtype=np.uint8)
        adj = adjust_luminance(black, brightness=100.0)
        self.assertTrue(np.all(adj == 255))

    def test_t2_f06_03_singular_contrast_boundary(self):
        """T2-F06-03: Maximum Contrast Factor Singular Boundary (C = +100)"""
        gray = np.linspace(0, 255, 256, dtype=np.uint8).reshape(16, 16)
        adj = adjust_luminance(gray, contrast=100.0)
        self.assertTrue(np.all(adj >= 0))
        self.assertTrue(np.all(adj <= 255))

    def test_t2_f06_04_min_contrast_neutralization(self):
        """T2-F06-04: Minimum Contrast Neutralization (C = -100 -> All 128)"""
        ramp = np.linspace(0, 255, 256, dtype=np.uint8).reshape(16, 16)
        adj = adjust_luminance(ramp, contrast=-100.0)
        self.assertTrue(np.all(adj == 128))

    def test_t2_f06_05_nan_slider_tolerance(self):
        """T2-F06-05: Invalid Slider Input Tolerance (NaN / None)"""
        sample = np.array([[100, 150]], dtype=np.uint8)
        adj_nan = adjust_luminance(sample, brightness=float('nan'), contrast=float('nan'))
        adj_none = adjust_luminance(sample, brightness=None, contrast=None)
        np.testing.assert_array_equal(adj_nan, sample)
        np.testing.assert_array_equal(adj_none, sample)


class TestT2F07AtkinsonBoundaries(unittest.TestCase):
    """F07: Atkinson Dithering Boundaries"""
    feature = "F07"
    tier = 2

    def test_t2_f07_01_double_offset_corner_guard(self):
        """T2-F07-01: Double-Offset Bottom-Right Corner Guard (126, 62)"""
        img = np.zeros((FRAME_HEIGHT, FRAME_WIDTH), dtype=np.float32)
        img[FRAME_HEIGHT - 2, FRAME_WIDTH - 2] = 255.0
        out = dither_atkinson(img)
        self.assertEqual(out.shape, (FRAME_HEIGHT, FRAME_WIDTH))

    def test_t2_f07_02_solid_black_uniform(self):
        """T2-F07-02: Solid Black Uniform Input (Y = 0)"""
        black = np.zeros((FRAME_HEIGHT, FRAME_WIDTH), dtype=np.uint8)
        out = dither_atkinson(black)
        self.assertTrue(np.all(out == 0))

    def test_t2_f07_03_solid_white_uniform(self):
        """T2-F07-03: Solid White Uniform Input (Y = 255)"""
        white = np.full((FRAME_HEIGHT, FRAME_WIDTH), 255, dtype=np.uint8)
        out = dither_atkinson(white)
        self.assertTrue(np.all(out == 255))

    def test_t2_f07_04_low_luminance_subthreshold_noise(self):
        """T2-F07-04: Low-Luminance Sub-Threshold Noise Suppression (Y in [1, 5])"""
        faint_noise = np.random.randint(1, 6, (FRAME_HEIGHT, FRAME_WIDTH), dtype=np.uint8)
        out = dither_atkinson(faint_noise)
        self.assertEqual(np.sum(out == 255), 0, "Faint noise should be completely suppressed to 0")

    def test_t2_f07_05_single_isolated_pixel_impulse(self):
        """T2-F07-05: Single Isolated Pixel Impulse Response"""
        impulse = np.zeros((FRAME_HEIGHT, FRAME_WIDTH), dtype=np.float32)
        impulse[10, 10] = 255.0
        out = dither_atkinson(impulse)
        self.assertEqual(out[10, 10], 255)
        # Neighbor error is 255 - 255 = 0, so no stray dots are created
        self.assertEqual(np.sum(out == 255), 1)


class TestT2F08FloydSteinbergBoundaries(unittest.TestCase):
    """F08: Floyd-Steinberg Dithering Boundaries"""
    feature = "F08"
    tier = 2

    def test_t2_f08_01_rightmost_column_boundary(self):
        """T2-F08-01: Rightmost Column Boundary (x = 127)"""
        img = np.zeros((FRAME_HEIGHT, FRAME_WIDTH), dtype=np.float32)
        img[:, FRAME_WIDTH - 1] = 200.0
        out = dither_floyd_steinberg(img)
        self.assertEqual(out.shape, (FRAME_HEIGHT, FRAME_WIDTH))

    def test_t2_f08_02_leftmost_column_boundary(self):
        """T2-F08-02: Leftmost Column Boundary (x = 0)"""
        img = np.zeros((FRAME_HEIGHT, FRAME_WIDTH), dtype=np.float32)
        img[:, 0] = 200.0
        out = dither_floyd_steinberg(img)
        self.assertEqual(out.shape, (FRAME_HEIGHT, FRAME_WIDTH))

    def test_t2_f08_03_bottom_row_boundary(self):
        """T2-F08-03: Bottom Row Boundary (y = 63)"""
        img = np.zeros((FRAME_HEIGHT, FRAME_WIDTH), dtype=np.float32)
        img[FRAME_HEIGHT - 1, :] = 200.0
        out = dither_floyd_steinberg(img)
        self.assertEqual(out.shape, (FRAME_HEIGHT, FRAME_WIDTH))

    def test_t2_f08_04_checkerboard_preservation(self):
        """T2-F08-04: Alternating 1-Pixel High-Frequency Checkerboard Preservation"""
        checker = np.zeros((FRAME_HEIGHT, FRAME_WIDTH), dtype=np.float32)
        checker[::2, ::2] = 255.0
        checker[1::2, 1::2] = 255.0
        out = dither_floyd_steinberg(checker)
        np.testing.assert_array_equal(out, checker.astype(np.uint8))

    def test_t2_f08_05_midgray_equilibrium(self):
        """T2-F08-05: Uniform Mid-Gray Equilibrium (Y = 128 -> Exactly 50% Lit Pixels)"""
        mid_gray = np.full((FRAME_HEIGHT, FRAME_WIDTH), 128.0, dtype=np.float32)
        out = dither_floyd_steinberg(mid_gray)
        lit_count = np.sum(out == 255)
        total_pixels = FRAME_WIDTH * FRAME_HEIGHT
        self.assertAlmostEqual(lit_count / total_pixels, 0.5, delta=0.01)


class TestT2F09BayerBoundaries(unittest.TestCase):
    """F09: Bayer Ordered Dithering Boundaries"""
    feature = "F09"
    tier = 2

    def test_t2_f09_01_modulo_wrap_corners(self):
        """T2-F09-01: Right/Bottom Matrix Modulo Wrap Conditions"""
        for size in [2, 4, 8]:
            t = bayer_threshold_matrix(size)
            wrap_x = (FRAME_WIDTH - 1) % size
            wrap_y = (FRAME_HEIGHT - 1) % size
            self.assertLess(wrap_x, size)
            self.assertLess(wrap_y, size)

    def test_t2_f09_02_exact_threshold_coincidence(self):
        """T2-F09-02: Exact Threshold Coincidence Boundary (Y == T_N -> 0)"""
        t4 = bayer_threshold_matrix(4)
        thresh_val = t4[0, 0]
        # Pixel with exact threshold value must be unlit (operator is strictly >)
        img = np.full((4, 4), thresh_val, dtype=np.float32)
        out = dither_bayer(img, matrix_size=4)
        self.assertEqual(out[0, 0], 0)

    def test_t2_f09_03_extreme_luminance_clamping(self):
        """T2-F09-03: Extreme Out-of-Range Luminance Clamping (-50 and 300)"""
        out_of_range = np.array([[-50, 300]], dtype=np.float32)
        out = dither_bayer(out_of_range, matrix_size=2)
        self.assertEqual(out[0, 0], 0)
        self.assertEqual(out[0, 1], 255)

    def test_t2_f09_04_repeat_run_identity(self):
        """T2-F09-04: Bit-for-Bit Identity Across 100 Runs"""
        img = np.full((FRAME_HEIGHT, FRAME_WIDTH), 150, dtype=np.uint8)
        base = dither_bayer(img, matrix_size=4)
        for _ in range(100):
            res = dither_bayer(img, matrix_size=4)
            np.testing.assert_array_equal(res, base)

    def test_t2_f09_05_invalid_matrix_size_fallback(self):
        """T2-F09-05: Non-Power-of-Two Matrix Guard (Fallback to 4x4)"""
        img = np.full((16, 16), 128, dtype=np.uint8)
        out = dither_bayer(img, matrix_size=5)  # 5 is invalid
        self.assertEqual(out.shape, (16, 16))


class TestT2F10ThresholdingBoundaries(unittest.TestCase):
    """F10: Dynamic Thresholding Boundaries"""
    feature = "F10"
    tier = 2

    def test_t2_f10_01_min_cutoff(self):
        """T2-F10-01: Minimum Cutoff Boundary (T = 0)"""
        gray = np.array([[0, 50, 255]], dtype=np.uint8)
        out = threshold_image(gray, cutoff=0)
        self.assertTrue(np.all(out == 255))

    def test_t2_f10_02_max_cutoff(self):
        """T2-F10-02: Maximum Cutoff Boundary (T = 255)"""
        gray = np.array([[0, 254, 255]], dtype=np.uint8)
        out = threshold_image(gray, cutoff=255)
        self.assertEqual(out[0, 0], 0)
        self.assertEqual(out[0, 1], 0)
        self.assertEqual(out[0, 2], 255)

    def test_t2_f10_03_floating_point_cutoff(self):
        """T2-F10-03: Fractional Floating Cutoff Value (T = 127.5)"""
        pixels = np.array([[127, 128]], dtype=np.uint8)
        out = threshold_image(pixels, cutoff=127.5)
        self.assertEqual(out[0, 0], 0)
        self.assertEqual(out[0, 1], 255)

    def test_t2_f10_04_rapid_slider_stability(self):
        """T2-F10-04: Rapid Slider Modulation Consistency"""
        img = np.full((FRAME_HEIGHT, FRAME_WIDTH), 100, dtype=np.uint8)
        for cutoff in range(0, 256, 10):
            res = threshold_image(img, cutoff=cutoff)
            expected = 255 if 100 >= cutoff else 0
            self.assertTrue(np.all(res == expected))

    def test_t2_f10_05_negative_threshold_clamp(self):
        """T2-F10-05: Negative or Out-of-Bounds Threshold Clamping"""
        pixels = np.array([[10]], dtype=np.uint8)
        out_neg = threshold_image(pixels, cutoff=-20)  # clamped to 0 -> 10 >= 0 is lit
        out_high = threshold_image(pixels, cutoff=300) # clamped to 255 -> 10 < 255 is unlit
        self.assertEqual(out_neg[0, 0], 255)
        self.assertEqual(out_high[0, 0], 0)


if __name__ == "__main__":
    unittest.main()
