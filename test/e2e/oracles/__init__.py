"""
Mathematical and Protocol Ground-Truth Oracles for OLED E2E Testing
"""
from .dither_oracle import (
    adjust_luminance,
    dither_atkinson,
    dither_floyd_steinberg,
    dither_bayer,
    threshold_image,
    bayer_threshold_matrix,
    BAYER_2X2,
    BAYER_4X4,
    BAYER_8X8
)
from .xbmp_oracle import (
    pack_xbmp,
    unpack_xbmp,
    validate_xbmp_dimensions
)
from .protocol_simulator import (
    OLEDStreamPacket,
    ESP32StreamReceiverSimulator,
    build_oled_stream_packet,
    verify_oled_packet_checksum
)
from .rle_oracle import (
    packbits_compress,
    packbits_decompress,
    compress_frame_sequence_rle
)
from .cpp_header_oracle import (
    validate_cpp_header_syntax,
    parse_frames_header
)

__all__ = [
    "adjust_luminance",
    "dither_atkinson",
    "dither_floyd_steinberg",
    "dither_bayer",
    "threshold_image",
    "bayer_threshold_matrix",
    "BAYER_2X2",
    "BAYER_4X4",
    "BAYER_8X8",
    "pack_xbmp",
    "unpack_xbmp",
    "validate_xbmp_dimensions",
    "OLEDStreamPacket",
    "ESP32StreamReceiverSimulator",
    "build_oled_stream_packet",
    "verify_oled_packet_checksum",
    "packbits_compress",
    "packbits_decompress",
    "compress_frame_sequence_rle",
    "validate_cpp_header_syntax",
    "parse_frames_header",
]
