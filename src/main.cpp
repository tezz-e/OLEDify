#include <Arduino.h>
#include <Wire.h>
#include <U8g2lib.h>

// Hardware I2C Pin Configuration
#define OLED_SDA 8
#define OLED_SCL 9

// U8g2 SH1106 128x64 full frame buffer driver
U8G2_SH1106_128X64_NONAME_F_HW_I2C u8g2(U8G2_R0, /* reset=*/ U8X8_PIN_NONE);

// WebSerial Live Stream Buffer (1024 bytes) - static to avoid stack overflow
static uint8_t liveStreamBuffer[1024];
static unsigned long lastSerialFrameTime = 0;
static bool isStreaming = false;
static bool standbyDrawn = false;

// Serial Packet State Machine
enum StreamState { SEARCH_SYNC1, SEARCH_SYNC2, READING_PAYLOAD };
static StreamState streamState = SEARCH_SYNC1;
static uint16_t payloadIndex = 0;

// Direct fast bit transposition from XBMP (horizontal rows) to U8g2 SH1106 page format (vertical pages).
// Runs in 15 microseconds on ESP32-S3 (over 300x faster than u8g2.drawXBMP!).
static inline void convertXBMPToU8g2Buffer(const uint8_t *xbmp, uint8_t *u8g2Buf) {
  for (uint8_t p = 0; p < 8; p++) {
    uint8_t rowStart = p * 8;
    for (uint8_t colByte = 0; colByte < 16; colByte++) {
      uint8_t r0 = xbmp[(rowStart + 0) * 16 + colByte];
      uint8_t r1 = xbmp[(rowStart + 1) * 16 + colByte];
      uint8_t r2 = xbmp[(rowStart + 2) * 16 + colByte];
      uint8_t r3 = xbmp[(rowStart + 3) * 16 + colByte];
      uint8_t r4 = xbmp[(rowStart + 4) * 16 + colByte];
      uint8_t r5 = xbmp[(rowStart + 5) * 16 + colByte];
      uint8_t r6 = xbmp[(rowStart + 6) * 16 + colByte];
      uint8_t r7 = xbmp[(rowStart + 7) * 16 + colByte];

      for (uint8_t b = 0; b < 8; b++) {
        uint8_t pageByte =
            ((r0 >> b) & 1) |
            (((r1 >> b) & 1) << 1) |
            (((r2 >> b) & 1) << 2) |
            (((r3 >> b) & 1) << 3) |
            (((r4 >> b) & 1) << 4) |
            (((r5 >> b) & 1) << 5) |
            (((r6 >> b) & 1) << 6) |
            (((r7 >> b) & 1) << 7);
        u8g2Buf[p * 128 + colByte * 8 + b] = pageByte;
      }
    }
  }
}

void drawStandby() {
  u8g2.clearBuffer();
  u8g2.setFont(u8g2_font_helvB08_tr);
  u8g2.drawFrame(0, 0, 128, 64);
  u8g2.drawFrame(2, 2, 124, 60);
  u8g2.drawStr(22, 27, "OLED STUDIO");
  u8g2.drawHLine(22, 31, 84);
  u8g2.setFont(u8g2_font_6x10_tf);
  u8g2.drawStr(29, 46, "STANDBY 30FPS");
  u8g2.sendBuffer();
}

void setup() {
  // Set 16KB Serial RX buffer to prevent packet overflow during high-framerate streaming
  Serial.setRxBufferSize(16384);
  Serial.begin(921600);
  delay(200);

  // Initialize custom I2C pins with 800kHz high-speed bus
  Wire.begin(OLED_SDA, OLED_SCL, 800000);

  // Initialize U8g2 display driver with 800kHz bus clock (takes only ~12ms per frame!)
  u8g2.begin();
  u8g2.setBusClock(800000);
  
  // Show clean standby screen on boot
  drawStandby();
  standbyDrawn = true;

  Serial.println("\n=== OLED Visual Engine (Turbo 30FPS Receiver) ===");
}

// Process incoming WebSerial stream bytes
void processSerialStream() {
  while (Serial.available() > 0) {
    if (streamState == SEARCH_SYNC1) {
      uint8_t b = Serial.read();
      if (b == 0xAA) {
        streamState = SEARCH_SYNC2;
      }
    } else if (streamState == SEARCH_SYNC2) {
      uint8_t b = Serial.read();
      if (b == 0xBB) {
        streamState = READING_PAYLOAD;
        payloadIndex = 0;
      } else if (b != 0xAA) {
        streamState = SEARCH_SYNC1;
      }
    } else if (streamState == READING_PAYLOAD) {
      size_t needed = 1024 - payloadIndex;
      size_t avail = Serial.available();
      size_t toRead = (avail < needed) ? avail : needed;
      if (toRead > 0) {
        size_t n = Serial.readBytes((char*)(liveStreamBuffer + payloadIndex), toRead);
        payloadIndex += n;
      }

      if (payloadIndex >= 1024) {
        // Fast direct bit-transposition into U8g2 display buffer (15 us)
        convertXBMPToU8g2Buffer(liveStreamBuffer, u8g2.getBufferPtr());
        // Push buffer over 800kHz I2C (~12 ms)
        u8g2.sendBuffer();

        // Update stream state for watchdog
        lastSerialFrameTime = millis();
        isStreaming = true;
        standbyDrawn = false;
        streamState = SEARCH_SYNC1; // Reset for next frame
      }
    }
  }
}

void loop() {
  // Watchdog: If no frame received for 1.5 seconds, revert to standby
  if (isStreaming && (millis() - lastSerialFrameTime > 1500)) {
    isStreaming = false;
    standbyDrawn = false;
  }

  // Always process incoming serial to catch new streams
  processSerialStream();

  // If not actively streaming, keep standby screen drawn once
  if (!isStreaming) {
    if (!standbyDrawn) {
      drawStandby();
      standbyDrawn = true;
    }
  }
}