"""
C++ PROGMEM frames.h and frames_rle.h Parser and Syntax Validator Oracle.
"""
import re
from typing import Dict, Any, List

def parse_frames_header(header_content: str) -> Dict[str, Any]:
    """
    Parses a C++ frames.h header file and extracts macros, array definitions, and frame count.
    """
    result = {
        "has_guard": False,
        "width": None,
        "height": None,
        "bytes_per_row": None,
        "frame_size": None,
        "fps": None,
        "num_frames": None,
        "array_name": None,
        "is_progmem": False,
        "has_alias": False,
        "extracted_frames": []
    }

    # Header guard
    if "#pragma once" in header_content or ("#ifndef" in header_content and "#define" in header_content):
        result["has_guard"] = True

    # Macros
    m_w = re.search(r"#define\s+FRAME_WIDTH\s+(\d+)", header_content)
    if m_w:
        result["width"] = int(m_w.group(1))

    m_h = re.search(r"#define\s+FRAME_HEIGHT\s+(\d+)", header_content)
    if m_h:
        result["height"] = int(m_h.group(1))

    m_bpr = re.search(r"#define\s+FRAME_BYTES_PER_ROW\s+(\d+)", header_content)
    if m_bpr:
        result["bytes_per_row"] = int(m_bpr.group(1))

    m_fs = re.search(r"#define\s+FRAME_SIZE_BYTES\s+(\d+)", header_content)
    if m_fs:
        result["frame_size"] = int(m_fs.group(1))

    m_fps = re.search(r"#define\s+FRAME_FPS\s+(\d+)", header_content)
    if m_fps:
        result["fps"] = int(m_fps.group(1))

    m_nf = re.search(r"#define\s+NUM_FRAMES\s+(\d+)", header_content)
    if m_nf:
        result["num_frames"] = int(m_nf.group(1))

    # PROGMEM array
    m_arr = re.search(r"const\s+uint8_t\s+(\w+)\s*\[.*?\]\s*\[.*?\]\s+PROGMEM\s*=\s*\{", header_content)
    if m_arr:
        result["array_name"] = m_arr.group(1)
        result["is_progmem"] = True

    # Alias
    if "epd_bitmap_allArray" in header_content:
        result["has_alias"] = True

    return result


def validate_cpp_header_syntax(header_content: str, expected_frames: int = None, expected_fps: int = None) -> List[str]:
    """
    Validates syntax and macro compliance of generated C++ frames.h header.
    Returns list of error messages (empty if valid).
    """
    errors = []
    parsed = parse_frames_header(header_content)

    if not parsed["has_guard"]:
        errors.append("Missing header guard (#pragma once or #ifndef ...)")

    if parsed["width"] != 128:
        errors.append(f"Expected FRAME_WIDTH 128, got {parsed['width']}")

    if parsed["height"] != 64:
        errors.append(f"Expected FRAME_HEIGHT 64, got {parsed['height']}")

    if parsed["frame_size"] != 1024:
        errors.append(f"Expected FRAME_SIZE_BYTES 1024, got {parsed['frame_size']}")

    if expected_frames is not None and parsed["num_frames"] != expected_frames:
        errors.append(f"Expected NUM_FRAMES {expected_frames}, got {parsed['num_frames']}")

    if expected_fps is not None and parsed["fps"] != expected_fps:
        errors.append(f"Expected FRAME_FPS {expected_fps}, got {parsed['fps']}")

    if not parsed["is_progmem"]:
        errors.append("PROGMEM keyword missing or malformed array declaration")

    # Check hex literals formatting
    hex_matches = re.findall(r"0x[0-9a-fA-F]{2}", header_content)
    if parsed["num_frames"] is not None:
        expected_bytes = parsed["num_frames"] * 1024
        if len(hex_matches) != expected_bytes:
            errors.append(f"Expected {expected_bytes} hex literals, found {len(hex_matches)}")

    return errors


def generate_frames_header(frames: List[bytes], fps: int = 30) -> str:
    """Generates standard Arduino C++ PROGMEM frames.h header text."""
    num_frames = len(frames)
    lines = [
        "#pragma once",
        "#include <Arduino.h>",
        f"#define NUM_FRAMES {num_frames}",
        "#define FRAME_WIDTH 128",
        "#define FRAME_HEIGHT 64",
        "#define FRAME_BYTES_PER_ROW 16",
        "#define FRAME_SIZE_BYTES 1024",
        f"#define FRAME_FPS {fps}",
        f"const uint8_t reel_frames[{num_frames}][1024] PROGMEM = {{"
    ]
    for i, f in enumerate(frames):
        hex_vals = ", ".join(f"0x{b:02x}" for b in f)
        comma = "," if i < num_frames - 1 else ""
        lines.append(f"  {{ {hex_vals} }}{comma}")
    lines.append("};")
    lines.append("const uint8_t *const epd_bitmap_allArray[NUM_FRAMES] = {")
    lines.append("  reel_frames[0]")
    lines.append("};")
    return "\n".join(lines) + "\n"
