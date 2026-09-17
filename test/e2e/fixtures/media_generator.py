"""
Programmatic Synthetic Media Generator.
Creates MP4, GIF, PNG sequences, and corrupt/boundary test fixtures.
"""
import os
import cv2
import numpy as np
from PIL import Image, ImageDraw, ImageFont
from pathlib import Path

def generate_synthetic_mp4(output_path, num_frames=10, width=720, height=1280, fps=30.0):
    """
    Generates synthetic 9:16 vertical MP4 test video reel.
    """
    Path(output_path).parent.mkdir(parents=True, exist_ok=True)
    fourcc = cv2.VideoWriter_fourcc(*'mp4v')
    out = cv2.VideoWriter(str(output_path), fourcc, fps, (width, height))

    for i in range(num_frames):
        frame = np.zeros((height, width, 3), dtype=np.uint8)
        if i < 3:
            # High-contrast geometric shapes
            cv2.circle(frame, (width // 2, height // 2), 200, (255, 255, 255), -1)
            cv2.rectangle(frame, (100, 100), (width - 100, 300), (255, 255, 255), 10)
        elif i < 6:
            # Continuous horizontal luminance gradient ramp
            gradient = np.linspace(0, 255, width, endpoint=True, dtype=np.uint8)
            frame[:, :, 0] = np.tile(gradient, (height, 1))
            frame[:, :, 1] = frame[:, :, 0]
            frame[:, :, 2] = frame[:, :, 0]
        elif i < 8:
            # High-frequency checkerboard pattern
            block_size = 40
            x_idx = (np.arange(width) // block_size) % 2
            y_idx = (np.arange(height) // block_size) % 2
            checker = (x_idx[None, :] ^ y_idx[:, None]) * 255
            frame[:, :, 0] = checker.astype(np.uint8)
            frame[:, :, 1] = checker.astype(np.uint8)
            frame[:, :, 2] = checker.astype(np.uint8)
        else:
            # Centered high-contrast typography
            cv2.putText(frame, f"OLED E2E {i}", (120, height // 2),
                        cv2.FONT_HERSHEY_SIMPLEX, 2.5, (255, 255, 255), 6)
        out.write(frame)

    out.release()
    return str(output_path)


def generate_synthetic_gif(output_path, num_frames=5, width=128, height=64, delay_ms=100, disposal=2):
    """
    Generates multi-frame animated GIF with custom frame delay and disposal mode.
    """
    Path(output_path).parent.mkdir(parents=True, exist_ok=True)
    frames = []
    for i in range(num_frames):
        img = Image.new('RGB', (width, height), color=(0, 0, 0))
        draw = ImageDraw.Draw(img)
        # Moving box and circle
        x = (i * 20) % width
        draw.rectangle([x, 10, x + 25, 35], fill=(255, 255, 255))
        draw.ellipse([width - x - 20, 30, width - x, 50], fill=(200, 200, 200))
        frames.append(img)

    durations = [delay_ms] * num_frames
    frames[0].save(
        output_path,
        save_all=True,
        append_images=frames[1:],
        duration=durations,
        loop=0,
        disposal=disposal
    )
    return str(output_path)


def generate_png_sequence(directory, count=10, width=128, height=64):
    """
    Generates natural-sort PNG frame sequence: frame_1.png .. frame_10.png
    """
    Path(directory).mkdir(parents=True, exist_ok=True)
    generated = []
    for i in range(1, count + 1):
        filename = f"frame_{i}.png"
        filepath = os.path.join(directory, filename)
        img = Image.new('L', (width, height), color=0)
        draw = ImageDraw.Draw(img)
        # Horizontal sweep bar
        bar_x = ((i - 1) * 12) % width
        draw.rectangle([bar_x, 0, bar_x + 8, height], fill=255)
        img.save(filepath)
        generated.append(filepath)
    return generated


def generate_zero_byte_file(output_path):
    Path(output_path).parent.mkdir(parents=True, exist_ok=True)
    with open(output_path, "wb") as f:
        pass
    return str(output_path)


def generate_truncated_mp4(output_path):
    Path(output_path).parent.mkdir(parents=True, exist_ok=True)
    # Valid 48-byte ftyp box header then abrupt cutoff
    ftyp_data = (
        b'\x00\x00\x00\x20ftypisom\x00\x00\x02\x00isomiso2avc1mp41'
        b'\x00\x00\x00\x08free\x00\x00\x00\x10mdat'
    )
    with open(output_path, "wb") as f:
        f.write(ftyp_data)
    return str(output_path)


def generate_bad_magic_gif(output_path):
    Path(output_path).parent.mkdir(parents=True, exist_ok=True)
    with open(output_path, "wb") as f:
        f.write(b"BADGIF89a\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00")
    return str(output_path)


def generate_corrupt_png(output_path):
    Path(output_path).parent.mkdir(parents=True, exist_ok=True)
    # Valid 8-byte PNG header followed by pseudo-random garbage
    png_magic = b'\x89PNG\r\n\x1a\n'
    garbage = os.urandom(64)
    with open(output_path, "wb") as f:
        f.write(png_magic + garbage)
    return str(output_path)


def generate_extreme_dimension_image(output_path, width, height):
    Path(output_path).parent.mkdir(parents=True, exist_ok=True)
    img = Image.new('RGB', (width, height), color=(128, 128, 128))
    img.save(output_path)
    return str(output_path)


def ensure_sample_fixtures(target_dir=None):
    if target_dir is None:
        target_dir = Path(__file__).resolve().parent / "sample_media"
    else:
        target_dir = Path(target_dir)

    target_dir.mkdir(parents=True, exist_ok=True)
    sample_mp4 = target_dir / "synthetic_10frame.mp4"
    if not sample_mp4.exists():
        generate_synthetic_mp4(sample_mp4, num_frames=10)

    sample_gif = target_dir / "animated_test.gif"
    if not sample_gif.exists():
        generate_synthetic_gif(sample_gif, num_frames=5)

    png_dir = target_dir / "png_sequence"
    if not png_dir.exists():
        generate_png_sequence(png_dir, count=10)

    zero_byte = target_dir / "corrupt_zero_byte.bin"
    if not zero_byte.exists():
        generate_zero_byte_file(zero_byte)

    bad_mp4 = target_dir / "corrupt_header.mp4"
    if not bad_mp4.exists():
        generate_truncated_mp4(bad_mp4)

    bad_gif = target_dir / "corrupt_bad_magic.gif"
    if not bad_gif.exists():
        generate_bad_magic_gif(bad_gif)

    bad_png = target_dir / "corrupt_magic.png"
    if not bad_png.exists():
        generate_corrupt_png(bad_png)

    extreme_dir = target_dir / "non_standard_dims"
    extreme_dir.mkdir(parents=True, exist_ok=True)
    dim_1x1 = extreme_dir / "img_1x1.png"
    if not dim_1x1.exists():
        generate_extreme_dimension_image(dim_1x1, 1, 1)

    dim_129x65 = extreme_dir / "img_129x65.png"
    if not dim_129x65.exists():
        generate_extreme_dimension_image(dim_129x65, 129, 65)

    return str(target_dir)
