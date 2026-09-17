#include <Arduino.h>
#include <Wire.h>
#include <U8g2lib.h>
#include "frames.h"

// Hardware I2C Pin Configuration
#define OLED_SDA 8
#define OLED_SCL 9

// U8g2 SH1106 128x64 full frame buffer driver
U8G2_SH1106_128X64_NONAME_F_HW_I2C u8g2(U8G2_R0, /* reset=*/ U8X8_PIN_NONE);

// WebSerial Live Stream Buffer (1024 bytes)
uint8_t liveStreamBuffer[FRAME_SIZE_BYTES];
bool hasReceivedStreamFrame = false;

// Serial Packet State Machine
enum StreamState { SEARCH_SYNC1, SEARCH_SYNC2, READING_PAYLOAD };
StreamState streamState = SEARCH_SYNC1;
uint16_t payloadIndex = 0;

void setup() {
  // Set 2048-byte Serial RX buffer to prevent packet overflow
  Serial.setRxBufferSize(2048);
  Serial.begin(115200);
  delay(300);

  // Initialize custom I2C pins with 800kHz Overclocked I2C bus speed
  Wire.begin(OLED_SDA, OLED_SCL, 800000);

  // Initialize U8g2 display driver with 800kHz bus clock
  u8g2.begin();
  u8g2.setBusClock(800000);

  Serial.println("\n=== OLED Visual Engine (WebSerial Live Mode) ===");
}

// Process incoming WebSerial stream bytes byte-by-byte
void processSerialStream() {
  while (Serial.available() > 0) {
    uint8_t b = Serial.read();

    if (streamState == SEARCH_SYNC1) {
      if (b == 0xAA) {
        streamState = SEARCH_SYNC2;
      }
    } else if (streamState == SEARCH_SYNC2) {
      if (b == 0xBB) {
        streamState = READING_PAYLOAD;
        payloadIndex = 0;
      } else if (b != 0xAA) {
        streamState = SEARCH_SYNC1;
      }
    } else if (streamState == READING_PAYLOAD) {
      liveStreamBuffer[payloadIndex++] = b;

      if (payloadIndex >= FRAME_SIZE_BYTES) {
        // Complete 1024-byte frame payload received! Draw live onto OLED
        u8g2.clearBuffer();
        u8g2.drawXBMP(0, 0, FRAME_WIDTH, FRAME_HEIGHT, liveStreamBuffer);
        u8g2.sendBuffer();

        // Lock live stream mode: permanently disable onboard PROGMEM loop
        hasReceivedStreamFrame = true;
        streamState = SEARCH_SYNC1; // Reset for next frame
      }
    }
  }
}

void loop() {
  // 1. Process WebSerial live stream packets
  processSerialStream();

  // 2. ONLY run PROGMEM fallback animation if no WebSerial stream has been received yet
  if (!hasReceivedStreamFrame) {
    static unsigned long lastFrameTime = 0;
    static int currentFrame = 0;
    
    const unsigned long frameIntervalMs = 1000 / FRAME_FPS;
    unsigned long now = millis();

    if (now - lastFrameTime >= frameIntervalMs) {
      lastFrameTime = now;

      u8g2.clearBuffer();
      u8g2.drawXBMP(0, 0, FRAME_WIDTH, FRAME_HEIGHT, reel_frames[currentFrame]);
      u8g2.sendBuffer();

      currentFrame++;
      if (currentFrame >= NUM_FRAMES) {
        currentFrame = 0;
      }
    }
  }
}