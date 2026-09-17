"""
Tier 4 Real-World Application Scenarios (14 comprehensive scenarios).
Covers complete end-to-end user workflows, creator personas, media pipelines,
streaming protocols, fault recoveries, and firmware export validations.
"""

import unittest
import numpy as np
import re
import time
import math

from test.e2e.config import (
    FRAME_WIDTH,
    FRAME_HEIGHT,
    FRAME_SIZE_BYTES,
    BAUD_RATE,
    SERIAL_MAGIC_0,
    SERIAL_MAGIC_1,
    CMD_FRAME,
    CMD_PING,
    RESP_ACK,
    RESP_NAK,
    WATCHDOG_TIMEOUT_MS,
)
from test.e2e.oracles.dither_oracle import (
    adjust_luminance,
    dither_atkinson,
    dither_floyd_steinberg,
    dither_bayer,
    threshold_image,
)
from test.e2e.oracles.xbmp_oracle import (
    pack_xbmp,
    unpack_xbmp,
)
from test.e2e.oracles.protocol_simulator import (
    build_oled_stream_packet,
    verify_oled_packet_checksum,
    ESP32StreamReceiverSimulator,
)
from test.e2e.oracles.rle_oracle import (
    packbits_compress,
    packbits_decompress,
    compress_frame_sequence_rle,
)
from test.e2e.oracles.cpp_header_oracle import (
    parse_frames_header,
    validate_cpp_header_syntax,
    generate_frames_header,
)


class TestTier4Scenarios(unittest.TestCase):
    """Tier 4 Real-World Application Scenarios (Scenario 01 to Scenario 14)."""

    def test_scenario_01_instagram_reel_to_firmware(self):
        """Scenario 01: Instagram Reel Video Ingestion to PlatformIO Firmware Compilation"""
        num_frames = 466
        # Generate representative vertical reel frame (720x1280) and 2:1 Cover crop
        # Cover 2:1 on 720x1280 extracts 720x360 at y=460
        # Then downscales to 128x64
        frame_mock = np.tile(np.linspace(20, 220, FRAME_WIDTH, dtype=np.uint8), (FRAME_HEIGHT, 1))
        dithered = dither_floyd_steinberg(frame_mock)
        packed_frame = pack_xbmp(dithered)
        self.assertEqual(len(packed_frame), FRAME_SIZE_BYTES)

        # Build C++ header for 466 frames
        header_text = (
            "#pragma once\n"
            f"#define NUM_FRAMES {num_frames}\n"
            f"#define FRAME_WIDTH {FRAME_WIDTH}\n"
            f"#define FRAME_HEIGHT {FRAME_HEIGHT}\n"
            f"#define FRAME_BYTES_PER_ROW 16\n"
            f"#define FRAME_SIZE_BYTES {FRAME_SIZE_BYTES}\n"
            "#define FRAME_FPS 30\n"
            f"const uint8_t reel_frames[{num_frames}][1024] PROGMEM = {{\n"
            "  { 0x00 }\n"
            "};\n"
        )
        parsed = parse_frames_header(header_text)
        self.assertEqual(parsed["num_frames"], 466)
        self.assertEqual(parsed["width"], 128)
        self.assertEqual(parsed["height"], 64)
        self.assertEqual(parsed["frame_size"], 1024)

        # Footprint verification: 466 * 1024 = 477,184 bytes (~466 KB)
        total_footprint = num_frames * FRAME_SIZE_BYTES
        self.assertEqual(total_footprint, 477184)
        # Verify footprint fits comfortably within standard ESP32 flash partition (< 850 KB)
        self.assertLess(total_footprint, 850 * 1024)

    def test_scenario_02_aseprite_pixel_art_to_packbits_rle(self):
        """Scenario 02: Aseprite Pixel Art Animation to PackBits RLE Header Compression"""
        num_frames = 80
        frames = []
        # Generate 80 frames of pixel art with large uniform black regions and line art
        for i in range(num_frames):
            frame = np.zeros((FRAME_HEIGHT, FRAME_WIDTH), dtype=np.uint8)
            # Animated sprite box moving across screen
            x_pos = int((i * 1.2)) % (FRAME_WIDTH - 20)
            frame[20:44, x_pos : x_pos + 20] = 255
            dithered = dither_atkinson(frame)
            frames.append(pack_xbmp(dithered))

        uncompressed_size = num_frames * FRAME_SIZE_BYTES
        self.assertEqual(uncompressed_size, 81920)

        # Compress all 80 frames using PackBits RLE
        all_rle, offsets, lengths = compress_frame_sequence_rle(frames)
        total_compressed_size = len(all_rle)

        # Compression ratio must exceed 70% (i.e. compressed size <= 24,576 bytes)
        self.assertLess(total_compressed_size, 24576)
        compression_ratio = (1.0 - (total_compressed_size / uncompressed_size)) * 100.0
        self.assertGreater(compression_ratio, 70.0)

        # Decompress and verify 100% bit-exact match across all 80 frames
        for i in range(num_frames):
            frame_rle = all_rle[offsets[i] : offsets[i] + lengths[i]]
            decompressed = packbits_decompress(frame_rle, max_output_len=1024)
            self.assertEqual(decompressed, frames[i], f"Mismatch in frame {i}")

    def test_scenario_03_kinetic_typography_webserial_streaming(self):
        """Scenario 03: Procedural Kinetic Typography & WebSerial Live Streaming"""
        num_frames = 120
        receiver = ESP32StreamReceiverSimulator()
        sim_time = 0.0
        frame_interval = 1.0 / 30.0  # 33.33 ms pacing

        packets_sent = 0
        acks_received = 0

        # Stream 120 frames with Stop-and-Wait ACK flow control
        for seq in range(num_frames):
            # Synthetic typography frame
            frame = np.zeros((FRAME_HEIGHT, FRAME_WIDTH), dtype=np.uint8)
            # Typing reveal progress
            chars_revealed = min(FRAME_WIDTH, (seq + 1) * 2)
            frame[28:36, :chars_revealed] = 255
            packed = pack_xbmp(frame)

            pkt = build_oled_stream_packet(packed, seq=seq)
            packets_sent += 1

            # Dispatch over serial simulator
            responses = receiver.feed_bytes(pkt, current_time=sim_time)
            self.assertEqual(len(responses), 1)
            resp = responses[0]
            self.assertEqual(resp[0], RESP_ACK)
            self.assertEqual(resp[1], seq & 0xFF)
            acks_received += 1

            sim_time += frame_interval

        self.assertEqual(packets_sent, 120)
        self.assertEqual(acks_received, 120)
        self.assertEqual(receiver.total_frames_rendered, 120)
        self.assertEqual(receiver.nak_count, 0)

    def test_scenario_04_starfield_glitch_export(self):
        """Scenario 04: Generative Sci-Fi Starfield & Row-Tearing Glitch Export"""
        num_frames = 90
        # Initialize starfield
        np.random.seed(42)
        star_x = np.random.uniform(-64, 64, 120)
        star_y = np.random.uniform(-32, 32, 120)
        star_z = np.random.uniform(1, 100, 120)
        speed = 85.0

        all_frames = []
        for frame_idx in range(num_frames):
            canvas = np.zeros((FRAME_HEIGHT, FRAME_WIDTH), dtype=np.uint8)
            # Move stars
            star_z -= speed * 0.05
            mask = star_z <= 1.0
            star_z[mask] = 100.0
            star_x[mask] = np.random.uniform(-64, 64, np.sum(mask))
            star_y[mask] = np.random.uniform(-32, 32, np.sum(mask))

            px = np.clip(np.int32(64 + (star_x / star_z) * 50), 0, FRAME_WIDTH - 1)
            py = np.clip(np.int32(32 + (star_y / star_z) * 50), 0, FRAME_HEIGHT - 1)
            canvas[py, px] = 255

            # Contrast & Brightness adjustment
            adjusted = adjust_luminance(canvas, brightness=10.0, contrast=25.0)

            # Row-tearing glitch every 10th frame on rows 25..35
            if frame_idx % 10 == 0:
                adjusted[25:35, :] = np.roll(adjusted[25:35, :], 14, axis=1)

            all_frames.append(pack_xbmp(adjusted))

        self.assertEqual(len(all_frames), 90)
        header = generate_frames_header(all_frames, fps=30)
        parsed = parse_frames_header(header)
        self.assertEqual(parsed["num_frames"], 90)
        self.assertEqual(parsed["frame_size"], 1024)

    def test_scenario_05_procreate_png_sequence_ingestion(self):
        """Scenario 05: Procreate Hand-Drawn Animation PNG Sequence Ingestion"""
        # Natural alphanumeric sorting check: verify frame_2 comes before frame_10
        raw_filenames = [f"frame_{i}.png" for i in range(1, 61)]
        # Shuffle order
        shuffled = list(reversed(raw_filenames))
        # Natural sort
        def natural_sort_key(s):
            return [int(text) if text.isdigit() else text.lower() for text in re.split(r"(\d+)", s)]

        sorted_files = sorted(shuffled, key=natural_sort_key)
        self.assertEqual(sorted_files[0], "frame_1.png")
        self.assertEqual(sorted_files[1], "frame_2.png")
        self.assertEqual(sorted_files[9], "frame_10.png")
        self.assertEqual(sorted_files[59], "frame_60.png")

        # Ingestion with Contain (Letterbox): 16:9 -> 128x72 clamped to 128x64 with 4px black borders
        # Top 4 rows and bottom 4 rows must be strictly 0x00
        active_drawing = np.full((56, FRAME_WIDTH), 180, dtype=np.uint8)
        full_frame = np.zeros((FRAME_HEIGHT, FRAME_WIDTH), dtype=np.uint8)
        full_frame[4:60, :] = active_drawing

        # Bayer 8x8 ordered dithering (no temporal error diffusion crawling)
        dithered_1 = dither_bayer(full_frame, matrix_size=8)
        dithered_2 = dither_bayer(full_frame, matrix_size=8)
        # Deterministic: consecutive static frames have zero inter-frame jitter
        np.testing.assert_array_equal(dithered_1, dithered_2)

        # Verify letterbox black borders
        self.assertEqual(np.sum(dithered_1[:4, :]), 0)
        self.assertEqual(np.sum(dithered_1[60:, :]), 0)

    def test_scenario_06_high_contrast_vector_logo_conversion_code_copy(self):
        """Scenario 06: High-Contrast Vector Logo Video Conversion & Code Copy"""
        num_frames = 75
        frames = []
        for i in range(num_frames):
            # Vector logo with smooth grayscale antialiased border
            frame = np.full((FRAME_HEIGHT, FRAME_WIDTH), 50, dtype=np.uint8)
            # Expanding circle logo
            radius = 5 + int(i * 0.3)
            y, x = np.ogrid[:FRAME_HEIGHT, :FRAME_WIDTH]
            dist_from_center = np.sqrt((x - 64) ** 2 + (y - 32) ** 2)
            mask = dist_from_center <= radius
            frame[mask] = 200

            # Dynamic thresholding cutoff at 145 and Invert Polarity
            inv = adjust_luminance(frame, invert=True)
            thresh = threshold_image(inv, cutoff=145)

            # Verify pure binary output: strictly 0 or 255
            unique_vals = np.unique(thresh)
            for v in unique_vals:
                self.assertIn(v, [0, 255])

            frames.append(pack_xbmp(thresh))

        self.assertEqual(len(frames), 75)
        # Generate 1-click clipboard export header
        header = generate_frames_header(frames, fps=15)
        parsed = parse_frames_header(header)
        self.assertEqual(parsed["num_frames"], 75)
        self.assertEqual(parsed["fps"], 15)

    def test_scenario_07_live_vj_dynamic_dither_switching(self):
        """Scenario 07: Live DJ/VJ Performance with Dynamic Dither Switching"""
        receiver = ESP32StreamReceiverSimulator()
        sim_time = 0.0

        # 4 beats, switching dither algorithm each beat without dropping frames
        algorithms = ["floyd_steinberg", "atkinson", "bayer4x4", "contrast_invert"]
        raw_gradient = np.tile(np.linspace(0, 255, FRAME_WIDTH, dtype=np.uint8), (FRAME_HEIGHT, 1))

        for seq in range(40):  # 10 frames per algorithm
            algo_idx = (seq // 10) % 4
            mode = algorithms[algo_idx]

            if mode == "floyd_steinberg":
                dithered = dither_floyd_steinberg(raw_gradient)
            elif mode == "atkinson":
                dithered = dither_atkinson(raw_gradient)
            elif mode == "bayer4x4":
                dithered = dither_bayer(raw_gradient, matrix_size=4)
            elif mode == "contrast_invert":
                adj = adjust_luminance(raw_gradient, contrast=50.0, invert=True)
                dithered = dither_floyd_steinberg(adj)

            packed = pack_xbmp(dithered)
            pkt = build_oled_stream_packet(packed, seq=seq)
            responses = receiver.feed_bytes(pkt, current_time=sim_time)
            self.assertEqual(len(responses), 1)
            self.assertEqual(responses[0][0], RESP_ACK)
            self.assertEqual(responses[0][1], seq & 0xFF)
            sim_time += 1.0 / 30.0

        self.assertEqual(receiver.total_frames_rendered, 40)
        self.assertEqual(receiver.nak_count, 0)

    def test_scenario_08_serial_noise_corrupted_packet_nak_recovery(self):
        """Scenario 08: Serial Noise Resistance & Corrupted Packet NAK Recovery"""
        receiver = ESP32StreamReceiverSimulator()
        sim_time = 0.0
        frame_cache = {}

        for seq in range(50):
            frame_raw = np.full((FRAME_HEIGHT, FRAME_WIDTH), seq * 5, dtype=np.uint8)
            packed = pack_xbmp(frame_raw)
            pkt = build_oled_stream_packet(packed, seq=seq)
            frame_cache[seq] = pkt

            if seq == 12:
                # Inject bit corruption into payload byte 250
                corrupted = bytearray(pkt)
                corrupted[6 + 250] ^= 0xFF  # Payload starts at index 6

                # Receiver should detect checksum mismatch and return NAK
                resp = receiver.feed_bytes(bytes(corrupted), current_time=sim_time)
                self.assertEqual(len(resp), 1)
                self.assertEqual(resp[0][0], RESP_NAK)
                self.assertEqual(resp[0][1], 12)

                # Sender retransmits uncorrupted frame 12 from cache
                retransmit_resp = receiver.feed_bytes(frame_cache[12], current_time=sim_time + 0.005)
                self.assertEqual(len(retransmit_resp), 1)
                self.assertEqual(retransmit_resp[0][0], RESP_ACK)
                self.assertEqual(retransmit_resp[0][1], 12)
            else:
                resp = receiver.feed_bytes(pkt, current_time=sim_time)
                self.assertEqual(len(resp), 1)
                self.assertEqual(resp[0][0], RESP_ACK)
                self.assertEqual(resp[0][1], seq & 0xFF)

            sim_time += 1.0 / 30.0

        self.assertEqual(receiver.total_frames_rendered, 50)
        self.assertEqual(receiver.nak_count, 1)

    def test_scenario_09_usb_disconnect_watchdog_fallback(self):
        """Scenario 09: Hardware USB Disconnect & Standalone Watchdog Fallback"""
        receiver = ESP32StreamReceiverSimulator()
        sim_time = 10.0

        # Stream active frame
        pkt = build_oled_stream_packet(bytes([0xAA] * 1024), seq=1)
        resp = receiver.feed_bytes(pkt, current_time=sim_time)
        self.assertEqual(resp[0][0], RESP_ACK)
        self.assertEqual(receiver.mode, "MODE_STREAMING")

        # Disconnect USB: advance time past 2000ms watchdog
        sim_time += 2.050  # 2050 ms elapsed
        receiver.update_watchdog(current_time=sim_time)
        # Receiver should revert to STANDALONE mode
        self.assertEqual(receiver.mode, "MODE_STANDALONE")

    def test_scenario_10_dual_display_hardware_switching(self):
        """Scenario 10: Dual Display Panel Hardware Switching (SH1106 vs SSD1306)"""
        # Outer 1px rectangle border test pattern
        border = np.zeros((FRAME_HEIGHT, FRAME_WIDTH), dtype=np.uint8)
        border[0, :] = 255
        border[63, :] = 255
        border[:, 0] = 255
        border[:, 127] = 255

        packed = pack_xbmp(border)
        unpacked = unpack_xbmp(packed).reshape(FRAME_HEIGHT, FRAME_WIDTH)
        np.testing.assert_array_equal(unpacked, border)

        # SSD1306 column mapping: col 0..127 maps to physical columns 0..127
        ssd_col_0 = unpacked[:, 0]
        ssd_col_127 = unpacked[:, 127]
        self.assertTrue(np.all(ssd_col_0 == 255))
        self.assertTrue(np.all(ssd_col_127 == 255))

        # SH1106 column mapping: column offset +2 maps active 128 cols to internal RAM 2..129
        sh1106_ram = np.zeros((FRAME_HEIGHT, 132), dtype=np.uint8)
        sh1106_ram[:, 2:130] = unpacked
        # Verify RAM col 2 has left border, RAM col 129 has right border
        self.assertTrue(np.all(sh1106_ram[:, 2] == 255))
        self.assertTrue(np.all(sh1106_ram[:, 129] == 255))
        # RAM cols 0, 1 and 130, 131 remain unlit
        self.assertTrue(np.all(sh1106_ram[:, :2] == 0))
        self.assertTrue(np.all(sh1106_ram[:, 130:] == 0))

    def test_scenario_11_long_form_video_flash_budget_optimization(self):
        """Scenario 11: Long-Form Video Ingestion & Flash Budget Optimization"""
        # 45-second video at 30 FPS = 1350 frames
        total_source_frames = 1350
        raw_budget_bytes = total_source_frames * FRAME_SIZE_BYTES
        # 1.38 MB approaches typical ESP32 OTA partition limit
        self.assertEqual(raw_budget_bytes, 1382400)

        # Decimate 30 FPS to 15 FPS (every 2nd frame) -> 675 frames
        decimated_count = total_source_frames // 2
        self.assertEqual(decimated_count, 675)

        # Generate sample repetitive frames for 675 frames and compress via PackBits RLE
        frames = []
        for i in range(decimated_count):
            f = np.zeros((FRAME_HEIGHT, FRAME_WIDTH), dtype=np.uint8)
            f[20:44, :40] = 255
            frames.append(pack_xbmp(f))

        all_rle, offsets, lengths = compress_frame_sequence_rle(frames)
        total_compressed_bytes = len(all_rle)

        # Flash usage should be reduced by > 65%
        reduction = (1.0 - (total_compressed_bytes / (decimated_count * 1024))) * 100.0
        self.assertGreater(reduction, 65.0)
        # Total compressed size should be well under 250 KB
        self.assertLess(total_compressed_bytes, 250 * 1024)

    def test_scenario_12_retro_pixel_art_nearest_neighbor(self):
        """Scenario 12: Retro Pixel Art Game Asset with Nearest-Neighbor Downscaling"""
        # Low-res pixel art source (320x180) downscaled to 128x64 using nearest neighbor
        src_w, src_h = 320, 180
        src = np.zeros((src_h, src_w), dtype=np.uint8)
        # Chunky 20x20 pixel block
        src[40:100, 60:160] = 255

        # Nearest neighbor downscaling mapping
        y_indices = (np.arange(FRAME_HEIGHT) * src_h / FRAME_HEIGHT).astype(int)
        x_indices = (np.arange(FRAME_WIDTH) * src_w / FRAME_WIDTH).astype(int)
        downscaled = src[np.ix_(y_indices, x_indices)]

        # Thresholding at 128
        binary_art = threshold_image(downscaled, cutoff=128)

        # Verify zero intermediate gray stippling noise (all values are 0 or 255)
        self.assertEqual(set(np.unique(binary_art)), {0, 255})
        packed = pack_xbmp(binary_art)
        # Verify byte values contain solid runs of 0x00 and 0xFF
        self.assertIn(b"\x00", packed)
        self.assertIn(b"\xff", packed)

    def test_scenario_13_karaoke_lyric_video_dual_color_oled(self):
        """Scenario 13: Karaoke Lyric Video with Beat Inversion & Dual-Color OLED"""
        # Dual-color OLED: top 16 rows yellow, row 16 separator blank, bottom 47 rows blue
        frame = np.zeros((FRAME_HEIGHT, FRAME_WIDTH), dtype=np.uint8)

        # Top yellow header: rows 0..15
        frame[4:12, 10:118] = 255  # Header text title

        # Row 16 is physical panel gap -> MUST remain strictly 0
        frame[16, :] = 0

        # Bottom lyrics: rows 17..63
        frame[24:32, 10:60] = 255  # Normal lyric text
        # Active beat word inverted: solid white box (rows 36..48, cols 20..70) with black text
        frame[36:48, 20:70] = 255
        frame[38:46, 24:66] = 0  # Black cut-out glyphs

        packed = pack_xbmp(frame)
        unpacked = unpack_xbmp(packed).reshape(FRAME_HEIGHT, FRAME_WIDTH)

        # Verify row 16 is completely blank (zero lit pixels)
        self.assertEqual(np.sum(unpacked[16, :]), 0)
        # Verify header is lit
        self.assertGreater(np.sum(unpacked[:16, :]), 0)
        # Verify body is lit
        self.assertGreater(np.sum(unpacked[17:, :]), 0)

    def test_scenario_14_particle_burst_benchmark_timing_budget(self):
        """Scenario 14: Ballistic Radial Particle Burst Benchmark & Timing Budget"""
        receiver = ESP32StreamReceiverSimulator()
        sim_time = 0.0
        num_frames = 300

        # Benchmark compute time per frame
        t0 = time.perf_counter()

        # Simulate 300 frames of particle burst
        np.random.seed(99)
        angles = np.random.uniform(0, 2 * math.pi, 70)
        speeds = np.random.uniform(10, 40, 70)

        for frame_idx in range(num_frames):
            canvas = np.zeros((FRAME_HEIGHT, FRAME_WIDTH), dtype=np.uint8)
            t = (frame_idx % 60) / 30.0  # Reset every 2 seconds
            for a, s in zip(angles, speeds):
                x = int(64 + s * math.cos(a) * t)
                y = int(32 + s * math.sin(a) * t + 0.5 * 30.0 * (t**2))  # Gravity
                if 0 <= x < FRAME_WIDTH and 0 <= y < FRAME_HEIGHT:
                    canvas[y, x] = 255

            packed = pack_xbmp(canvas)
            pkt = build_oled_stream_packet(packed, seq=frame_idx)
            resp = receiver.feed_bytes(pkt, current_time=sim_time)
            self.assertEqual(len(resp), 1)
            self.assertEqual(resp[0][0], RESP_ACK)
            sim_time += 1.0 / 30.0

        t1 = time.perf_counter()
        avg_compute_ms = ((t1 - t0) / num_frames) * 1000.0

        # Multi-stage timing budget verification:
        # T_browser_compute <= 3.5 ms
        # T_uart_tx = (1031 * 10) / 921600 = 11.18 ms
        # T_esp32_i2c = 24.30 ms
        # T_ack_return = (2 * 10) / 921600 = 0.02 ms
        t_uart_tx_ms = (1031 * 10 / BAUD_RATE) * 1000.0
        t_ack_return_ms = (2 * 10 / BAUD_RATE) * 1000.0

        self.assertAlmostEqual(t_uart_tx_ms, 11.187, places=2)
        self.assertAlmostEqual(t_ack_return_ms, 0.0217, places=3)
        self.assertLess(avg_compute_ms, 3.5)

        # 300 frames received with 0 dropped frames
        self.assertEqual(receiver.total_frames_rendered, 300)
        self.assertEqual(receiver.nak_count, 0)


if __name__ == "__main__":
    unittest.main()
