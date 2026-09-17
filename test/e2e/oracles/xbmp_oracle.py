"""
XBMP 1-Bit Row-Major LSB-First Packing and Unpacking Oracle.
Matches U8g2 drawXBMP() layout.
"""
import numpy as np

def validate_xbmp_dimensions(width, height, pixel_count=None):
    if width <= 0 or height <= 0:
        raise ValueError(f"Invalid dimensions {width}x{height}")
    if width % 8 != 0:
        raise ValueError(f"Width {width} must be a multiple of 8 for byte alignment")
    if pixel_count is not None:
        expected = width * height
        if pixel_count != expected:
            raise ValueError(f"Buffer size {pixel_count} does not match expected {expected} ({width}x{height})")


def pack_xbmp(pixels, width=128, height=64):
    """
    Packs a 1-bit pixel array or 2D image into row-major LSB-first XBMP bytes.
    pixels: 1D array of length (width*height) or 2D array of shape (height, width).
    Values > 0 are treated as 1 (lit), values == 0 as 0 (unlit).
    Returns: bytes of length (width // 8 * height) -> exactly 1024 bytes for 128x64.
    """
    arr = np.asarray(pixels)
    if arr.ndim == 2:
        h, w = arr.shape
        if (w, h) != (width, height):
            validate_xbmp_dimensions(width, height, w * h)
        arr = arr.flatten()
    
    validate_xbmp_dimensions(width, height, len(arr))

    bytes_per_row = width // 8
    expected_bytes = bytes_per_row * height
    bits = (arr > 0).astype(np.uint8).reshape(-1, 8)
    powers = np.array([1, 2, 4, 8, 16, 32, 64, 128], dtype=np.uint8)
    byte_vals = np.sum(bits * powers, axis=1, dtype=np.uint8)
    return bytes(byte_vals)


def unpack_xbmp(xbmp_bytes, width=128, height=64):
    """
    Unpacks row-major LSB-first XBMP bytes into a 1D uint8 array (0 or 255).
    xbmp_bytes: bytes-like object of length (width // 8 * height).
    Returns: np.ndarray of length (width * height), values 0 or 255.
    """
    bytes_per_row = width // 8
    expected_bytes = bytes_per_row * height
    if len(xbmp_bytes) != expected_bytes:
        raise ValueError(f"Byte buffer length {len(xbmp_bytes)} does not match expected {expected_bytes}")

    b_arr = np.frombuffer(xbmp_bytes, dtype=np.uint8)
    bits = np.unpackbits(b_arr, bitorder='little')
    return np.where(bits > 0, 255, 0).astype(np.uint8)
