import cv2
import numpy as np
from PIL import Image
import os
import sys

def convert_frame_to_xbmp(pil_1bit_img):
    """
    Converts a 1-bit PIL Image (128x64, '1' mode) into XBMP format bytes.
    In XBMP mode: 128 width = 16 bytes per row.
    Bit 0 is left-most pixel in each byte.
    1 = White/Lit pixel, 0 = Black/Unlit pixel.
    """
    width, height = pil_1bit_img.size
    bytes_per_row = width // 8
    img_bytes = bytearray(bytes_per_row * height)
    
    # Get raw 0/255 numpy array (0 = black, 255 = white)
    arr = np.array(pil_1bit_img, dtype=np.uint8)
    
    byte_idx = 0
    for y in range(height):
        for x in range(0, width, 8):
            byte_val = 0
            for b in range(8):
                if x + b < width:
                    # In PIL '1' mode: True/255 = white (lit pixel)
                    pixel = 1 if arr[y, x + b] > 0 else 0
                    byte_val |= (pixel << b)  # LSB first for XBMP
            img_bytes[byte_idx] = byte_val
            byte_idx += 1
            
    return img_bytes

def process_video(video_path, output_header_path, target_w=128, target_h=64, mode='crop', threshold_val=None):
    if not os.path.exists(video_path):
        print(f"Error: Video file '{video_path}' not found!")
        sys.exit(1)
        
    cap = cv2.VideoCapture(video_path)
    if not cap.isOpened():
        print(f"Error: Could not open video file '{video_path}'")
        sys.exit(1)
        
    orig_w = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    orig_h = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    fps = cap.get(cv2.CAP_PROP_FPS)
    total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    
    print(f"Loaded video: {video_path}")
    print(f"Original Resolution: {orig_w}x{orig_h} @ {fps:.2f} FPS")
    print(f"Total Frames: {total_frames}")
    
    # Determine crop bounding box (center crop maintaining 2:1 target ratio)
    target_aspect = target_w / target_h  # 2.0
    orig_aspect = orig_w / orig_h        # 0.5625 for 9:16 vertical reel
    
    if mode == 'crop':
        # Crop vertical video to 2:1 width-to-height ratio centered
        crop_h = int(orig_w / target_aspect)
        crop_w = orig_w
        if crop_h > orig_h:
            crop_h = orig_h
            crop_w = int(orig_h * target_aspect)
        
        crop_x = (orig_w - crop_w) // 2
        crop_y = (orig_h - crop_h) // 2
        print(f"Crop box: x={crop_x}, y={crop_y}, w={crop_w}, h={crop_h}")
    
    all_frames_bytes = []
    frame_count = 0
    
    # Directory for preview screenshots
    preview_dir = os.path.join(os.path.dirname(output_header_path), "previews")
    os.makedirs(preview_dir, exist_ok=True)
    
    while True:
        ret, frame = cap.read()
        if not ret:
            break
            
        # Crop & Resize
        if mode == 'crop':
            cropped = frame[crop_y:crop_y+crop_h, crop_x:crop_x+crop_w]
        else:
            cropped = frame
            
        resized = cv2.resize(cropped, (target_w, target_h), interpolation=cv2.INTER_AREA)
        
        # Convert BGR -> Grayscale PIL Image
        gray_img = Image.fromarray(cv2.cvtColor(resized, cv2.COLOR_BGR2RGB)).convert('L')
        
        # Dithering / Thresholding
        if threshold_val is not None:
            # Simple thresholding
            fn = lambda x : 255 if x > threshold_val else 0
            bit_img = gray_img.convert('L').point(fn, mode='1')
        else:
            # Floyd-Steinberg dithering
            bit_img = gray_img.convert('1', dither=Image.Dither.FLOYDSTEINBERG)
            
        # Save a few sample preview images for visual inspection
        if frame_count in [0, 30, 60, 120, 200, 300]:
            preview_path = os.path.join(preview_dir, f"frame_{frame_count:03d}.png")
            bit_img.save(preview_path)
            
        xbmp_bytes = convert_frame_to_xbmp(bit_img)
        all_frames_bytes.append(xbmp_bytes)
        frame_count += 1
        
    cap.release()
    print(f"Successfully processed {frame_count} frames.")
    
    # Write C++ header file
    print(f"Writing header file to '{output_header_path}'...")
    with open(output_header_path, 'w') as f:
        f.write("// Auto-generated frames header for ESP32 OLED visual engine\n")
        f.write("#ifndef FRAMES_H\n#define FRAMES_H\n\n")
        f.write("#include <Arduino.h>\n\n")
        f.write(f"#define NUM_FRAMES {frame_count}\n")
        f.write(f"#define FRAME_WIDTH {target_w}\n")
        f.write(f"#define FRAME_HEIGHT {target_h}\n")
        f.write(f"#define FRAME_BYTES_PER_ROW {target_w // 8}\n")
        f.write(f"#define FRAME_SIZE_BYTES {len(all_frames_bytes[0])}\n")
        f.write(f"#define FRAME_FPS {int(round(fps))}\n\n")
        
        # Single flat PROGMEM array for all frames to minimize header complexity
        f.write(f"// Total size: {frame_count} * {len(all_frames_bytes[0])} = {frame_count * len(all_frames_bytes[0])} bytes (~{int(frame_count * len(all_frames_bytes[0]) / 1024)} KB)\n")
        f.write("const uint8_t reel_frames[NUM_FRAMES][FRAME_SIZE_BYTES] PROGMEM = {\n")
        
        for idx, fbytes in enumerate(all_frames_bytes):
            f.write("  { ")
            hex_vals = [f"0x{b:02X}" for b in fbytes]
            f.write(", ".join(hex_vals))
            if idx < frame_count - 1:
                f.write(" },\n")
            else:
                f.write(" }\n")
                
        f.write("};\n\n")
        f.write("#endif // FRAMES_H\n")
        
    print(f"Header generated successfully! Size: {os.path.getsize(output_header_path) / (1024*1024):.2f} MB")

if __name__ == "__main__":
    video_file = r"D:\espprojects\oled\igexport-DckvRqKPsI_.mp4"
    header_file = r"D:\espprojects\oled\src\frames.h"
    process_video(video_file, header_file)
