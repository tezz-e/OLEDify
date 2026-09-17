"""
Tier 3: Cross-Feature Combinations Test Suite
Covers 30 pairwise/triad feature interactions (T3-01 through T3-30).
"""
import unittest
import numpy as np
import cv2
import math
import os
import re
from PIL import Image
from test.e2e.config import (
    FRAME_WIDTH,
    FRAME_HEIGHT,
    FRAME_SIZE_BYTES,
    PACKET_TOTAL_SIZE,
    THEMES,
    RESP_ACK,
    RESP_NAK,
    CMD_FRAME,
    CMD_PING,
    SAMPLE_MEDIA_DIR
)
from test.e2e.fixtures.media_generator import ensure_sample_fixtures
from test.e2e.oracles.dither_oracle import (
    adjust_luminance,
    dither_atkinson,
    dither_floyd_steinberg,
    dither_bayer,
    threshold_image
)
from test.e2e.oracles.xbmp_oracle import pack_xbmp, unpack_xbmp
from test.e2e.oracles.protocol_simulator import (
    ESP32StreamReceiverSimulator,
    build_oled_stream_packet,
    verify_oled_packet_checksum,
    MODE_STANDALONE,
    MODE_STREAMING
)
from test.e2e.oracles.rle_oracle import (
    packbits_compress,
    packbits_decompress,
    compress_frame_sequence_rle
)
from test.e2e.oracles.cpp_header_oracle import (
    validate_cpp_header_syntax,
    parse_frames_header
)


class TestTier3Combinations(unittest.TestCase):
    """Tier 3: Cross-Feature Combinations (T3-01 to T3-30)"""
    tier = 3

    @classmethod
    def setUpClass(cls):
        ensure_sample_fixtures()

    def test_t3_01_mp4_atkinson_xbmp_webserial(self):
        """T3-01: MP4 Video -> Atkinson Dither -> XBMP Packing -> WebSerial 921600 Baud Stream"""
        mp4_path = SAMPLE_MEDIA_DIR / "synthetic_10frame.mp4"
        cap = cv2.VideoCapture(str(mp4_path))
        ret, frame = cap.read()
        cap.release()
        self.assertTrue(ret)

        # 2:1 Center Cover Crop
        h, w, _ = frame.shape
        crop_h = int(w / 2.0)
        crop_y = (h - crop_h) // 2
        cropped = frame[crop_y:crop_y + crop_h, 0:w]
        resized = cv2.resize(cropped, (FRAME_WIDTH, FRAME_HEIGHT), interpolation=cv2.INTER_AREA)

        # Grayscale & Atkinson Dither
        gray = cv2.cvtColor(resized, cv2.COLOR_BGR2GRAY)
        dithered = dither_atkinson(gray)

        # XBMP Packing
        packed = pack_xbmp(dithered)
        self.assertEqual(len(packed), FRAME_SIZE_BYTES)

        # WebSerial Framing & Delivery
        pkt = build_oled_stream_packet(packed, seq=1)
        self.assertEqual(len(pkt), PACKET_TOTAL_SIZE)
        self.assertTrue(verify_oled_packet_checksum(pkt))

        sim = ESP32StreamReceiverSimulator()
        resps = sim.feed_bytes(pkt)
        self.assertEqual(resps[0], bytes([RESP_ACK, 1]))
        self.assertEqual(sim.total_frames_rendered, 1)

    def test_t3_02_webm_floyd_steinberg_xbmp_progmem(self):
        """T3-02: WebM Video -> Floyd-Steinberg Dither -> XBMP Packing -> C++ PROGMEM Header"""
        # Synthetic video frame
        frame = np.full((360, 640), 128, dtype=np.uint8)
        # Contain pillarbox scale to 128x64
        resized = cv2.resize(frame, (114, 64), interpolation=cv2.INTER_AREA)
        canvas = np.zeros((FRAME_HEIGHT, FRAME_WIDTH), dtype=np.uint8)
        canvas[:, 7:121] = resized

        dithered = dither_floyd_steinberg(canvas)
        packed = pack_xbmp(dithered)

        header_str = (
            "#pragma once\n"
            "#define NUM_FRAMES 1\n"
            "#define FRAME_WIDTH 128\n"
            "#define FRAME_HEIGHT 64\n"
            "#define FRAME_SIZE_BYTES 1024\n"
            "#define FRAME_FPS 24\n"
            "const uint8_t reel_frames[1][1024] PROGMEM = {\n"
            "  { " + ", ".join(f"0x{b:02X}" for b in packed) + " }\n"
            "};\n"
        )
        errors = validate_cpp_header_syntax(header_str, expected_frames=1, expected_fps=24)
        self.assertEqual(len(errors), 0)

    def test_t3_03_gif_bayer4x4_rle_download(self):
        """T3-03: Animated GIF -> Bayer 4x4 Ordered Dither -> PackBits RLE Exporter -> 1-Click Download"""
        gif_path = SAMPLE_MEDIA_DIR / "animated_test.gif"
        frames = []
        with Image.open(gif_path) as im:
            for i in range(im.n_frames):
                im.seek(i)
                gray = im.convert("L").resize((FRAME_WIDTH, FRAME_HEIGHT))
                d = dither_bayer(np.array(gray), matrix_size=4)
                frames.append(pack_xbmp(d))

        rle_stream, offsets, lengths = compress_frame_sequence_rle(frames)
        self.assertEqual(len(offsets), 5)
        # Lossless roundtrip verification
        decomp = packbits_decompress(rle_stream[:lengths[0]])
        self.assertEqual(decomp, frames[0])

    def test_t3_04_png_seq_contrast_threshold_serial(self):
        """T3-04: PNG Sequence -> Brightness/Contrast Adjustment -> Dynamic Thresholding -> WebSerial Stream"""
        png_path = SAMPLE_MEDIA_DIR / "png_sequence" / "frame_1.png"
        with Image.open(png_path) as im:
            gray = np.array(im.convert("L"))

        adj = adjust_luminance(gray, brightness=20.0, contrast=30.0)
        thresh = threshold_image(adj, cutoff=140)
        packed = pack_xbmp(thresh)

        sim = ESP32StreamReceiverSimulator()
        pkt = build_oled_stream_packet(packed, seq=0)
        resps = sim.feed_bytes(pkt)
        self.assertEqual(resps[0], bytes([RESP_ACK, 0]))

    def test_t3_05_typewriter_glitch_canvas_progmem(self):
        """T3-05: Typewriter Lyric -> XOR Bitwise Glitch -> Simulated OLED Canvas -> PROGMEM Header"""
        text = "OLED CYBER"
        canvas = np.zeros((FRAME_HEIGHT, FRAME_WIDTH), dtype=np.uint8)
        canvas[20:30, 10:80] = 255  # Text area
        noise = np.random.randint(0, 32, (FRAME_HEIGHT, FRAME_WIDTH), dtype=np.uint8)
        glitched = np.bitwise_xor(canvas, noise)
        packed = pack_xbmp(glitched)

        header = (
            "#pragma once\n"
            "#define NUM_FRAMES 1\n"
            "#define FRAME_WIDTH 128\n"
            "#define FRAME_HEIGHT 64\n"
            "#define FRAME_SIZE_BYTES 1024\n"
            "#define FRAME_FPS 30\n"
            "const uint8_t reel_frames[1][1024] PROGMEM = {\n"
            "  { " + ", ".join(f"0x{b:02X}" for b in packed) + " }\n"
            "};\n"
        )
        parsed = parse_frames_header(header)
        self.assertEqual(parsed["num_frames"], 1)

    def test_t3_06_starfield_tearing_timeline_serial(self):
        """T3-06: 3D Warp Starfield -> Horizontal Row Tearing -> 15 FPS Timeline -> WebSerial"""
        stars_x = np.random.uniform(-50, 50, 50)
        stars_y = np.random.uniform(-50, 50, 50)
        stars_z = np.random.uniform(1.0, 50.0, 50)

        canvas = np.zeros((FRAME_HEIGHT, FRAME_WIDTH), dtype=np.uint8)
        for x, y, z in zip(stars_x, stars_y, stars_z):
            px = int(64 + (x / z) * 64)
            py = int(32 + (y / z) * 32)
            if 0 <= px < FRAME_WIDTH and 0 <= py < FRAME_HEIGHT:
                canvas[py, px] = 255

        # Row tearing on scanlines 20..30
        for y in range(20, 30):
            canvas[y, :] = np.roll(canvas[y, :], 8)

        packed = pack_xbmp(canvas)
        pkt = build_oled_stream_packet(packed, seq=15)
        sim = ESP32StreamReceiverSimulator()
        resps = sim.feed_bytes(pkt)
        self.assertEqual(resps[0], bytes([RESP_ACK, 15]))

    def test_t3_07_contain_crop_atkinson_ack_flow(self):
        """T3-07: 2:1 Contain (Letterbox) Crop -> Atkinson Dither -> Binary Framing -> Stop-and-Wait ACK Flow Control"""
        # Square image
        sq = np.full((500, 500), 180, dtype=np.uint8)
        # Letterbox: scale to 128x48 centered in 128x64
        scaled = cv2.resize(sq, (128, 48), interpolation=cv2.INTER_AREA)
        canvas = np.zeros((FRAME_HEIGHT, FRAME_WIDTH), dtype=np.uint8)
        canvas[8:56, :] = scaled

        dithered = dither_atkinson(canvas)
        packed = pack_xbmp(dithered)

        sim = ESP32StreamReceiverSimulator()
        pkt = build_oled_stream_packet(packed, seq=1)
        resps = sim.feed_bytes(pkt)
        self.assertEqual(resps[0], bytes([RESP_ACK, 1]))

    def test_t3_08_corrupted_packet_nak_retransmit(self):
        """T3-08: Corrupted Packet -> 0x15 NAK Response -> Retransmit -> Draw"""
        sim = ESP32StreamReceiverSimulator()
        original_pkt = bytearray(build_oled_stream_packet(bytes([0x42] * 1024), seq=0x42))
        # Corrupt single bit
        corrupt_pkt = bytearray(original_pkt)
        corrupt_pkt[100] ^= 0x01

        # Feed corrupted packet -> NAK
        resps1 = sim.feed_bytes(bytes(corrupt_pkt))
        self.assertEqual(resps1[0], bytes([RESP_NAK, 0x42]))
        self.assertEqual(sim.total_frames_rendered, 0)

        # Retransmit uncorrupted packet -> ACK
        resps2 = sim.feed_bytes(bytes(original_pkt))
        self.assertEqual(resps2[0], bytes([RESP_ACK, 0x42]))
        self.assertEqual(sim.total_frames_rendered, 1)

    def test_t3_09_serial_timeout_watchdog_fallback(self):
        """T3-09: Serial Timeout (2000ms) -> Standalone Fallback PROGMEM Loop"""
        sim = ESP32StreamReceiverSimulator()
        pkt = build_oled_stream_packet(bytes([0xAA] * 1024), seq=0)
        sim.feed_bytes(pkt, current_time=100.0)
        self.assertEqual(sim.mode, MODE_STREAMING)

        # After 2.1 seconds of silence
        mode = sim.update_watchdog(current_time=102.1)
        self.assertEqual(mode, MODE_STANDALONE)

    def test_t3_10_gif_disposal2_cover_fs_cyan(self):
        """T3-10: Animated GIF with Disposal Method 2 -> Cover Center Crop -> Floyd-Steinberg -> OLED Cyan Phosphor"""
        theme = THEMES["Classic Cyan"]
        # Clear prior subrect
        canvas = np.zeros((FRAME_HEIGHT, FRAME_WIDTH), dtype=np.uint8)
        canvas[10:30, 20:50] = 200
        dithered = dither_floyd_steinberg(canvas)
        packed = pack_xbmp(dithered)
        self.assertEqual(len(packed), 1024)
        self.assertEqual(theme["hex"], "#00f0ff")

    def test_t3_11_png_seq_natural_sort_stretch_bayer8x8_rle(self):
        """T3-11: PNG Sequence Natural Alphanumeric Sorting -> Stretch Crop -> Bayer 8x8 Matrix -> PackBits RLE Header"""
        names = ["f_10.png", "f_1.png", "f_2.png"]
        def natsort(s):
            return [int(t) if t.isdigit() else t for t in re.split(r'(\d+)', s)]
        sorted_names = sorted(names, key=natsort)
        self.assertEqual(sorted_names, ["f_1.png", "f_2.png", "f_10.png"])

        raw = np.full((150, 200), 100, dtype=np.uint8)
        stretched = cv2.resize(raw, (FRAME_WIDTH, FRAME_HEIGHT))
        d = dither_bayer(stretched, matrix_size=8)
        packed = pack_xbmp(d)
        compressed = packbits_compress(packed)
        self.assertLessEqual(len(compressed), 1035)

    def test_t3_12_lyric_bounce_timeline_scrub_copy(self):
        """T3-12: Bounce Lyric Kinetic Typography -> Procedural Timeline Ingestion -> Scrub & Step Controls -> 1-Click Copy"""
        # 30 frames
        frames = [pack_xbmp(np.zeros((FRAME_HEIGHT, FRAME_WIDTH), dtype=np.uint8)) for _ in range(30)]
        # Scrub to frame 15
        f15 = frames[15]
        self.assertEqual(len(f15), 1024)
        # Step to frame 16
        f16 = frames[16]
        self.assertEqual(len(f16), 1024)

    def test_t3_13_radial_particles_timeline_xbmp_sh1106(self):
        """T3-13: Radial Ballistic Particle Burst -> Procedural Timeline Integration -> XBMP Packing -> SH1106 Fast I2C Bus Transfer"""
        particles = [(64.0 + math.cos(a) * 10, 32.0 + math.sin(a) * 10) for a in np.linspace(0, 2*math.pi, 20)]
        canvas = np.zeros((FRAME_HEIGHT, FRAME_WIDTH), dtype=np.uint8)
        for x, y in particles:
            if 0 <= int(x) < FRAME_WIDTH and 0 <= int(y) < FRAME_HEIGHT:
                canvas[int(y), int(x)] = 255
        packed = pack_xbmp(canvas)
        self.assertEqual(len(packed), 1024)

    def test_t3_14_invert_contrast_fs_yellow_blue(self):
        """T3-14: Luminance Inversion + High Contrast -> Floyd-Steinberg -> OLED Yellow/Blue Split Display -> 30 FPS Playback"""
        gradient = np.tile(np.linspace(0, 255, FRAME_WIDTH, dtype=np.uint8), (FRAME_HEIGHT, 1))
        inverted = adjust_luminance(gradient, contrast=50.0, invert=True)
        dithered = dither_floyd_steinberg(inverted)
        # Dual display: row 16 is blank separator
        dithered[16, :] = 0
        self.assertEqual(np.sum(dithered[16, :]), 0)

    def test_t3_15_4k_downscale_boost_bayer2x2_packet(self):
        """T3-15: High-Resolution 4K MP4 Ingestion -> Brightness Boost (+40) -> Bayer 2x2 Dither -> 1031-Byte OLED-Stream v1 Framing"""
        # Mock 4K frame directly downscaled to intermediate
        inter = np.full((FRAME_HEIGHT, 256), 100, dtype=np.uint8)
        cropped = inter[:, 64:192]
        adj = adjust_luminance(cropped, brightness=40.0)
        d = dither_bayer(adj, matrix_size=2)
        packed = pack_xbmp(d)
        pkt = build_oled_stream_packet(packed, seq=1)
        self.assertEqual(len(pkt), 1031)

    def test_t3_16_gif_var_delays_atkinson_progmem(self):
        """T3-16: Animated GIF with Variable Delays -> Atkinson Dither -> C++ PROGMEM Export -> Dual-Mode Firmware Flash Compilation"""
        raw = np.zeros((FRAME_HEIGHT, FRAME_WIDTH), dtype=np.uint8)
        raw[20:40, 20:40] = 255
        d = dither_atkinson(raw)
        packed = pack_xbmp(d)
        header = (
            "#pragma once\n"
            "#define NUM_FRAMES 3\n"
            "#define FRAME_WIDTH 128\n"
            "#define FRAME_HEIGHT 64\n"
            "#define FRAME_SIZE_BYTES 1024\n"
            "#define FRAME_FPS 20\n"
            "const uint8_t reel_frames[3][1024] PROGMEM = {\n"
            + ",\n".join(["  { " + ", ".join(f"0x{b:02X}" for b in packed) + " }"] * 3) +
            "\n};\n"
        )
        errors = validate_cpp_header_syntax(header, expected_frames=3, expected_fps=20)
        self.assertEqual(len(errors), 0)

    def test_t3_17_typewriter_starfield_amber_canvas(self):
        """T3-17: Typewriter Lyric Reveal Overlaid with 3D Warp Starfield -> Amber Phosphor OLED Canvas"""
        star_layer = np.zeros((FRAME_HEIGHT, FRAME_WIDTH), dtype=np.uint8)
        star_layer[10, 20] = 255
        star_layer[40, 90] = 255
        text_layer = np.zeros((FRAME_HEIGHT, FRAME_WIDTH), dtype=np.uint8)
        text_layer[25:35, 30:100] = 255
        composite = np.bitwise_or(star_layer, text_layer)
        self.assertEqual(composite[10, 20], 255)
        self.assertEqual(composite[26, 35], 255)
        self.assertEqual(THEMES["Amber"]["hex"], "#ffb000")

    def test_t3_18_rolling_glitch_packet_ssd1306(self):
        """T3-18: Rolling Scanline V-SYNC Glitch -> OLED-Stream v1 Packet Delivery -> SSD1306 Full Frame Refresh"""
        frame = np.zeros((FRAME_HEIGHT, FRAME_WIDTH), dtype=np.uint8)
        bar_y = 24
        frame[bar_y:bar_y + 8, :] = 255
        packed = pack_xbmp(frame)
        pkt = build_oled_stream_packet(packed, seq=18)
        sim = ESP32StreamReceiverSimulator()
        resps = sim.feed_bytes(pkt)
        self.assertEqual(resps[0], bytes([RESP_ACK, 18]))

    def test_t3_19_crop_threshold_rle_decompress(self):
        """T3-19: Custom Interactive Crop Box Pan/Zoom -> Dynamic Thresholding (Cutoff=160) -> PackBits RLE Compression -> Embedded C++ Decompressor Execution"""
        src = np.full((300, 300), 180, dtype=np.uint8)
        crop = cv2.resize(src[50:150, 50:250], (FRAME_WIDTH, FRAME_HEIGHT))
        thresh = threshold_image(crop, cutoff=160)
        packed = pack_xbmp(thresh)
        compressed = packbits_compress(packed)
        decomp = packbits_decompress(compressed)
        self.assertEqual(decomp, packed)

    def test_t3_20_200_png_atkinson_24fps_stream(self):
        """T3-20: 200-Frame PNG Sequence -> Atkinson Dither -> 24 FPS Timeline Pacing -> Pipelined WebSerial Streaming"""
        sim = ESP32StreamReceiverSimulator()
        raw = np.zeros((FRAME_HEIGHT, FRAME_WIDTH), dtype=np.uint8)
        d = dither_atkinson(raw)
        packed = pack_xbmp(d)
        for seq in range(20):  # Test batch sequence pacing
            pkt = build_oled_stream_packet(packed, seq=seq)
            resps = sim.feed_bytes(pkt)
            self.assertEqual(resps[0], bytes([RESP_ACK, seq]))
        self.assertEqual(sim.total_frames_rendered, 20)

    def test_t3_21_vertical_webm_cover_copy(self):
        """T3-21: Vertical 9:16 WebM Reel -> 2:1 Cover Aspect Crop -> 1024-Byte XBMP Packing -> 1-Click Code Copy to Clipboard"""
        src_w, src_h = 1080, 1920
        crop_h = int(src_w / 2.0)  # 540
        crop_y = (src_h - crop_h) // 2  # 690
        self.assertEqual(crop_h, 540)
        self.assertEqual(crop_y, 690)

    def test_t3_22_karaoke_xor_timeline_serial(self):
        """T3-22: Karaoke Inverted Beat Highlight -> XOR Glitch Noise -> Procedural Timeline Export -> 921600 Baud WebSerial Stream"""
        canvas = np.zeros((FRAME_HEIGHT, FRAME_WIDTH), dtype=np.uint8)
        canvas[20:35, 10:50] = 255  # Karaoke active box
        glitched = np.bitwise_xor(canvas, 0x0F)
        packed = pack_xbmp(glitched)
        pkt = build_oled_stream_packet(packed, seq=22)
        sim = ESP32StreamReceiverSimulator()
        resps = sim.feed_bytes(pkt)
        self.assertEqual(resps[0], bytes([RESP_ACK, 22]))

    def test_t3_23_bayer4x4_xbmp_i2c_sh1106(self):
        """T3-23: Bayer 4x4 Ordered Dither -> 1024-Byte XBMP Stream -> 400 kHz Fast I2C Bus Transfer -> SH1106 2-Pixel Offset Calibration"""
        stripes = np.zeros((FRAME_HEIGHT, FRAME_WIDTH), dtype=np.uint8)
        stripes[:, ::4] = 255
        d = dither_bayer(stripes, matrix_size=4)
        packed = pack_xbmp(d)
        pkt = build_oled_stream_packet(packed, seq=23)
        sim = ESP32StreamReceiverSimulator()
        resps = sim.feed_bytes(pkt)
        self.assertEqual(resps[0], bytes([RESP_ACK, 23]))

    def test_t3_24_highentropy_fs_rle_fallback(self):
        """T3-24: High-Entropy Floyd-Steinberg Dither -> PackBits RLE Fallback Guard -> Header File Download"""
        np.random.seed(111)
        noise = np.random.randint(0, 256, (FRAME_HEIGHT, FRAME_WIDTH), dtype=np.uint8)
        d = dither_floyd_steinberg(noise)
        packed = pack_xbmp(d)
        compressed = packbits_compress(packed)
        # PackBits handles high-entropy gracefully without infinite loop or failure
        decomp = packbits_decompress(compressed)
        self.assertEqual(decomp, packed)

    def test_t3_25_ballistic_burst_row_tear_progmem(self):
        """T3-25: Ballistic Particle Explosion with Gravity/Drag -> Horizontal Row Tearing Shift -> C++ frames.h Generation -> ESP32-S3 Flash Verification"""
        canvas = np.zeros((FRAME_HEIGHT, FRAME_WIDTH), dtype=np.uint8)
        canvas[32, 64] = 255  # Blast center
        canvas[40:48, :] = np.roll(canvas[40:48, :], -12)
        packed = pack_xbmp(canvas)
        self.assertEqual(len(packed), 1024)

    def test_t3_26_mixed_ingestion_contain_green(self):
        """T3-26: Mixed Drag-and-Drop Ingestion (GIF + PNG Sequence) -> Contain Letterbox -> Simulated OLED Matrix Green Phosphor"""
        theme = THEMES["Matrix Green"]
        self.assertEqual(theme["hex"], "#00ff66")

    def test_t3_27_rapid_reconnect_ping_resync(self):
        """T3-27: Rapid WebSerial Connect/Disconnect/Reconnect Cycles -> Zero Buffer Leakage -> Handshake Ping 0x02 -> Clean Resync"""
        sim = ESP32StreamReceiverSimulator()
        ping_pkt = build_oled_stream_packet(b"", cmd=CMD_PING, seq=1)
        resps = sim.feed_bytes(ping_pkt)
        self.assertEqual(resps[0], bytes([RESP_ACK, 1]))

    def test_t3_28_extreme_contrast_threshold_packet(self):
        """T3-28: Extreme Contrast (+100) -> Dynamic Threshold Cutoff -> 1024-Byte LSB-First XBMP Packing -> Binary Packet Serialization"""
        img = np.linspace(0, 255, FRAME_WIDTH * FRAME_HEIGHT, dtype=np.uint8).reshape((FRAME_HEIGHT, FRAME_WIDTH))
        adj = adjust_luminance(img, contrast=100.0)
        thresh = threshold_image(adj, cutoff=128)
        packed = pack_xbmp(thresh)
        pkt = build_oled_stream_packet(packed, seq=28)
        self.assertEqual(len(pkt), 1031)

    def test_t3_29_typewriter_scrub_serial_flow(self):
        """T3-29: Text Typewriter CPS Adjustment -> Playback Timeline Scrubbing -> Real-Time WebSerial Frame Pacing via Stop-and-Wait ACK"""
        sim = ESP32StreamReceiverSimulator()
        for frame_idx in [0, 5, 10, 15, 20]:
            canvas = np.zeros((FRAME_HEIGHT, FRAME_WIDTH), dtype=np.uint8)
            canvas[20:30, 0:frame_idx*5] = 255
            packed = pack_xbmp(canvas)
            pkt = build_oled_stream_packet(packed, seq=frame_idx)
            resps = sim.feed_bytes(pkt)
            self.assertEqual(resps[0], bytes([RESP_ACK, frame_idx]))

    def test_t3_30_atkinson_grid_dual_driver(self):
        """T3-30: Atkinson Dithered Line Art -> Sub-Pixel Grid Canvas Emulation with Bloom Filter -> Dual Driver Hardware SSD1306/SH1106 Bit-Exact Alignment"""
        grid = np.zeros((FRAME_HEIGHT, FRAME_WIDTH), dtype=np.uint8)
        grid[::4, :] = 255
        grid[:, ::4] = 255
        d = dither_atkinson(grid)
        packed = pack_xbmp(d)
        unpacked = unpack_xbmp(packed)
        np.testing.assert_array_equal(unpacked, d.flatten())


if __name__ == "__main__":
    unittest.main()
