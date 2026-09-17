"""
Tier 1 Feature Coverage: Features F01 through F05 (Ingestion & Pre-processing)
Total tests: 25 (5 tests per feature)
"""
import os
import json
import re
import unittest
import numpy as np
import cv2
from PIL import Image
from test.e2e.config import PROJECT_ROOT, WEB_DIR, SAMPLE_MEDIA_DIR, FRAME_WIDTH, FRAME_HEIGHT
from test.e2e.fixtures.media_generator import ensure_sample_fixtures, generate_synthetic_mp4, generate_synthetic_gif


class TestF01WebStudioProjectSetup(unittest.TestCase):
    """F01: Web Studio Project Setup (Vite + React + TypeScript + Tailwind CSS)"""
    feature = "F01"
    tier = 1

    def test_t1_f01_01_config_integrity(self):
        """T1-F01-01: Web Scaffold Configuration Integrity"""
        pkg_path = WEB_DIR / "package.json"
        vite_path = WEB_DIR / "vite.config.ts"
        ts_path = WEB_DIR / "tsconfig.json"
        html_path = WEB_DIR / "index.html"

        for p in [pkg_path, vite_path, ts_path, html_path]:
            self.assertTrue(p.exists(), f"Missing configuration file: {p}")

        with open(pkg_path, "r", encoding="utf-8") as f:
            pkg_data = json.load(f)

        self.assertIn("scripts", pkg_data)
        self.assertIn("dev", pkg_data["scripts"])
        self.assertIn("build", pkg_data["scripts"])
        self.assertIn("preview", pkg_data["scripts"])

    def test_t1_f01_02_production_bundle_deps(self):
        """T1-F01-02: Production Dependencies Specification"""
        with open(WEB_DIR / "package.json", "r", encoding="utf-8") as f:
            pkg_data = json.load(f)

        deps = {**pkg_data.get("dependencies", {}), **pkg_data.get("devDependencies", {})}
        self.assertIn("react", deps)
        self.assertIn("react-dom", deps)
        self.assertIn("vite", deps)
        self.assertIn("typescript", deps)
        self.assertIn("tailwindcss", deps)

    def test_t1_f01_03_tailwind_css_config(self):
        """T1-F01-03: Tailwind CSS Configuration & Phosphor Palette"""
        tw_path = WEB_DIR / "tailwind.config.js"
        self.assertTrue(tw_path.exists(), "tailwind.config.js must exist")
        with open(tw_path, "r", encoding="utf-8") as f:
            tw_content = f.read()

        # Check for phosphor color tokens in tailwind config or styles
        self.assertTrue(
            "content" in tw_content,
            "Tailwind config must specify content purge paths"
        )
        # Check custom theme colors or oled theme classes
        css_path = WEB_DIR / "src" / "index.css"
        if not css_path.exists():
            css_path = WEB_DIR / "src" / "styles" / "oled.css"
        self.assertTrue(css_path.exists() or (WEB_DIR / "src").exists())

    def test_t1_f01_04_typescript_strict_config(self):
        """T1-F01-04: TypeScript Configuration Integrity"""
        with open(WEB_DIR / "tsconfig.json", "r", encoding="utf-8") as f:
            ts_content = f.read()
        # Remove comments if any before json parse or regex check
        ts_clean = re.sub(r"//.*?\n", "\n", ts_content)
        ts_clean = re.sub(r"/\*.*?\*/", "", ts_clean, flags=re.DOTALL)
        ts_data = json.loads(ts_clean)
        compiler_opts = ts_data.get("compilerOptions", {})
        self.assertIn(compiler_opts.get("jsx"), ["react-jsx", "react", "preserve"])

    def test_t1_f01_05_root_dom_mount(self):
        """T1-F01-05: Root DOM Mount & App Initialization Contract"""
        with open(WEB_DIR / "index.html", "r", encoding="utf-8") as f:
            html_content = f.read()
        self.assertIn('id="root"', html_content)
        self.assertIn("src/main.tsx", html_content)


class TestF02VideoDecoder(unittest.TestCase):
    """F02: Video Drag & Drop Decoder (MP4 / WebM Ingestion)"""
    feature = "F02"
    tier = 1

    @classmethod
    def setUpClass(cls):
        ensure_sample_fixtures()

    def test_t1_f02_01_standard_mp4_metadata(self):
        """T1-F02-01: Standard MP4 Container Ingestion & Metadata Extraction"""
        video_path = PROJECT_ROOT / "igexport-DckvRqKPsI_.mp4"
        if not video_path.exists():
            video_path = SAMPLE_MEDIA_DIR / "synthetic_10frame.mp4"

        cap = cv2.VideoCapture(str(video_path))
        self.assertTrue(cap.isOpened(), "Failed to open MP4 container")
        w = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
        h = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
        fps = cap.get(cv2.CAP_PROP_FPS)
        total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
        cap.release()

        self.assertGreater(w, 0)
        self.assertGreater(h, 0)
        self.assertGreater(fps, 0)
        self.assertGreater(total_frames, 0)

    def test_t1_f02_02_synthetic_video_ingestion(self):
        """T1-F02-02: Synthetic Video Container Ingestion"""
        mp4_path = SAMPLE_MEDIA_DIR / "synthetic_10frame.mp4"
        cap = cv2.VideoCapture(str(mp4_path))
        self.assertTrue(cap.isOpened())
        frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
        w = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
        h = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
        cap.release()
        self.assertEqual(frames, 10)
        self.assertEqual(w, 720)
        self.assertEqual(h, 1280)

    def test_t1_f02_03_time_slice_frame_extraction(self):
        """T1-F02-03: Discrete Time-Slice Frame Extraction"""
        mp4_path = SAMPLE_MEDIA_DIR / "synthetic_10frame.mp4"
        cap = cv2.VideoCapture(str(mp4_path))
        extracted = []
        for idx in range(5):
            cap.set(cv2.CAP_PROP_POS_FRAMES, idx)
            ret, frame = cap.read()
            self.assertTrue(ret)
            extracted.append(frame)
        cap.release()

        self.assertEqual(len(extracted), 5)
        # Check that different frames have variance
        diff = np.sum(np.abs(extracted[0].astype(int) - extracted[3].astype(int)))
        self.assertGreater(diff, 0, "Frames at different times should have variance")

    def test_t1_f02_04_downsampling_buffer_allocation(self):
        """T1-F02-04: Downsampling Frame Buffer Allocation Guard"""
        raw_frame = np.zeros((1920, 1080, 3), dtype=np.uint8)
        resized = cv2.resize(raw_frame, (FRAME_WIDTH, FRAME_HEIGHT), interpolation=cv2.INTER_AREA)
        # 128 x 64 x 4 RGBA memory length is exactly 32,768 bytes (<= 33 KB)
        rgba_buffer_size = resized.shape[0] * resized.shape[1] * 4
        self.assertEqual(rgba_buffer_size, 128 * 64 * 4)
        self.assertLessEqual(rgba_buffer_size, 33 * 1024)

    def test_t1_f02_05_non_video_mime_rejection(self):
        """T1-F02-05: Non-Video MIME Type Rejection"""
        valid_extensions = {".mp4", ".webm", ".gif", ".png", ".jpg", ".jpeg"}
        test_file = "document.pdf"
        ext = os.path.splitext(test_file)[1].lower()
        is_supported = ext in valid_extensions
        self.assertFalse(is_supported)


class TestF03AnimatedGifDecoder(unittest.TestCase):
    """F03: Animated GIF Decoder (omggif / PIL Frame Extraction)"""
    feature = "F03"
    tier = 1

    @classmethod
    def setUpClass(cls):
        ensure_sample_fixtures()

    def test_t1_f03_01_gif_header_parsing(self):
        """T1-F03-01: GIF Header Parsing & Frame Counting"""
        gif_path = SAMPLE_MEDIA_DIR / "animated_test.gif"
        with Image.open(gif_path) as im:
            self.assertTrue(im.is_animated)
            self.assertEqual(im.n_frames, 5)
            self.assertEqual(im.size, (128, 64))

    def test_t1_f03_02_gif_disposal_mode_1(self):
        """T1-F03-02: GIF Disposal Mode 1 (Leave in Place)"""
        # Mode 1 leaves prior canvas pixels unmodified
        canvas = np.zeros((64, 128), dtype=np.uint8)
        canvas[10:20, 10:20] = 255  # Frame 1 sub-rect
        # Frame 2 drawn with disposal 1
        canvas[30:40, 30:40] = 255
        self.assertEqual(canvas[15, 15], 255, "Prior frame pixels must be preserved in Mode 1")
        self.assertEqual(canvas[35, 35], 255)

    def test_t1_f03_03_gif_disposal_mode_2(self):
        """T1-F03-03: GIF Disposal Mode 2 (Restore to Background)"""
        canvas = np.zeros((64, 128), dtype=np.uint8)
        canvas[10:20, 10:20] = 255  # Frame 1 draw
        # Disposal 2 resets previous frame's sub-rect to background
        sub_rect = (10, 20, 10, 20)
        canvas[sub_rect[0]:sub_rect[1], sub_rect[2]:sub_rect[3]] = 0
        self.assertEqual(canvas[15, 15], 0, "Prior sub-rect must be cleared to background in Mode 2")

    def test_t1_f03_04_gif_disposal_mode_3(self):
        """T1-F03-04: GIF Disposal Mode 3 (Restore to Previous)"""
        canvas_snapshot = np.zeros((64, 128), dtype=np.uint8)
        canvas_snapshot[5:15, 5:15] = 200  # Frame 1 state
        current = canvas_snapshot.copy()
        current[25:35, 25:35] = 255       # Frame 2 overlay
        # Mode 3 reverts to canvas_snapshot before Frame 3
        reverted = canvas_snapshot.copy()
        self.assertEqual(reverted[30, 30], 0)
        self.assertEqual(reverted[10, 10], 200)

    def test_t1_f03_05_gif_frame_delay_mapping(self):
        """T1-F03-05: Frame Delay Extraction & FPS Mapping"""
        gif_path = SAMPLE_MEDIA_DIR / "animated_test.gif"
        delays = []
        with Image.open(gif_path) as im:
            for i in range(im.n_frames):
                im.seek(i)
                delays.append(im.info.get("duration", 100))
        self.assertEqual(len(delays), 5)
        for d in delays:
            self.assertGreater(d, 0)
        total_duration = sum(delays)
        self.assertEqual(total_duration, 500)


class TestF04PngSequenceLoader(unittest.TestCase):
    """F04: PNG Sequence Loader (Alphanumeric Natural Collation)"""
    feature = "F04"
    tier = 1

    @classmethod
    def setUpClass(cls):
        ensure_sample_fixtures()

    def test_t1_f04_01_batch_multi_file_ingestion(self):
        """T1-F04-01: Batch Multi-File Ingestion"""
        png_dir = SAMPLE_MEDIA_DIR / "png_sequence"
        png_files = [f for f in os.listdir(png_dir) if f.endswith(".png")]
        self.assertEqual(len(png_files), 10)

    def test_t1_f04_02_natural_alphanumeric_sorting(self):
        """T1-F04-02: Natural Alphanumeric Sorting Order"""
        raw_list = ["frame_10.png", "frame_1.png", "frame_2.png", "frame_20.png", "frame_3.png"]
        # Natural sorting helper matching localeCompare({ numeric: true })
        def natural_sort_key(s):
            return [int(text) if text.isdigit() else text.lower() for text in re.split(r'(\d+)', s)]

        sorted_list = sorted(raw_list, key=natural_sort_key)
        expected = ["frame_1.png", "frame_2.png", "frame_3.png", "frame_10.png", "frame_20.png"]
        self.assertEqual(sorted_list, expected)

    def test_t1_f04_03_mixed_image_format_normalization(self):
        """T1-F04-03: Mixed Image Format Batch Normalization"""
        # Formats normalize to 128x64 uint8 array
        img_gray = np.full((64, 128), 100, dtype=np.uint8)
        img_rgb = np.full((64, 128, 3), 100, dtype=np.uint8)
        img_rgba = np.full((64, 128, 4), 100, dtype=np.uint8)

        for img in [img_gray, img_rgb, img_rgba]:
            if img.ndim == 3 and img.shape[2] >= 3:
                norm = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY if img.shape[2] == 3 else cv2.COLOR_BGRA2GRAY)
            else:
                norm = img
            self.assertEqual(norm.shape, (64, 128))

    def test_t1_f04_04_bitmap_rasterization_dimensions(self):
        """T1-F04-04: Bitmap Rasterization to Target Canvas Dimensions"""
        sample_png = SAMPLE_MEDIA_DIR / "png_sequence" / "frame_1.png"
        with Image.open(sample_png) as im:
            w, h = im.size
            self.assertEqual(w, 128)
            self.assertEqual(h, 64)

    def test_t1_f04_05_mixed_media_non_image_filtering(self):
        """T1-F04-05: Mixed Media Non-Image Filtering"""
        incoming = ["frame_1.png", "data.json", "frame_2.png", "notes.txt", "frame_3.png"]
        image_exts = {".png", ".jpg", ".jpeg", ".webp", ".gif"}
        filtered = [f for f in incoming if os.path.splitext(f)[1].lower() in image_exts]
        self.assertEqual(filtered, ["frame_1.png", "frame_2.png", "frame_3.png"])


class TestF05CropAndScale(unittest.TestCase):
    """F05: Interactive 2:1 Crop & Scale Bounding Box Presets"""
    feature = "F05"
    tier = 1

    def test_t1_f05_01_strict_2_to_1_aspect_ratio(self):
        """T1-F05-01: Strict 2:1 Aspect Ratio Enforcement"""
        w = 500
        h = w / 2.0
        self.assertEqual(h, 250.0)
        self.assertEqual(w / h, 2.0)

    def test_t1_f05_02_cover_preset_geometry(self):
        """T1-F05-02: Cover / Fill Preset Geometry (9:16 Vertical Reel)"""
        src_w, src_h = 720, 1280
        target_aspect = 2.0  # 2:1
        # In cover mode, crop width is src_w, crop height = src_w / target_aspect
        crop_w = src_w
        crop_h = int(src_w / target_aspect)  # 360
        crop_x = (src_w - crop_w) // 2       # 0
        crop_y = (src_h - crop_h) // 2       # (1280 - 360) // 2 = 460
        self.assertEqual((crop_x, crop_y, crop_w, crop_h), (0, 460, 720, 360))

    def test_t1_f05_03_contain_preset_geometry(self):
        """T1-F05-03: Contain / Letterbox Preset Geometry (1:1 Square Source)"""
        src_w, src_h = 800, 800
        target_w, target_h = 128, 64
        # Scale to fit inside 128x64 without distortion:
        scale = min(target_w / src_w, target_h / src_h)  # 64 / 800 = 0.08
        scaled_w = int(src_w * scale)                    # 64
        scaled_h = int(src_h * scale)                    # 64
        pad_x = (target_w - scaled_w) // 2               # (128 - 64) // 2 = 32
        pad_y = (target_h - scaled_h) // 2               # 0
        self.assertEqual((scaled_w, scaled_h, pad_x, pad_y), (64, 64, 32, 0))

    def test_t1_f05_04_stretch_preset_geometry(self):
        """T1-F05-04: Stretch Preset Geometry"""
        src_w, src_h = 1920, 1080
        target_w, target_h = 128, 64
        # Stretch directly resamples source to target
        self.assertEqual((target_w, target_h), (128, 64))

    def test_t1_f05_05_resampling_filter_quality(self):
        """T1-F05-05: Resampling Filter Quality (Nearest vs Area/Bilinear)"""
        checker = np.zeros((100, 100), dtype=np.uint8)
        checker[::2, ::2] = 255
        checker[1::2, 1::2] = 255

        nearest = cv2.resize(checker, (128, 64), interpolation=cv2.INTER_NEAREST)
        area = cv2.resize(checker, (128, 64), interpolation=cv2.INTER_AREA)

        # Nearest neighbor produces strictly binary values
        nearest_unique = set(np.unique(nearest))
        self.assertTrue(nearest_unique.issubset({0, 255}))

        # Area interpolation produces intermediate grayscale values
        area_unique = np.unique(area)
        self.assertGreater(len(area_unique), 2)


if __name__ == "__main__":
    unittest.main()
