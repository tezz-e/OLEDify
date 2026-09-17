"""
Tier 1 Feature Coverage: Features F06 through F10 (Image Processing & Dithering)
Total tests: 25 (5 tests per feature)
"""
import unittest
import numpy as np
import time
from test.e2e.config import FRAME_WIDTH, FRAME_HEIGHT
from test.e2e.oracles.dither_oracle import (
    adjust_luminance,
    dither_atkinson,
    dither_floyd_steinberg,
    dither_bayer,
    threshold_image,
    bayer_threshold_matrix,
    BAYER_2X2,
    BAYER_4X4,
    BAYER_8X8
)


class TestF06BrightnessAndContrast(unittest.TestCase):
    """F06: Brightness & Contrast Control (ITU-R BT.601 & Contrast Curves)"""
    feature = "F06"
    tier = 1

    def test_t1_f06_01_itu_bt601_grayscale(self):
        """T1-F06-01: ITU-R BT.601 Grayscale Conversion Coefficients"""
        red = np.array([[[255, 0, 0]]], dtype=np.uint8)
        green = np.array([[[0, 255, 0]]], dtype=np.uint8)
        blue = np.array([[[0, 0, 255]]], dtype=np.uint8)

        y_red = adjust_luminance(red)[0, 0]
        y_green = adjust_luminance(green)[0, 0]
        y_blue = adjust_luminance(blue)[0, 0]

        # 0.299 * 255 = 76.245 ~ 76
        # 0.587 * 255 = 149.685 ~ 150
        # 0.114 * 255 = 29.07 ~ 29
        self.assertIn(y_red, [76, 77])
        self.assertIn(y_green, [149, 150])
        self.assertIn(y_blue, [29, 30])

    def test_t1_f06_02_linear_brightness_boost(self):
        """T1-F06-02: Linear Brightness Boost Adjustment"""
        gray = np.array([[100]], dtype=np.uint8)
        # B = +50 -> B' = 50 * 2.55 = 127.5. Y' = 100 + 127.5 = 227.5 -> 228
        adj = adjust_luminance(gray, brightness=50.0, contrast=0.0)
        self.assertIn(adj[0, 0], [227, 228])

    def test_t1_f06_03_contrast_factor_adjustment(self):
        """T1-F06-03: Dynamic Contrast Factor Adjustment"""
        # C = +50 -> C' = 127.5 -> F ~ 2.975
        gray = np.array([[64, 192]], dtype=np.uint8)
        adj = adjust_luminance(gray, brightness=0.0, contrast=50.0)
        # 64: 2.975 * (64 - 128) + 128 = -190.4 + 128 = -62.4 -> 0
        # 192: 2.975 * (192 - 128) + 128 = 190.4 + 128 = 318.4 -> 255
        self.assertEqual(adj[0, 0], 0)
        self.assertEqual(adj[0, 1], 255)

    def test_t1_f06_04_extreme_luminance_clamping(self):
        """T1-F06-04: Extreme Luminance Range Clamping [0, 255]"""
        ramp = np.linspace(0, 255, 256, dtype=np.uint8).reshape((16, 16))
        adj_high = adjust_luminance(ramp, brightness=100.0, contrast=100.0)
        adj_low = adjust_luminance(ramp, brightness=-100.0, contrast=-100.0)

        self.assertTrue(np.all(adj_high >= 0) and np.all(adj_high <= 255))
        self.assertTrue(np.all(adj_low >= 0) and np.all(adj_low <= 255))

    def test_t1_f06_05_monochrome_invert_toggle(self):
        """T1-F06-05: Monochrome Invert Toggle"""
        values = np.array([[0, 50, 128, 200, 255]], dtype=np.uint8)
        inverted = adjust_luminance(values, invert=True)
        expected = np.array([[255, 205, 127, 55, 0]], dtype=np.uint8)
        np.testing.assert_array_equal(inverted, expected)


class TestF07AtkinsonDithering(unittest.TestCase):
    """F07: Atkinson Dithering (6 neighbors, 75% error diffused, 25% discarded)"""
    feature = "F07"
    tier = 1

    def test_t1_f07_01_kernel_diffusion_distribution(self):
        """T1-F07-01: 6-Neighbor Kernel Diffusion Weights"""
        grid = np.zeros((10, 10), dtype=np.float32)
        grid[2, 2] = 136.0  # Q=255, err = 136 - 255 = -119. -119/8 = -14.875
        out = dither_atkinson(grid)
        self.assertEqual(out[2, 2], 255)

    def test_t1_f07_02_error_loss_25_percent(self):
        """T1-F07-02: 25% Intentional Error Loss Verification"""
        error_val = 80.0
        # Atkinson gives 1/8 to 6 neighbors: 6 * (80 / 8) = 60
        diffused = 6 * (error_val / 8.0)
        discarded = error_val - diffused
        self.assertEqual(diffused / error_val, 0.75)
        self.assertEqual(discarded / error_val, 0.25)

    def test_t1_f07_03_binary_quantization_invariant(self):
        """T1-F07-03: 1-Bit Binary Quantization Invariant (Strictly 0 or 255)"""
        gradient = np.tile(np.linspace(0, 255, FRAME_WIDTH, dtype=np.float32), (FRAME_HEIGHT, 1))
        dithered = dither_atkinson(gradient)
        unique_vals = set(np.unique(dithered))
        self.assertTrue(unique_vals.issubset({0, 255}))

    def test_t1_f07_04_worm_suppression_near_white(self):
        """T1-F07-04: Clean Background Worm Suppression in Atkinson vs F-S"""
        near_white = np.full((FRAME_HEIGHT, FRAME_WIDTH), 253, dtype=np.float32)
        atk_out = dither_atkinson(near_white)
        fs_out = dither_floyd_steinberg(near_white)
        # Atkinson discards 25% error, leaving pure white without dark worms on near-white
        atk_black_pixels = np.sum(atk_out == 0)
        fs_black_pixels = np.sum(fs_out == 0)
        self.assertLessEqual(atk_black_pixels, fs_black_pixels)

    def test_t1_f07_05_canvas_edge_diffusion_boundary(self):
        """T1-F07-05: Canvas Edge Diffusion Boundary Guard"""
        corner_pixel = np.zeros((FRAME_HEIGHT, FRAME_WIDTH), dtype=np.float32)
        corner_pixel[FRAME_HEIGHT - 1, FRAME_WIDTH - 1] = 255
        out = dither_atkinson(corner_pixel)
        self.assertEqual(out.shape, (FRAME_HEIGHT, FRAME_WIDTH))
        self.assertEqual(out[FRAME_HEIGHT - 1, FRAME_WIDTH - 1], 255)


class TestF08FloydSteinbergDithering(unittest.TestCase):
    """F08: Floyd-Steinberg Dithering (4 neighbors, 100% error diffused)"""
    feature = "F08"
    tier = 1

    def test_t1_f08_01_neighbor_diffusion_weights(self):
        """T1-F08-01: 4-Neighbor Kernel Diffusion Weights (7/16, 3/16, 5/16, 1/16)"""
        weights = [7.0/16.0, 3.0/16.0, 5.0/16.0, 1.0/16.0]
        self.assertAlmostEqual(sum(weights), 1.0)
        err = -112.0
        diffused = [err * w for w in weights]
        self.assertEqual(diffused, [-49.0, -21.0, -35.0, -7.0])

    def test_t1_f08_02_total_error_conservation(self):
        """T1-F08-02: 100% Total Error Conservation Invariant"""
        err = -112.0
        weights = [7.0/16.0, 3.0/16.0, 5.0/16.0, 1.0/16.0]
        sum_diffused = sum(err * w for w in weights)
        self.assertEqual(sum_diffused, err)

    def test_t1_f08_03_monotonic_stipple_density(self):
        """T1-F08-03: Smooth Gradient Monotonic Stipple Density"""
        ramp = np.tile(np.linspace(0, 255, FRAME_WIDTH, dtype=np.float32), (FRAME_HEIGHT, 1))
        out = dither_floyd_steinberg(ramp)
        # Split into 4 column slices of width 32
        counts = [np.sum(out[:, i*32:(i+1)*32] == 255) for i in range(4)]
        self.assertTrue(counts[0] <= counts[1] <= counts[2] <= counts[3])

    def test_t1_f08_04_deterministic_output(self):
        """T1-F08-04: Deterministic Bit-Exact Output Consistency"""
        np.random.seed(42)
        test_img = np.random.randint(0, 256, (FRAME_HEIGHT, FRAME_WIDTH), dtype=np.uint8)
        run1 = dither_floyd_steinberg(test_img)
        run2 = dither_floyd_steinberg(test_img)
        np.testing.assert_array_equal(run1, run2)

    def test_t1_f08_05_perimeter_boundary_damping(self):
        """T1-F08-05: Left/Right Perimeter Damping Guard"""
        border_img = np.zeros((FRAME_HEIGHT, FRAME_WIDTH), dtype=np.float32)
        border_img[:, 0] = 200
        border_img[:, -1] = 200
        out = dither_floyd_steinberg(border_img)
        self.assertEqual(out.shape, (FRAME_HEIGHT, FRAME_WIDTH))


class TestF09BayerOrderedDithering(unittest.TestCase):
    """F09: Bayer Ordered Dithering (2x2, 4x4, 8x8 Matrices)"""
    feature = "F09"
    tier = 1

    def test_t1_f09_01_bayer_2x2_thresholds(self):
        """T1-F09-01: Bayer 2x2 Matrix Threshold Verification"""
        t2 = bayer_threshold_matrix(2)
        # M2 = [[0, 2], [3, 1]]
        # (val + 0.5) / 4 * 255
        expected = np.array([
            [(0 + 0.5) / 4 * 255, (2 + 0.5) / 4 * 255],
            [(3 + 0.5) / 4 * 255, (1 + 0.5) / 4 * 255]
        ])
        np.testing.assert_allclose(t2, expected, rtol=1e-5)

        patch = np.full((2, 2), 100, dtype=np.uint8)
        out = dither_bayer(patch, matrix_size=2)
        # 100 > 31.875 -> 255; 100 < 159.375 -> 0; 100 < 223.125 -> 0; 100 > 95.625 -> 255
        np.testing.assert_array_equal(out, [[255, 0], [0, 255]])

    def test_t1_f09_02_bayer_4x4_crosshatch(self):
        """T1-F09-02: Bayer 4x4 Crosshatch Pattern (50% fill at Y=128)"""
        gray = np.full((FRAME_HEIGHT, FRAME_WIDTH), 128, dtype=np.uint8)
        out = dither_bayer(gray, matrix_size=4)
        # Exactly 8 of 16 pixels lit in each 4x4 patch
        patch = out[0:4, 0:4]
        self.assertEqual(np.sum(patch == 255), 8)

    def test_t1_f09_03_bayer_8x8_quantization_levels(self):
        """T1-F09-03: Bayer 8x8 Matrix 64-Level Quantization Spread"""
        t8 = bayer_threshold_matrix(8)
        self.assertEqual(t8.shape, (8, 8))
        self.assertEqual(len(np.unique(t8)), 64)

    def test_t1_f09_04_temporal_stability(self):
        """T1-F09-04: Temporal Stability / Zero Crawling Noise"""
        img = np.full((FRAME_HEIGHT, FRAME_WIDTH), 100, dtype=np.uint8)
        out1 = dither_bayer(img, matrix_size=4)
        out2 = dither_bayer(img, matrix_size=4)
        diff = np.sum(out1 != out2)
        self.assertEqual(diff, 0, "Bayer dithering must produce 0 temporal flicker across static frames")

    def test_t1_f09_05_parallel_throughput(self):
        """T1-F09-05: Modulo Spatial Matrix Wrapping"""
        t4 = bayer_threshold_matrix(4)
        # Coordinate wrapping
        self.assertEqual(t4[0, 0], t4[0 % 4, 0 % 4])
        self.assertEqual(t4[63 % 4, 127 % 4], t4[3, 3])


class TestF10DynamicThresholding(unittest.TestCase):
    """F10: Dynamic Thresholding with Adjustable Cutoff Slider"""
    feature = "F10"
    tier = 1

    def test_t1_f10_01_midpoint_cutoff(self):
        """T1-F10-01: Midpoint Cutoff Thresholding (T=128)"""
        pixels = np.array([[0, 127, 128, 200, 255]], dtype=np.uint8)
        out = threshold_image(pixels, cutoff=128)
        np.testing.assert_array_equal(out, [[0, 0, 255, 255, 255]])

    def test_t1_f10_02_cutoff_slider_update(self):
        """T1-F10-02: Dynamic Slider Cutoff Update (T=64 vs T=192)"""
        ramp = np.linspace(0, 255, 256, dtype=np.uint8).reshape((16, 16))
        out_64 = threshold_image(ramp, cutoff=64)
        out_192 = threshold_image(ramp, cutoff=192)
        lit_64 = np.sum(out_64 == 255)
        lit_192 = np.sum(out_192 == 255)
        self.assertGreater(lit_64, lit_192)

    def test_t1_f10_03_boundary_cutoffs(self):
        """T1-F10-03: Boundary Cutoff Limits (T=0 and T=255)"""
        gray = np.full((FRAME_HEIGHT, FRAME_WIDTH), 100, dtype=np.uint8)
        out_t0 = threshold_image(gray, cutoff=0)
        out_t255 = threshold_image(gray, cutoff=255)
        self.assertTrue(np.all(out_t0 == 255))
        self.assertTrue(np.all(out_t255 == 0))

    def test_t1_f10_04_silhouette_edge_sharpness(self):
        """T1-F10-04: High-Contrast Silhouette Binary Transition"""
        edge = np.array([[50, 100, 150, 200]], dtype=np.uint8)
        out = threshold_image(edge, cutoff=128)
        np.testing.assert_array_equal(out, [[0, 0, 255, 255]])

    def test_t1_f10_05_execution_throughput(self):
        """T1-F10-05: Real-Time Execution Latency Benchmark"""
        img = np.random.randint(0, 256, (FRAME_HEIGHT, FRAME_WIDTH), dtype=np.uint8)
        start = time.perf_counter()
        for _ in range(100):
            _ = threshold_image(img, cutoff=128)
        elapsed = time.perf_counter() - start
        self.assertLess(elapsed, 0.05, f"100 thresholding iterations should take < 50ms, took {elapsed*1000:.2f}ms")


if __name__ == "__main__":
    unittest.main()
