"""
Test Fixtures and Programmatic Synthetic Media Generator
"""
from .media_generator import (
    generate_synthetic_mp4,
    generate_synthetic_gif,
    generate_png_sequence,
    generate_zero_byte_file,
    generate_truncated_mp4,
    generate_bad_magic_gif,
    generate_corrupt_png,
    generate_extreme_dimension_image,
    ensure_sample_fixtures
)

__all__ = [
    "generate_synthetic_mp4",
    "generate_synthetic_gif",
    "generate_png_sequence",
    "generate_zero_byte_file",
    "generate_truncated_mp4",
    "generate_bad_magic_gif",
    "generate_corrupt_png",
    "generate_extreme_dimension_image",
    "ensure_sample_fixtures",
]
