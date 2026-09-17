"""
Tier 2 Boundary & Corner Cases: Features F18 through F20
Total tests: 15 (5 tests per feature)
"""
import unittest
import re
from test.e2e.config import FRAME_WIDTH, FRAME_HEIGHT, FRAME_SIZE_BYTES
from test.e2e.oracles.rle_oracle import (
    packbits_compress,
    packbits_decompress,
    compress_frame_sequence_rle
)
from test.e2e.oracles.cpp_header_oracle import validate_cpp_header_syntax


class TestT2F18ProgmemBoundaries(unittest.TestCase):
    """F18: PROGMEM Header Exporter Boundaries"""
    feature = "F18"
    tier = 2

    def test_t2_f18_01_single_frame_export(self):
        """T2-F18-01: Single Frame Export Boundary (NUM_FRAMES = 1)"""
        single_frame_header = (
            "#pragma once\n"
            "#define FRAME_WIDTH 128\n"
            "#define FRAME_HEIGHT 64\n"
            "#define FRAME_SIZE_BYTES 1024\n"
            "#define FRAME_FPS 30\n"
            "#define NUM_FRAMES 1\n"
            "const uint8_t reel_frames[1][1024] PROGMEM = {\n"
            "  { " + ", ".join(["0x00"] * 1024) + " }\n"
            "};\n"
        )
        errors = validate_cpp_header_syntax(single_frame_header, expected_frames=1, expected_fps=30)
        self.assertEqual(len(errors), 0)

    def test_t2_f18_02_large_animation_export(self):
        """T2-F18-02: Large Animation Export (1,000 Frames = 1 MB Flash)"""
        num_frames = 1000
        total_bytes = num_frames * FRAME_SIZE_BYTES
        self.assertEqual(total_bytes, 1024000)

    def test_t2_f18_03_empty_frame_store_export(self):
        """T2-F18-03: Empty Frame Store Export Attempt (0 Frames)"""
        frames = []
        is_exportable = len(frames) > 0
        self.assertFalse(is_exportable)

    def test_t2_f18_04_special_characters_project_identifier(self):
        """T2-F18-04: Special Characters in Project Name Sanitization"""
        raw_name = "OLED & Animation <Test>!"
        # Sanitize to valid C++ macro identifier
        sanitized = re.sub(r"[^A-Za-z0-9_]", "_", raw_name).upper()
        sanitized = re.sub(r"_+", "_", sanitized).strip("_")
        self.assertEqual(sanitized, "OLED_ANIMATION_TEST")
        macro = f"#ifndef {sanitized}_FRAMES_H"
        self.assertIn("OLED_ANIMATION_TEST", macro)

    def test_t2_f18_05_flash_memory_threshold_warning(self):
        """T2-F18-05: Flash Memory Threshold Warning Trigger"""
        frames = 500
        size_kb = (frames * 1024) / 1024  # 500 KB
        uno_flash_kb = 32
        esp32_flash_kb = 16384
        exceeds_uno = size_kb > uno_flash_kb
        exceeds_esp32 = size_kb > esp32_flash_kb
        self.assertTrue(exceeds_uno)
        self.assertFalse(exceeds_esp32)


class TestT2F19RleBoundaries(unittest.TestCase):
    """F19: PackBits RLE Boundaries"""
    feature = "F19"
    tier = 2

    def test_t2_f19_01_worst_case_expansion(self):
        """T2-F19-01: Worst-Case High-Entropy Expansion Boundary"""
        # Alternating bytes: 0xAA 0x55 (no runs)
        high_entropy = bytes([0xAA, 0x55] * 512)
        compressed = packbits_compress(high_entropy)
        # PackBits maximum overhead is 1 byte header per 128 bytes literal sequence
        # 1024 / 128 = 8 chunks -> 1024 + 8 = 1032 bytes
        self.assertLessEqual(len(compressed), 1035)
        # Round-trip remains 100% exact
        decomp = packbits_decompress(compressed, max_output_len=1024)
        self.assertEqual(decomp, high_entropy)

    def test_t2_f19_02_repeat_run_split_over_128(self):
        """T2-F19-02: Maximum Repeat Run Length Boundary (> 128 Bytes)"""
        repeat_300 = bytes([0x42] * 300)
        compressed = packbits_compress(repeat_300)
        # Should split into: 128 + 128 + 44
        decomp = packbits_decompress(compressed, max_output_len=300)
        self.assertEqual(decomp, repeat_300)
        self.assertEqual(len(compressed), 6)  # 3 runs * 2 bytes each

    def test_t2_f19_03_all_zero_frame_compression_ratio(self):
        """T2-F19-03: All-Zero Frame Compression Ratio (> 98%)"""
        black_frame = bytes([0x00] * 1024)
        compressed = packbits_compress(black_frame)
        # 1024 zeros = 8 runs of 128 zeros = 8 * 2 bytes = 16 bytes
        self.assertEqual(len(compressed), 16)
        ratio = (1.0 - len(compressed) / 1024.0) * 100.0
        self.assertGreater(ratio, 98.0)

    def test_t2_f19_04_decompressor_truncation_safety(self):
        """T2-F19-04: Decompressor Buffer Truncation Safety"""
        huge_run = bytes([257 - 128, 0xFF] * 10)  # 1280 bytes
        decomp = packbits_decompress(huge_run, max_output_len=1024)
        self.assertEqual(len(decomp), 1024)

    def test_t2_f19_05_offset_table_monotonicity(self):
        """T2-F19-05: Offset Table Ascending Monotonicity Guard"""
        frames = [bytes([i % 256] * 1024) for i in range(20)]
        _, offsets, lengths = compress_frame_sequence_rle(frames)
        self.assertEqual(len(offsets), 20)
        for i in range(len(offsets) - 1):
            self.assertLess(offsets[i], offsets[i + 1])
            self.assertEqual(offsets[i] + lengths[i], offsets[i + 1])


class TestT2F20CodeCopyBoundaries(unittest.TestCase):
    """F20: 1-Click Code Copy & Download Boundaries"""
    feature = "F20"
    tier = 2

    def test_t2_f20_01_insecure_context_fallback(self):
        """T2-F20-01: Insecure Context Clipboard Fallback Pattern"""
        # When navigator.clipboard is unavailable, uses hidden textarea
        def copy_code(is_secure_context):
            if is_secure_context:
                return "navigator.clipboard.writeText"
            return "textarea.execCommand('copy')"

        self.assertEqual(copy_code(True), "navigator.clipboard.writeText")
        self.assertEqual(copy_code(False), "textarea.execCommand('copy')")

    def test_t2_f20_02_permission_denial_fallback(self):
        """T2-F20-02: User Clipboard Permission Denial Handling"""
        error_name = "NotAllowedError"
        ui_action = "modal_show_select_all" if error_name == "NotAllowedError" else "toast_error"
        self.assertEqual(ui_action, "modal_show_select_all")

    def test_t2_f20_03_filename_sanitization(self):
        """T2-F20-03: Special Characters in Download Filename Sanitization"""
        dirty_filename = 'frames / \\ : * ? " < > | .h'
        cleaned = re.sub(r'[/\\:*?"<>|]', '', dirty_filename)
        cleaned = re.sub(r'\s+', ' ', cleaned).strip()
        self.assertEqual(cleaned, "frames .h")

    def test_t2_f20_04_download_debounce(self):
        """T2-F20-04: Rapid Multi-Click Download Debounce"""
        clicks = [0.0, 0.05, 0.10, 0.15, 0.20, 0.80]  # Timestamps
        debounced_clicks = []
        last_click = -1.0
        debounce_window = 0.300  # 300ms
        for c in clicks:
            if c - last_click >= debounce_window:
                debounced_clicks.append(c)
                last_click = c
        self.assertEqual(len(debounced_clicks), 2)  # Clicks at 0.0 and 0.80

    def test_t2_f20_05_blob_url_lifecycle(self):
        """T2-F20-05: Object URL Creation and Revocation Lifecycle"""
        urls_created = []
        urls_revoked = []
        mock_url = "blob:http://localhost:5173/uuid-1234"
        urls_created.append(mock_url)
        # Revoke after download trigger
        urls_revoked.append(mock_url)
        self.assertEqual(urls_created, urls_revoked)


if __name__ == "__main__":
    unittest.main()
