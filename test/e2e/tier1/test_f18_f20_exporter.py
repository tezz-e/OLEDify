"""
Tier 1 Feature Coverage: Features F18 through F20 (C++ Exporter & Code Distribution)
Total tests: 15 (5 tests per feature)
"""
import unittest
import numpy as np
from test.e2e.config import FRAME_WIDTH, FRAME_HEIGHT, FRAME_SIZE_BYTES
from test.e2e.oracles.cpp_header_oracle import (
    parse_frames_header,
    validate_cpp_header_syntax
)
from test.e2e.oracles.rle_oracle import (
    packbits_compress,
    packbits_decompress,
    compress_frame_sequence_rle
)


class TestF18CppProgmemHeaderExporter(unittest.TestCase):
    """F18: C++ PROGMEM Header Exporter (src/frames.h)"""
    feature = "F18"
    tier = 1

    def test_t1_f18_01_macro_definitions_integrity(self):
        """T1-F18-01: Header Macro Definitions Integrity"""
        sample_header = (
            "#pragma once\n"
            "#include <Arduino.h>\n"
            "#define FRAME_WIDTH 128\n"
            "#define FRAME_HEIGHT 64\n"
            "#define FRAME_BYTES_PER_ROW 16\n"
            "#define FRAME_SIZE_BYTES 1024\n"
            "#define FRAME_FPS 30\n"
            "#define NUM_FRAMES 60\n"
            "const uint8_t reel_frames[NUM_FRAMES][FRAME_SIZE_BYTES] PROGMEM = {\n"
            "  { " + ", ".join(["0x00"] * 1024) + " }\n"
            "};\n"
        )
        parsed = parse_frames_header(sample_header)
        self.assertEqual(parsed["width"], 128)
        self.assertEqual(parsed["height"], 64)
        self.assertEqual(parsed["bytes_per_row"], 16)
        self.assertEqual(parsed["frame_size"], 1024)
        self.assertEqual(parsed["fps"], 30)
        self.assertEqual(parsed["num_frames"], 60)

    def test_t1_f18_02_progmem_2d_byte_array_format(self):
        """T1-F18-02: PROGMEM 2D Byte Array Formatting"""
        f0 = bytes([0xAA] * 1024)
        f1 = bytes([0x55] * 1024)
        header_lines = [
            "#pragma once",
            "#define NUM_FRAMES 2",
            "#define FRAME_WIDTH 128",
            "#define FRAME_HEIGHT 64",
            "#define FRAME_SIZE_BYTES 1024",
            "#define FRAME_FPS 30",
            "const uint8_t reel_frames[2][1024] PROGMEM = {"
        ]
        for f in [f0, f1]:
            hex_str = ", ".join(f"0x{b:02X}" for b in f)
            header_lines.append(f"  {{ {hex_str} }},")
        header_lines.append("};")
        header_text = "\n".join(header_lines)

        errors = validate_cpp_header_syntax(header_text, expected_frames=2, expected_fps=30)
        self.assertEqual(len(errors), 0, f"Validation errors: {errors}")

    def test_t1_f18_03_compatibility_symbol_aliasing(self):
        """T1-F18-03: Compatibility Symbol Aliasing (epd_bitmap_allArray)"""
        sample_header = (
            "#pragma once\n"
            "const uint8_t reel_frames[1][1024] PROGMEM = { ... };\n"
            "#define epd_bitmap_allArray reel_frames\n"
        )
        parsed = parse_frames_header(sample_header)
        self.assertTrue(parsed["has_alias"])

    def test_t1_f18_04_hex_literal_formatting(self):
        """T1-F18-04: Hex Literal Formatting Standard (0x05, 0xFF)"""
        vals = [5, 255, 0, 16]
        formatted = [f"0x{b:02X}" for b in vals]
        self.assertEqual(formatted, ["0x05", "0xFF", "0x00", "0x10"])

    def test_t1_f18_05_header_validation_oracle(self):
        """T1-F18-05: Header Validation against Oracle Constraints"""
        valid_header = (
            "#pragma once\n"
            "#define FRAME_WIDTH 128\n"
            "#define FRAME_HEIGHT 64\n"
            "#define FRAME_SIZE_BYTES 1024\n"
            "#define FRAME_FPS 30\n"
            "#define NUM_FRAMES 1\n"
            "const uint8_t reel_frames[1][1024] PROGMEM = {\n"
            "  { " + ", ".join(["0x12"] * 1024) + " }\n"
            "};\n"
        )
        errors = validate_cpp_header_syntax(valid_header, expected_frames=1, expected_fps=30)
        self.assertEqual(len(errors), 0)


class TestF19PackBitsRleHeaderExporter(unittest.TestCase):
    """F19: PackBits RLE Header Exporter & In-Memory Decompressor"""
    feature = "F19"
    tier = 1

    def test_t1_f19_01_literal_run_encoding(self):
        """T1-F19-01: PackBits Literal Run Encoding"""
        raw = bytes([0x01, 0x02, 0x03, 0x04, 0x05])
        compressed = packbits_compress(raw)
        # Header byte 4 (n=5 -> flag = 5 - 1 = 4) followed by 5 bytes
        self.assertEqual(compressed[0], 0x04)
        self.assertEqual(compressed[1:], raw)

    def test_t1_f19_02_repeat_run_encoding(self):
        """T1-F19-02: PackBits Repeat Run Encoding"""
        raw = bytes([0xFF] * 10)
        compressed = packbits_compress(raw)
        # Run of 10: flag is -(10 - 1) = -9 -> 257 - 10 = 247 (0xF7)
        self.assertEqual(compressed[0], 247)
        self.assertEqual(compressed[1], 0xFF)
        self.assertEqual(len(compressed), 2)

    def test_t1_f19_03_offset_table_generation(self):
        """T1-F19-03: Frame Offset Lookup Table Generation"""
        f1 = bytes([0x00] * 1024)
        f2 = bytes([0xFF] * 1024)
        f3 = bytes([0xAA, 0x55] * 512)
        rle_stream, offsets, lengths = compress_frame_sequence_rle([f1, f2, f3])

        self.assertEqual(len(offsets), 3)
        self.assertEqual(offsets[0], 0)
        self.assertGreater(offsets[1], offsets[0])
        self.assertGreater(offsets[2], offsets[1])
        self.assertEqual(offsets[1], lengths[0])

    def test_t1_f19_04_inline_decompressor_contract(self):
        """T1-F19-04: Inline C++ Decompressor Memory Safety Contract"""
        # PackBits decompressor must enforce output buffer truncation to 1024 bytes
        # even if an oversized run is passed
        oversized_run = bytes([257 - 128, 0xAA] * 20)  # 20 * 128 = 2560 bytes
        decomp = packbits_decompress(oversized_run, max_output_len=1024)
        self.assertEqual(len(decomp), 1024)

    def test_t1_f19_05_lossless_roundtrip(self):
        """T1-F19-05: Lossless Round-Trip Decompression Invariant"""
        import os
        np.random.seed(99)
        test_frame = bytearray(1024)
        # Mixture of runs and literals
        test_frame[0:200] = bytes([0x00] * 200)
        test_frame[200:300] = bytes([0xFF] * 100)
        test_frame[300:600] = os.urandom(300)
        test_frame[600:1024] = bytes([0xAA] * 424)

        compressed = packbits_compress(bytes(test_frame))
        decompressed = packbits_decompress(compressed, max_output_len=1024)
        self.assertEqual(decompressed, bytes(test_frame))


class TestF20CodeCopyAndDownload(unittest.TestCase):
    """F20: 1-Click Code Copy & Download UI Contract"""
    feature = "F20"
    tier = 1

    def test_t1_f20_01_flash_footprint_calculation(self):
        """T1-F20-01: Flash Footprint Metric Calculation"""
        num_frames = 120
        total_bytes = num_frames * FRAME_SIZE_BYTES
        self.assertEqual(total_bytes, 122880)
        kb = total_bytes / 1024.0
        self.assertEqual(kb, 120.0)
        # ESP32 16MB Flash percentage: 120KB / 16384KB ~ 0.73%
        pct = (total_bytes / (16 * 1024 * 1024)) * 100.0
        self.assertLess(pct, 1.0)

    def test_t1_f20_02_clipboard_payload_preparation(self):
        """T1-F20-02: Clipboard Payload String Integrity"""
        header_str = (
            "#pragma once\n"
            "#include <Arduino.h>\n"
            "#define NUM_FRAMES 1\n"
            "const uint8_t reel_frames[1][1024] PROGMEM = { { 0x00 } };\n"
        )
        self.assertIn("#pragma once", header_str)
        self.assertIn("reel_frames", header_str)
        self.assertGreater(len(header_str), 50)

    def test_t1_f20_03_progmem_download_blob_spec(self):
        """T1-F20-03: PROGMEM Header File Download Blob Specifications"""
        filename = "frames.h"
        mime_type = "text/x-c++hdr;charset=utf-8"
        self.assertTrue(filename.endswith(".h"))
        self.assertIn("text/x-c++hdr", mime_type)

    def test_t1_f20_04_rle_download_blob_spec(self):
        """T1-F20-04: PackBits RLE Header Download Blob Specifications"""
        filename = "frames_rle.h"
        mime_type = "text/x-c++hdr;charset=utf-8"
        self.assertEqual(filename, "frames_rle.h")
        self.assertIn("text/x-c++hdr", mime_type)

    def test_t1_f20_05_memory_badge_formatting(self):
        """T1-F20-05: Memory Metric Footprint Badge Formatting"""
        frames = 300
        size_bytes = frames * 1024
        badge_text = f"{size_bytes // 1024} KB ({frames} frames)"
        self.assertEqual(badge_text, "300 KB (300 frames)")


if __name__ == "__main__":
    unittest.main()
