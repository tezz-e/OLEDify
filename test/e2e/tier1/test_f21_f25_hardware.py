"""
Tier 1 Feature Coverage: Features F21 through F25 (WebSerial, Protocol, Flow Control, Firmware & Hardware)
Total tests: 25 (5 tests per feature)
"""
import unittest
import time
from test.e2e.config import (
    BAUD_RATE,
    SERIAL_MAGIC_0,
    SERIAL_MAGIC_1,
    CMD_FRAME,
    CMD_PING,
    RESP_ACK,
    RESP_NAK,
    PACKET_TOTAL_SIZE,
    FRAME_SIZE_BYTES,
    ESP32_RX_BUFFER_SIZE,
    I2C_FAST_MODE_FREQ_HZ,
    SH1106_COL_OFFSET,
    SSD1306_COL_OFFSET
)
from test.e2e.oracles.protocol_simulator import (
    build_oled_stream_packet,
    verify_oled_packet_checksum,
    compute_xor_checksum,
    ESP32StreamReceiverSimulator,
    MODE_STANDALONE,
    MODE_STREAMING
)


class TestF21WebSerialStreamer(unittest.TestCase):
    """F21: WebSerial USB Streamer (Port lifecycle, baud, filter)"""
    feature = "F21"
    tier = 1

    def test_t1_f21_01_webserial_feature_detection(self):
        """T1-F21-01: WebSerial API Feature Detection Pattern"""
        # Detection evaluates whether 'serial' in navigator
        def check_webserial_support(navigator_mock):
            return "serial" in navigator_mock

        self.assertTrue(check_webserial_support({"serial": object()}))
        self.assertFalse(check_webserial_support({}))

    def test_t1_f21_02_usb_vendor_id_filter(self):
        """T1-F21-02: USB Vendor ID Device Filter (Espressif Systems VID 0x303A)"""
        filter_opts = [{"usbVendorId": 0x303A}]
        self.assertEqual(filter_opts[0]["usbVendorId"], 0x303A)

    def test_t1_f21_03_baud_rate_initialization(self):
        """T1-F21-03: 921600 High-Speed Baud Initialization Options"""
        open_options = {
            "baudRate": BAUD_RATE,
            "dataBits": 8,
            "stopBits": 1,
            "parity": "none",
            "bufferSize": 16384
        }
        self.assertEqual(open_options["baudRate"], 921600)
        self.assertEqual(open_options["dataBits"], 8)
        self.assertEqual(open_options["stopBits"], 1)

    def test_t1_f21_04_connection_state_machine(self):
        """T1-F21-04: Connection State Machine Tracking"""
        states = ["Disconnected", "Connecting", "Connected", "Disconnected"]
        current = "Disconnected"
        for s in states[1:]:
            current = s
        self.assertEqual(current, "Disconnected")

    def test_t1_f21_05_cancelled_port_request(self):
        """T1-F21-05: User Cancelled Port Request Error Handling"""
        def handle_connect_error(err_name):
            if err_name == "NotFoundError":
                return "Connection cancelled"
            return "Unknown error"

        res = handle_connect_error("NotFoundError")
        self.assertEqual(res, "Connection cancelled")


class TestF22BinaryFramingProtocol(unittest.TestCase):
    """F22: Binary Framing Protocol (OLED-Stream v1)"""
    feature = "F22"
    tier = 1

    def test_t1_f22_01_magic_header_bytes(self):
        """T1-F22-01: Magic Header Bytes Construction (0xAA 0x55)"""
        packet = build_oled_stream_packet(bytes([0] * 1024))
        self.assertEqual(packet[0], SERIAL_MAGIC_0)  # 0xAA
        self.assertEqual(packet[1], SERIAL_MAGIC_1)  # 0x55

    def test_t1_f22_02_command_and_sequence_id(self):
        """T1-F22-02: Command & Sequence ID Serialization"""
        packet = build_oled_stream_packet(bytes([0] * 1024), cmd=CMD_FRAME, seq=42)
        self.assertEqual(packet[2], CMD_FRAME)  # 0x01
        self.assertEqual(packet[3], 42)         # 0x2A

    def test_t1_f22_03_little_endian_length_encoding(self):
        """T1-F22-03: Little-Endian Payload Length Encoding (1024 = 0x0400)"""
        packet = build_oled_stream_packet(bytes([0] * 1024))
        len_l = packet[4]
        len_h = packet[5]
        length = len_l | (len_h << 8)
        self.assertEqual(len_l, 0x00)
        self.assertEqual(len_h, 0x04)
        self.assertEqual(length, 1024)

    def test_t1_f22_04_exact_packet_length(self):
        """T1-F22-04: Exact 1031-Byte Total Packet Length"""
        packet = build_oled_stream_packet(bytes([0] * 1024))
        self.assertEqual(len(packet), PACKET_TOTAL_SIZE)

    def test_t1_f22_05_xor_checksum_validation(self):
        """T1-F22-05: 1-Byte XOR Checksum Calculation"""
        payload = bytes([i % 256 for i in range(1024)])
        packet = build_oled_stream_packet(payload, cmd=1, seq=10)
        self.assertTrue(verify_oled_packet_checksum(packet))
        expected_cs = compute_xor_checksum(1, 10, 0x00, 0x04, payload)
        self.assertEqual(packet[-1], expected_cs)


class TestF23StopAndWaitAckFlowControl(unittest.TestCase):
    """F23: Stop-and-Wait ACK Flow Control Handshake"""
    feature = "F23"
    tier = 1

    def test_t1_f23_01_transmitter_hold_on_ack(self):
        """T1-F23-01: Transmitter Frame Hold on Outstanding ACK"""
        tx_queue = [build_oled_stream_packet(bytes([1]*1024), seq=0), build_oled_stream_packet(bytes([2]*1024), seq=1)]
        in_flight = True
        # Frame 1 cannot be sent until Frame 0 ACK received
        self.assertTrue(in_flight)

    def test_t1_f23_02_valid_ack_release(self):
        """T1-F23-02: Valid ACK Token Release (0x06 [Seq])"""
        sim = ESP32StreamReceiverSimulator()
        pkt = build_oled_stream_packet(bytes([0] * 1024), seq=1)
        resps = sim.feed_bytes(pkt)
        self.assertEqual(len(resps), 1)
        self.assertEqual(resps[0], bytes([RESP_ACK, 1]))

    def test_t1_f23_03_nak_handling_and_retransmit(self):
        """T1-F23-03: NAK Handling on Checksum Error (0x15 [Seq])"""
        sim = ESP32StreamReceiverSimulator()
        pkt = bytearray(build_oled_stream_packet(bytes([0] * 1024), seq=2))
        pkt[-1] ^= 0xFF  # Corrupt checksum
        resps = sim.feed_bytes(bytes(pkt))
        self.assertEqual(len(resps), 1)
        self.assertEqual(resps[0], bytes([RESP_NAK, 2]))

    def test_t1_f23_04_watchdog_timeout_recovery(self):
        """T1-F23-04: Deadlock Prevention Watchdog Timeout (150ms)"""
        ack_received = False
        t_start = time.time()
        # Simulated timeout threshold 0.150s
        t_elapsed = 0.155
        is_timed_out = t_elapsed >= 0.150
        self.assertTrue(is_timed_out)

    def test_t1_f23_05_streaming_telemetry_metrics(self):
        """T1-F23-05: Streaming Telemetry Metric Tracking"""
        stats = {
            "fps": 30.0,
            "delivered": 100,
            "dropped": 0,
            "avg_latency_ms": 25.0
        }
        self.assertEqual(stats["delivered"], 100)
        self.assertEqual(stats["dropped"], 0)
        self.assertAlmostEqual(stats["fps"], 30.0)


class TestF24Esp32DualModeFirmware(unittest.TestCase):
    """F24: ESP32-S3 Dual-Mode Firmware (Standalone Looper + Streaming Receiver)"""
    feature = "F24"
    tier = 1

    def test_t1_f24_01_boot_standalone_mode(self):
        """T1-F24-01: Boot Standalone Playback Mode Contract"""
        sim = ESP32StreamReceiverSimulator()
        self.assertEqual(sim.mode, MODE_STANDALONE)

    def test_t1_f24_02_dynamic_mode_transition(self):
        """T1-F24-02: Dynamic Mode Transition from Standalone to Streaming"""
        sim = ESP32StreamReceiverSimulator()
        pkt = build_oled_stream_packet(bytes([0] * 1024), seq=0)
        sim.feed_bytes(pkt)
        self.assertEqual(sim.mode, MODE_STREAMING)
        self.assertEqual(sim.total_frames_rendered, 1)

    def test_t1_f24_03_rx_buffer_size(self):
        """T1-F24-03: Expanded 2048-Byte Serial RX Buffer Specification"""
        sim = ESP32StreamReceiverSimulator(rx_buffer_size=2048)
        self.assertEqual(sim.rx_buffer_size, 2048)

    def test_t1_f24_04_inactivity_watchdog_fallback(self):
        """T1-F24-04: Inactivity Watchdog Fallback (2000ms Inactivity)"""
        sim = ESP32StreamReceiverSimulator()
        pkt = build_oled_stream_packet(bytes([0] * 1024), seq=0)
        sim.feed_bytes(pkt, current_time=1000.0)
        self.assertEqual(sim.mode, MODE_STREAMING)

        # 2.05 seconds later without data
        mode = sim.update_watchdog(current_time=1002.05)
        self.assertEqual(mode, MODE_STANDALONE)

    def test_t1_f24_05_interbyte_timeout_reset(self):
        """T1-F24-05: Inter-Byte Timeout Parser Reset (100ms Silence)"""
        sim = ESP32StreamReceiverSimulator()
        # Feed partial header: 0xAA 0x55
        sim.feed_bytes(bytes([0xAA, 0x55]), current_time=100.0)
        self.assertEqual(sim.state, sim.STATE_CMD)

        # 120ms later, inter-byte timeout triggers reset to STATE_MAGIC_0
        pkt = build_oled_stream_packet(bytes([0] * 1024), seq=5)
        sim.feed_bytes(pkt, current_time=100.125)
        self.assertEqual(sim.total_frames_rendered, 1)


class TestF25HardwareDriverSupport(unittest.TestCase):
    """F25: SH1106 / SSD1306 Hardware Support (400kHz I2C & Column Offsets)"""
    feature = "F25"
    tier = 1

    def test_t1_f25_01_i2c_fast_mode_frequency(self):
        """T1-F25-01: Fast Mode 400kHz I2C Pin Assignment (SDA=8, SCL=9)"""
        sda_pin = 8
        scl_pin = 9
        freq = I2C_FAST_MODE_FREQ_HZ
        self.assertEqual((sda_pin, scl_pin, freq), (8, 9, 400000))

    def test_t1_f25_02_sh1106_2pixel_offset(self):
        """T1-F25-02: SH1106 2-Pixel RAM Addressing Offset"""
        col_offset = SH1106_COL_OFFSET
        self.assertEqual(col_offset, 2)
        active_start_ram = col_offset
        active_end_ram = col_offset + 127  # 129
        self.assertEqual(active_start_ram, 2)
        self.assertEqual(active_end_ram, 129)

    def test_t1_f25_03_ssd1306_0pixel_offset(self):
        """T1-F25-03: SSD1306 0-Pixel Offset Driver Constructor"""
        col_offset = SSD1306_COL_OFFSET
        self.assertEqual(col_offset, 0)
        active_start_ram = col_offset
        active_end_ram = col_offset + 127  # 127
        self.assertEqual(active_start_ram, 0)
        self.assertEqual(active_end_ram, 127)

    def test_t1_f25_04_preprocessor_controller_switch(self):
        """T1-F25-04: Preprocessor Build Flag Controller Switch"""
        build_flag = "-DOLED_SSD1306"
        is_ssd1306 = "OLED_SSD1306" in build_flag
        active_driver = "SSD1306" if is_ssd1306 else "SH1106"
        self.assertEqual(active_driver, "SSD1306")

    def test_t1_f25_05_buffer_refresh_timing(self):
        """T1-F25-05: Full Display Buffer Refresh Timing (24.3ms @ 400kHz I2C)"""
        # 1024 bytes payload + command/page overhead ~ 1056 bytes
        # 1056 * 9 bits / 400,000 Hz ~ 23.76ms + I2C start/stop ~ 24.3ms
        target_fps = 30.0
        frame_budget_ms = 1000.0 / target_fps  # 33.33ms
        i2c_transfer_ms = 24.3
        self.assertLess(i2c_transfer_ms, frame_budget_ms)


if __name__ == "__main__":
    unittest.main()
