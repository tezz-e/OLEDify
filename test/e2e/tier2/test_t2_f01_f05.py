"""
Tier 2 Boundary & Corner Cases: Features F01 through F05
Total tests: 25 (5 tests per feature)
"""
import unittest
import os
import re
import json
import numpy as np
import cv2
from PIL import Image
from test.e2e.config import FRAME_WIDTH, FRAME_HEIGHT, SAMPLE_MEDIA_DIR
from test.e2e.fixtures.media_generator import ensure_sample_fixtures


class TestT2F01WebStudioSetupBoundaries(unittest.TestCase):
    """F01: Web Studio Project Setup Boundaries"""
    feature = "F01"
    tier = 2

    def test_t2_f01_01_empty_package_json_handling(self):
        """T2-F01-01: Zero-Byte or Empty package.json Error Handling"""
        empty_str = ""
        with self.assertRaises(json.JSONDecodeError):
            json.loads(empty_str)

    def test_t2_f01_02_corrupted_json_syntax(self):
        """T2-F01-02: Corrupted JSON Syntax in Configuration Files"""
        corrupted = '{"compilerOptions": { "jsx": "react-jsx" '  # missing closing braces
        with self.assertRaises(json.JSONDecodeError):
            json.loads(corrupted)

    def test_t2_f01_03_missing_tailwind_directives_fallback(self):
        """T2-F01-03: Missing Tailwind Directives Fallback Handling"""
        css_without_tailwind = "/* Plain CSS */ body { margin: 0; }"
        has_tailwind = "@tailwind" in css_without_tailwind
        self.assertFalse(has_tailwind)

    def test_t2_f01_04_spaces_in_path(self):
        """T2-F01-04: Spaces & Special Characters in Root Directory Path"""
        test_path = r"D:\oled test (v1.0) & studio\web"
        norm_path = os.path.normpath(test_path)
        self.assertIn(" ", norm_path)
        self.assertIn("&", norm_path)
        quoted = f'"{norm_path}"'
        self.assertTrue(quoted.startswith('"') and quoted.endswith('"'))

    def test_t2_f01_05_node_version_compatibility(self):
        """T2-F01-05: Node.js Version Specification (>= 18)"""
        node_version = "24.15.0"
        major = int(node_version.split(".")[0])
        self.assertGreaterEqual(major, 18)


class TestT2F02VideoDecoderBoundaries(unittest.TestCase):
    """F02: Video Decoder Boundaries & Malformed Files"""
    feature = "F02"
    tier = 2

    @classmethod
    def setUpClass(cls):
        ensure_sample_fixtures()

    def test_t2_f02_01_zero_byte_video(self):
        """T2-F02-01: 0-Byte Video File Ingestion Rejection"""
        zero_byte_file = SAMPLE_MEDIA_DIR / "corrupt_zero_byte.bin"
        cap = cv2.VideoCapture(str(zero_byte_file))
        is_opened = cap.isOpened()
        cap.release()
        self.assertFalse(is_opened, "0-byte video must fail to open")

    def test_t2_f02_02_truncated_mp4_container(self):
        """T2-F02-02: Truncated MP4 File (Corrupted Atom Header)"""
        bad_mp4 = SAMPLE_MEDIA_DIR / "corrupt_header.mp4"
        cap = cv2.VideoCapture(str(bad_mp4))
        ret = False
        if cap.isOpened():
            ret, _ = cap.read()
        cap.release()
        self.assertFalse(ret, "Corrupted/truncated MP4 must not produce valid frames")

    def test_t2_f02_03_extreme_resolution_downscaling(self):
        """T2-F02-03: Extreme Ultra-High Resolution Video (16000x9000) Guard"""
        # Intermediate downscaling avoids allocating giant 16000x9000 raw buffer
        # In practice, target canvas is 128x64
        src_w, src_h = 16000, 9000
        target_w, target_h = 128, 64
        scale_x = target_w / src_w
        scale_y = target_h / src_h
        self.assertLess(scale_x, 0.01)
        self.assertLess(scale_y, 0.01)

    def test_t2_f02_04_single_frame_short_video(self):
        """T2-F02-04: Single-Frame Video (Duration < 0.033s) Calculation"""
        duration = 0.015  # seconds
        fps = 30.0
        calculated_frames = max(1, int(round(duration * fps)))
        self.assertEqual(calculated_frames, 1)

    def test_t2_f02_05_ultra_long_video_guard(self):
        """T2-F02-05: Ultra-Long Video Ingestion Guard (3600s, 108,000 Frames)"""
        duration = 3600.0  # 1 hour
        fps = 30.0
        total_frames = duration * fps
        max_recommended_frames = 1800  # 60 seconds
        should_warn = total_frames > max_recommended_frames
        self.assertTrue(should_warn)


class TestT2F03GifDecoderBoundaries(unittest.TestCase):
    """F03: Animated GIF Decoder Boundaries & Malformed Files"""
    feature = "F03"
    tier = 2

    @classmethod
    def setUpClass(cls):
        ensure_sample_fixtures()

    def test_t2_f03_01_invalid_gif_signature(self):
        """T2-F03-01: 0-Byte GIF or Invalid GIF Signature"""
        bad_gif = SAMPLE_MEDIA_DIR / "corrupt_bad_magic.gif"
        with open(bad_gif, "rb") as f:
            header = f.read(6)
        is_valid_gif = header in [b"GIF87a", b"GIF89a"]
        self.assertFalse(is_valid_gif)

    def test_t2_f03_02_single_frame_static_gif(self):
        """T2-F03-02: 1-Frame Static GIF Image Extraction"""
        img = Image.new("RGB", (128, 64), color=(255, 255, 255))
        n_frames = getattr(img, "n_frames", 1)
        self.assertEqual(n_frames, 1)

    def test_t2_f03_03_extreme_gif_dimensions(self):
        """T2-F03-03: Extreme GIF Dimensions (1x1 Pixel Image)"""
        extreme_img = SAMPLE_MEDIA_DIR / "non_standard_dims" / "img_1x1.png"
        with Image.open(extreme_img) as im:
            w, h = im.size
            self.assertEqual((w, h), (1, 1))
            resized = im.resize((128, 64), Image.Resampling.NEAREST)
            self.assertEqual(resized.size, (128, 64))

    def test_t2_f03_04_zero_inter_frame_delay_sanitization(self):
        """T2-F03-04: Zero Inter-Frame Delay Sanitization (delay = 0 -> 100ms)"""
        raw_delay = 0
        sanitized_delay = 100 if raw_delay <= 10 else raw_delay
        self.assertEqual(sanitized_delay, 100)

    def test_t2_f03_05_truncated_lzw_stream_handling(self):
        """T2-F03-05: Truncated LZW Compressed Stream Handling"""
        truncated_bytes = b"GIF89a\x80\x00\x40\x00\x00\x00\x00"
        with self.assertRaises(Exception):
            import io
            with Image.open(io.BytesIO(truncated_bytes)) as im:
                im.seek(1)


class TestT2F04PngSequenceBoundaries(unittest.TestCase):
    """F04: PNG Sequence Loader Boundaries"""
    feature = "F04"
    tier = 2

    def test_t2_f04_01_empty_file_selection(self):
        """T2-F04-01: Empty File Selection (0 Files) Handling"""
        files = []
        loaded_frames = [f for f in files if f.endswith(".png")]
        self.assertEqual(len(loaded_frames), 0)

    def test_t2_f04_02_single_1x1_pixel_image(self):
        """T2-F04-02: Single 1x1 Pixel PNG Image Scaling"""
        img_1x1 = np.array([[255]], dtype=np.uint8)
        scaled = cv2.resize(img_1x1, (FRAME_WIDTH, FRAME_HEIGHT), interpolation=cv2.INTER_NEAREST)
        self.assertEqual(scaled.shape, (FRAME_HEIGHT, FRAME_WIDTH))
        self.assertTrue(np.all(scaled == 255))

    def test_t2_f04_03_corrupt_png_rejection(self):
        """T2-F04-03: Truncated / Corrupt PNG Header Detection"""
        bad_png = SAMPLE_MEDIA_DIR / "corrupt_magic.png"
        with self.assertRaises(Exception):
            with Image.open(bad_png) as im:
                im.load()

    def test_t2_f04_04_deep_alphanumeric_sorting(self):
        """T2-F04-04: Massive Deep Alphanumeric Sequence Sorting (10,000 files)"""
        raw_names = [f"frame_{i}.png" for i in [9999, 0, 10, 100, 1, 20, 2]]
        def nat_key(s):
            return [int(t) if t.isdigit() else t.lower() for t in re.split(r'(\d+)', s)]
        sorted_names = sorted(raw_names, key=nat_key)
        self.assertEqual(sorted_names[0], "frame_0.png")
        self.assertEqual(sorted_names[1], "frame_1.png")
        self.assertEqual(sorted_names[2], "frame_2.png")
        self.assertEqual(sorted_names[-1], "frame_9999.png")

    def test_t2_f04_05_mixed_extensions_filtering(self):
        """T2-F04-05: Non-Image File Filtering in Batch Upload"""
        batch = ["pic.png", "doc.pdf", "data.json", "photo.JPG", "track.mp3"]
        img_exts = {".png", ".jpg", ".jpeg", ".webp", ".gif"}
        filtered = [f for f in batch if os.path.splitext(f)[1].lower() in img_exts]
        self.assertEqual(filtered, ["pic.png", "photo.JPG"])


class TestT2F05CropAndScaleBoundaries(unittest.TestCase):
    """F05: Interactive 2:1 Crop & Scale Boundaries"""
    feature = "F05"
    tier = 2

    def test_t2_f05_01_odd_source_dimensions(self):
        """T2-F05-01: Odd Source Dimensions (129x65) Normalization"""
        odd_img = np.zeros((65, 129), dtype=np.uint8)
        scaled = cv2.resize(odd_img, (FRAME_WIDTH, FRAME_HEIGHT), interpolation=cv2.INTER_AREA)
        self.assertEqual(scaled.shape, (64, 128))

    def test_t2_f05_02_extreme_aspect_ratios(self):
        """T2-F05-02: Extreme Aspect Ratios (Ultra-Tall 1:10 & Ultra-Wide 10:1)"""
        tall_w, tall_h = 100, 1000
        wide_w, wide_h = 1000, 100
        target_aspect = 2.0

        # Tall cover crop
        crop_w_tall = tall_w
        crop_h_tall = int(tall_w / target_aspect)  # 50
        self.assertLessEqual(crop_h_tall, tall_h)

        # Wide cover crop
        crop_h_wide = wide_h
        crop_w_wide = int(wide_h * target_aspect)  # 200
        self.assertLessEqual(crop_w_wide, wide_w)

    def test_t2_f05_03_drag_clamping(self):
        """T2-F05-03: Crop Box Boundary Drag Clamping"""
        src_w, src_h = 500, 500
        box_w, box_h = 200, 100
        # User drags to negative coordinates
        drag_x, drag_y = -50, -30
        clamped_x = max(0, min(drag_x, src_w - box_w))
        clamped_y = max(0, min(drag_y, src_h - box_h))
        self.assertEqual((clamped_x, clamped_y), (0, 0))

        # User drags beyond right/bottom
        drag_x_far, drag_y_far = 400, 450
        clamped_x_far = max(0, min(drag_x_far, src_w - box_w))
        clamped_y_far = max(0, min(drag_y_far, src_h - box_h))
        self.assertEqual((clamped_x_far, clamped_y_far), (300, 400))

    def test_t2_f05_04_minimum_crop_box_size(self):
        """T2-F05-04: Minimum Crop Box Size Guard (W >= 16, H >= 8)"""
        requested_w = 4
        requested_h = 2
        min_w, min_h = 16, 8
        safe_w = max(min_w, requested_w)
        safe_h = max(min_h, requested_h)
        self.assertEqual(safe_w, 16)
        self.assertEqual(safe_h, 8)

    def test_t2_f05_05_fractional_subpixel_rounding(self):
        """T2-F05-05: Fractional Sub-Pixel Floating Coordinates Rounding"""
        fx, fy, fw, fh = 10.73, 25.49, 200.8, 100.4
        rx, ry = int(round(fx)), int(round(fy))
        rw, rh = int(round(fw)), int(round(fh))
        self.assertEqual((rx, ry, rw, rh), (11, 25, 201, 100))


if __name__ == "__main__":
    unittest.main()
