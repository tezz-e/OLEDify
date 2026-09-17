"""
WebSerial OLED-Stream v1 Protocol Packet Builder & ESP32-S3 Receiver State Machine Simulator.
"""
import time
from dataclasses import dataclass
from typing import Optional, List, Tuple

SERIAL_MAGIC_0 = 0xAA
SERIAL_MAGIC_1 = 0x55

CMD_FRAME = 0x01
CMD_PING = 0x02
CMD_RESET = 0x03

RESP_ACK = 0x06
RESP_NAK = 0x15

MODE_STANDALONE = "MODE_STANDALONE"
MODE_STREAMING = "MODE_STREAMING"


def compute_xor_checksum(cmd: int, seq: int, len_l: int, len_h: int, payload: bytes) -> int:
    cs = cmd ^ seq ^ len_l ^ len_h
    for b in payload:
        cs ^= b
    return cs & 0xFF


def build_oled_stream_packet(payload: bytes, cmd: int = CMD_FRAME, seq: int = 0) -> bytes:
    """
    Builds a 1031-byte serialized binary packet for OLED-Stream v1:
    [0xAA, 0x55, CMD, SEQ, LEN_L, LEN_H, <payload>, CHECKSUM]
    """
    payload_len = len(payload)
    len_l = payload_len & 0xFF
    len_h = (payload_len >> 8) & 0xFF
    cs = compute_xor_checksum(cmd, seq, len_l, len_h, payload)

    packet = bytearray()
    packet.append(SERIAL_MAGIC_0)
    packet.append(SERIAL_MAGIC_1)
    packet.append(cmd & 0xFF)
    packet.append(seq & 0xFF)
    packet.append(len_l)
    packet.append(len_h)
    packet.extend(payload)
    packet.append(cs)
    return bytes(packet)


def verify_oled_packet_checksum(packet: bytes) -> bool:
    """Verifies XOR checksum of a complete serialized packet."""
    if len(packet) < 7:
        return False
    cmd = packet[2]
    seq = packet[3]
    len_l = packet[4]
    len_h = packet[5]
    payload_len = len_l | (len_h << 8)
    if len(packet) != 6 + payload_len + 1:
        return False
    payload = packet[6:6 + payload_len]
    expected_cs = packet[-1]
    calculated_cs = compute_xor_checksum(cmd, seq, len_l, len_h, payload)
    return expected_cs == calculated_cs


@dataclass
class OLEDStreamPacket:
    cmd: int
    seq: int
    payload: bytes
    checksum_valid: bool


class ESP32StreamReceiverSimulator:
    """
    In-memory state machine emulating ESP32-S3 OLED-Stream v1 receiver.
    Features:
    - 2KB RX buffer
    - Dual-mode: STANDALONE vs STREAMING
    - 2000ms stream inactivity watchdog
    - 100ms inter-byte timeout
    - Checksum validation & Stop-and-Wait ACK / NAK emission
    """
    STATE_MAGIC_0 = 0
    STATE_MAGIC_1 = 1
    STATE_CMD = 2
    STATE_SEQ = 3
    STATE_LEN_L = 4
    STATE_LEN_H = 5
    STATE_PAYLOAD = 6
    STATE_CHECKSUM = 7

    def __init__(self, rx_buffer_size: int = 2048):
        self.rx_buffer_size = rx_buffer_size
        self.state = self.STATE_MAGIC_0
        self.mode = MODE_STANDALONE

        # Parser fields
        self.curr_cmd = 0
        self.curr_seq = 0
        self.curr_len = 0
        self.payload_buf = bytearray()
        self.last_byte_time = time.time()
        self.last_valid_packet_time = 0.0

        # State output
        self.latest_frame: Optional[bytes] = None
        self.total_frames_rendered = 0
        self.nak_count = 0
        self.ack_count = 0
        self.dropped_bytes = 0
        self.tx_response_queue: List[bytes] = []

    def feed_bytes(self, data: bytes, current_time: Optional[float] = None) -> List[bytes]:
        """
        Feeds raw serial bytes to the receiver.
        Returns list of response byte sequences (e.g. [b'\x06\x01']).
        """
        if current_time is None:
            current_time = time.time()

        responses = []

        # Check inter-byte timeout (100ms)
        if self.state != self.STATE_MAGIC_0 and (current_time - self.last_byte_time > 0.100):
            self.state = self.STATE_MAGIC_0
            self.payload_buf.clear()

        self.last_byte_time = current_time

        # Check UART buffer saturation
        if len(data) > self.rx_buffer_size:
            # Buffer overrun in hardware UART
            self.dropped_bytes += (len(data) - self.rx_buffer_size)
            data = data[:self.rx_buffer_size]

        for b in data:
            if self.state == self.STATE_MAGIC_0:
                if b == SERIAL_MAGIC_0:
                    self.state = self.STATE_MAGIC_1
            elif self.state == self.STATE_MAGIC_1:
                if b == SERIAL_MAGIC_1:
                    self.state = self.STATE_CMD
                elif b == SERIAL_MAGIC_0:
                    self.state = self.STATE_MAGIC_1
                else:
                    self.state = self.STATE_MAGIC_0
            elif self.state == self.STATE_CMD:
                self.curr_cmd = b
                self.state = self.STATE_SEQ
            elif self.state == self.STATE_SEQ:
                self.curr_seq = b
                self.state = self.STATE_LEN_L
            elif self.state == self.STATE_LEN_L:
                self.curr_len = b
                self.state = self.STATE_LEN_H
            elif self.state == self.STATE_LEN_H:
                self.curr_len |= (b << 8)
                if self.curr_len > 1024 or self.curr_len < 0:
                    # Invalid length guard: length cannot exceed 1024 bytes
                    self.state = self.STATE_MAGIC_0
                    self.payload_buf.clear()
                else:
                    self.payload_buf.clear()
                    if self.curr_len == 0:
                        self.state = self.STATE_CHECKSUM
                    else:
                        self.state = self.STATE_PAYLOAD
            elif self.state == self.STATE_PAYLOAD:
                self.payload_buf.append(b)
                if len(self.payload_buf) == self.curr_len:
                    self.state = self.STATE_CHECKSUM
            elif self.state == self.STATE_CHECKSUM:
                received_cs = b
                expected_cs = compute_xor_checksum(
                    self.curr_cmd,
                    self.curr_seq,
                    self.curr_len & 0xFF,
                    (self.curr_len >> 8) & 0xFF,
                    self.payload_buf
                )
                if received_cs == expected_cs:
                    # Valid Packet
                    self.mode = MODE_STREAMING
                    self.last_valid_packet_time = current_time
                    self.ack_count += 1
                    resp = bytes([RESP_ACK, self.curr_seq])
                    responses.append(resp)
                    self.tx_response_queue.append(resp)

                    if self.curr_cmd == CMD_FRAME:
                        self.latest_frame = bytes(self.payload_buf)
                        self.total_frames_rendered += 1
                else:
                    # Corrupted Checksum -> Emit NAK
                    self.nak_count += 1
                    resp = bytes([RESP_NAK, self.curr_seq])
                    responses.append(resp)
                    self.tx_response_queue.append(resp)

                # Reset parser to magic search
                self.state = self.STATE_MAGIC_0
                self.payload_buf.clear()

        return responses

    def update_watchdog(self, current_time: Optional[float] = None) -> str:
        """
        Evaluates 2000ms stream inactivity watchdog.
        Returns active mode: MODE_STREAMING or MODE_STANDALONE.
        """
        if current_time is None:
            current_time = time.time()
        if self.mode == MODE_STREAMING:
            if current_time - self.last_valid_packet_time > 2.0:
                self.mode = MODE_STANDALONE
        return self.mode
