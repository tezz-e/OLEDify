#include <Arduino.h>
#include <Wire.h>
#include <U8g2lib.h>
#include <esp_partition.h>

// Hardware I2C Pin Configuration
#define OLED_SDA 8
#define OLED_SCL 9

// U8g2 SH1106 128x64 full frame buffer driver
// WebSerial Live Stream Buffer (1024 bytes)
uint8_t liveStreamBuffer[1024];
unsigned long lastSerialFrameTime = 0;
bool isStreaming = false;

// Partition for Standalone Animation
const esp_partition_t *animPartition = NULL;
uint32_t totalFrames = 0;
uint32_t targetFps = 30;

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

  Serial.println("\n=== OLED Visual Engine ===");

  // Find animation partition (type data, subtype 0x99)
  animPartition = esp_partition_find_first(ESP_PARTITION_TYPE_DATA, (esp_partition_subtype_t)0x99, "animation");
  
  if (animPartition != NULL) {
    // Read 8-byte header: [uint32_t frame_count] [uint32_t fps]
    uint8_t header[8];
    esp_partition_read(animPartition, 0, header, 8);
    totalFrames = header[0] | (header[1] << 8) | (header[2] << 16) | (header[3] << 24);
    targetFps = header[4] | (header[5] << 8) | (header[6] << 16) | (header[7] << 24);
    
    // Sanity check
    if (totalFrames > 5000 || totalFrames == 0) totalFrames = 0;
    if (targetFps > 60 || targetFps == 0) targetFps = 30;
    
    Serial.printf("Found animation: %d frames @ %d FPS\n", totalFrames, targetFps);
  } else {
    Serial.println("No animation partition found.");
  }
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

      if (payloadIndex >= 1024) {
        // Complete 1024-byte frame payload received! Draw live onto OLED
        u8g2.clearBuffer();
        u8g2.drawXBMP(0, 0, 128, 64, liveStreamBuffer);
        u8g2.sendBuffer();

        // Update stream state for watchdog
        lastSerialFrameTime = millis();
        isStreaming = true;
        streamState = SEARCH_SYNC1; // Reset for next frame
      }
    }
  }
}

void loop() {
  // Watchdog: If no frame received for 2 seconds, revert to PROGMEM
  if (isStreaming && (millis() - lastSerialFrameTime > 2000)) {
    isStreaming = false;
  }

  // Always process incoming serial to catch new streams
  processSerialStream();

  // If not actively streaming, play standalone animation from partition
  if (!isStreaming && animPartition != NULL && totalFrames > 0) {
    static unsigned long lastFrameTime = 0;
    static uint32_t currentFrame = 0;
    
    const unsigned long frameIntervalMs = 1000 / targetFps;
    unsigned long now = millis();

    if (now - lastFrameTime >= frameIntervalMs) {
      lastFrameTime = now;

      // Read 1024 bytes for the current frame
      // Offset is 8 bytes (header) + (currentFrame * 1024)
      uint8_t frameBuffer[1024];
      esp_err_t err = esp_partition_read(animPartition, 8 + (currentFrame * 1024), frameBuffer, 1024);
      
      if (err == ESP_OK) {
        u8g2.clearBuffer();
        u8g2.drawXBMP(0, 0, 128, 64, frameBuffer);
        u8g2.sendBuffer();
      }

      currentFrame++;
      if (currentFrame >= totalFrames) {
        currentFrame = 0;
      }
    }
  }
}