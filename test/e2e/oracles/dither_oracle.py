"""
Ground-truth pure math implementations for Dithering, Thresholding, and Luminance Adjustments.
"""
import numpy as np

# Bayer Matrices
BAYER_2X2 = np.array([
    [0, 2],
    [3, 1]
], dtype=np.float32)

BAYER_4X4 = np.array([
    [ 0,  8,  2, 10],
    [12,  4, 14,  6],
    [ 3, 11,  1,  9],
    [15,  7, 13,  5]
], dtype=np.float32)

def generate_bayer_8x8():
    m4 = BAYER_4X4
    top = np.hstack([4 * m4, 4 * m4 + 2])
    bottom = np.hstack([4 * m4 + 3, 4 * m4 + 1])
    return np.vstack([top, bottom]).astype(np.float32)

BAYER_8X8 = generate_bayer_8x8()


def adjust_luminance(rgb_or_gray, brightness=0.0, contrast=0.0, invert=False):
    """
    Adjusts luminance according to ITU-R BT.601 and brightness/contrast parameters.
    rgb_or_gray: np.ndarray of shape (H, W, 3/4) or (H, W) in range [0, 255]
    brightness: float in range [-100, 100]
    contrast: float in range [-100, 100]
    invert: bool
    Returns: np.ndarray of shape (H, W), dtype uint8, values in [0, 255]
    """
    arr = np.asarray(rgb_or_gray, dtype=np.float32)
    
    # Handle NaN or None
    if brightness is None or np.isnan(brightness):
        brightness = 0.0
    if contrast is None or np.isnan(contrast):
        contrast = 0.0
        
    brightness = float(np.clip(brightness, -100.0, 100.0))
    contrast = float(np.clip(contrast, -100.0, 100.0))

    if arr.ndim == 3:
        if arr.shape[2] >= 3:
            r = arr[:, :, 0]
            g = arr[:, :, 1]
            b = arr[:, :, 2]
            y_base = 0.299 * r + 0.587 * g + 0.114 * b
            if arr.shape[2] == 4:
                alpha = arr[:, :, 3] / 255.0
                y = y_base * alpha
            else:
                y = y_base
        else:
            y = arr[:, :, 0]
    else:
        y = arr.copy()

    # Contrast factor
    b_prime = brightness * 2.55
    c_prime = contrast * 2.55
    denom = 259.0 - c_prime
    if abs(denom) < 1e-6:
        f = 32.7
    else:
        f = (259.0 * (c_prime + 255.0)) / (255.0 * denom)

    # Adjust
    y_adj = np.round(f * (y - 128.0) + 128.0 + b_prime)
    y_adj = np.clip(y_adj, 0.0, 255.0)

    if invert:
        y_final = 255.0 - y_adj
    else:
        y_final = y_adj

    return y_final.astype(np.uint8)


def dither_atkinson(gray_image):
    """
    Atkinson dithering algorithm.
    6 neighbors receive 1/8 each (75% error diffused, 25% discarded).
    Offsets: (x+1, y), (x+2, y), (x-1, y+1), (x, y+1), (x+1, y+1), (x, y+2).
    gray_image: np.ndarray of shape (H, W) with values [0, 255]
    Returns: np.ndarray of shape (H, W), dtype uint8 with values strictly 0 or 255.
    """
    img = np.array(gray_image, dtype=np.float32, copy=True)
    h, w = img.shape
    out = np.zeros((h, w), dtype=np.uint8)

    # Offsets and weights
    offsets = [
        (1, 0), (2, 0),
        (-1, 1), (0, 1), (1, 1),
        (0, 2)
    ]

    for y in range(h):
        for x in range(w):
            v = img[y, x]
            q = 255 if v >= 128.0 else 0
            out[y, x] = q
            err = (v - q) / 8.0  # exactly 1/8 to each of 6 neighbors
            for dx, dy in offsets:
                nx, ny = x + dx, y + dy
                if 0 <= nx < w and 0 <= ny < h:
                    img[ny, nx] += err

    return out


def dither_floyd_steinberg(gray_image):
    """
    Floyd-Steinberg dithering algorithm.
    4 neighbors receive:
      (x+1, y): 7/16
      (x-1, y+1): 3/16
      (x, y+1): 5/16
      (x+1, y+1): 1/16
    100% of error is diffused.
    Returns: np.ndarray of shape (H, W), dtype uint8 with values strictly 0 or 255.
    """
    img = np.array(gray_image, dtype=np.float32, copy=True)
    h, w = img.shape
    out = np.zeros((h, w), dtype=np.uint8)

    for y in range(h):
        for x in range(w):
            v = img[y, x]
            q = 255 if v >= 128.0 else 0
            out[y, x] = q
            err = v - q
            
            if x + 1 < w:
                img[y, x + 1] += err * (7.0 / 16.0)
            if y + 1 < h:
                if x - 1 >= 0:
                    img[y + 1, x - 1] += err * (3.0 / 16.0)
                img[y + 1, x] += err * (5.0 / 16.0)
                if x + 1 < w:
                    img[y + 1, x + 1] += err * (1.0 / 16.0)

    return out


def bayer_threshold_matrix(size):
    """
    Returns normalized threshold matrix for size 2, 4, or 8.
    T_N(x, y) = (M_N[y][x] + 0.5) / (N^2) * 255
    """
    if size == 2:
        m = BAYER_2X2
    elif size == 4:
        m = BAYER_4X4
    elif size == 8:
        m = BAYER_8X8
    else:
        # Fallback to nearest valid size 4
        m = BAYER_4X4
        size = 4
    n_sq = size * size
    return ((m + 0.5) / float(n_sq)) * 255.0


def dither_bayer(gray_image, matrix_size=4):
    """
    Bayer Ordered Dithering.
    P(x, y) = 255 if Y(x, y) > T_N(x mod N, y mod N) else 0.
    Returns: np.ndarray of shape (H, W), dtype uint8 with values strictly 0 or 255.
    """
    img = np.asarray(gray_image, dtype=np.float32)
    h, w = img.shape
    if matrix_size not in (2, 4, 8):
        matrix_size = 4
        
    t_mat = bayer_threshold_matrix(matrix_size)
    reps_y = (h + matrix_size - 1) // matrix_size
    reps_x = (w + matrix_size - 1) // matrix_size
    t_tiled = np.tile(t_mat, (reps_y, reps_x))[:h, :w]
    val = np.clip(img, 0.0, 255.0)
    return np.where(val > t_tiled, 255, 0).astype(np.uint8)


def threshold_image(gray_image, cutoff=128):
    """
    Dynamic luminance thresholding.
    P(x, y) = 255 if Y >= cutoff else 0.
    Returns: np.ndarray of shape (H, W), dtype uint8 with values strictly 0 or 255.
    """
    if cutoff is None or np.isnan(cutoff):
        cutoff = 128
    cutoff = float(np.clip(cutoff, 0.0, 255.0))
    img = np.asarray(gray_image, dtype=np.float32)
    out = np.where(img >= cutoff, 255, 0).astype(np.uint8)
    return out
