"""
E2E Test Configuration & Constants
OLED Visual Animation Engine & Converter
"""
import os
from pathlib import Path

# Paths
E2E_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = E2E_DIR.parent.parent
SRC_DIR = PROJECT_ROOT / "src"
WEB_DIR = PROJECT_ROOT / "web"
FIXTURES_DIR = E2E_DIR / "fixtures"
SAMPLE_MEDIA_DIR = FIXTURES_DIR / "sample_media"

# Display Geometry
FRAME_WIDTH = 128
FRAME_HEIGHT = 64
FRAME_PIXELS = FRAME_WIDTH * FRAME_HEIGHT  # 8192
FRAME_BYTES_PER_ROW = FRAME_WIDTH // 8     # 16
FRAME_SIZE_BYTES = FRAME_BYTES_PER_ROW * FRAME_HEIGHT  # 1024

# Framerate Boundaries
MIN_FPS = 15
MAX_FPS = 30
DEFAULT_FPS = 30

# WebSerial Framing Protocol (OLED-Stream v1)
BAUD_RATE = 921600
SERIAL_MAGIC_0 = 0xAA
SERIAL_MAGIC_1 = 0x55

CMD_FRAME = 0x01
CMD_PING = 0x02
CMD_RESET = 0x03

RESP_ACK = 0x06
RESP_NAK = 0x15

# Packet structure offsets
OFFSET_MAGIC_0 = 0
OFFSET_MAGIC_1 = 1
OFFSET_CMD = 2
OFFSET_SEQ = 3
OFFSET_LEN_L = 4
OFFSET_LEN_H = 5
OFFSET_PAYLOAD = 6
PACKET_TOTAL_SIZE = 1031  # 2 magic + 1 cmd + 1 seq + 2 len + 1024 payload + 1 checksum

# Timeouts (ms)
INTER_BYTE_TIMEOUT_MS = 100
ACK_TIMEOUT_MS = 150
WATCHDOG_TIMEOUT_MS = 2000

# Hardware & Driver Specs
ESP32_RX_BUFFER_SIZE = 2048
I2C_FAST_MODE_FREQ_HZ = 400000
I2C_FRAME_TRANSFER_MS = 24.3
SH1106_COL_OFFSET = 2
SSD1306_COL_OFFSET = 0

# Color Themes
THEMES = {
    "Classic Cyan": {"lit": (0, 240, 255), "unlit": (10, 14, 20), "hex": "#00f0ff"},
    "Crisp White": {"lit": (255, 255, 255), "unlit": (10, 14, 20), "hex": "#ffffff"},
    "Amber": {"lit": (255, 176, 0), "unlit": (15, 10, 0), "hex": "#ffb000"},
    "Matrix Green": {"lit": (0, 255, 102), "unlit": (5, 18, 10), "hex": "#00ff66"},
    "Yellow/Blue": {
        "header_lit": (255, 204, 0),    # Rows 0-15
        "separator": (0, 0, 0),          # Row 16
        "body_lit": (0, 229, 255),       # Rows 17-63
        "unlit": (10, 14, 20)
    }
}
