"""
PackBits Byte-Level RLE Compression and Decompression Oracle.
Conforms to PROJECT.md interface contract and Apple/TIFF PackBits standard.
"""
from typing import List, Tuple

def packbits_compress(data: bytes) -> bytes:
    """
    Compresses byte stream using PackBits byte-level run-length encoding.
    - Runs of 2 to 128 identical bytes: flag = 1 - n (257 - n as uint8), followed by 1 byte.
    - Literal sequences of 1 to 128 unrepeated bytes: flag = n - 1 (0..127), followed by n bytes.
    """
    if not data:
        return b""

    out = bytearray()
    i = 0
    n_bytes = len(data)

    while i < n_bytes:
        # Check for run of identical bytes
        run_len = 1
        while (i + run_len < n_bytes) and (data[i + run_len] == data[i]) and (run_len < 128):
            run_len += 1

        if run_len >= 2:
            # Emit repeat run
            flag = (257 - run_len) & 0xFF  # - (run_len - 1) in two's complement uint8
            out.append(flag)
            out.append(data[i])
            i += run_len
        else:
            # Find literal sequence
            lit_start = i
            lit_len = 0
            while i < n_bytes and lit_len < 128:
                # If we encounter a run of >= 3 identical bytes, break literal sequence
                if (i + 2 < n_bytes) and (data[i] == data[i + 1] == data[i + 2]):
                    break
                lit_len += 1
                i += 1
                
            flag = lit_len - 1
            out.append(flag)
            out.extend(data[lit_start:lit_start + lit_len])

    return bytes(out)


def packbits_decompress(compressed: bytes, max_output_len: int = 1024) -> bytes:
    """
    Decompresses PackBits RLE stream with safety truncation to max_output_len.
    """
    out = bytearray()
    i = 0
    in_len = len(compressed)

    while i < in_len and len(out) < max_output_len:
        b = compressed[i]
        i += 1

        if b < 128:
            # Literal run of b + 1 bytes
            count = b + 1
            available = min(count, in_len - i, max_output_len - len(out))
            out.extend(compressed[i:i + available])
            i += available
        elif b > 128:
            # Repeated run of 257 - b bytes
            count = 257 - b
            if i < in_len:
                repeat_byte = compressed[i]
                i += 1
                to_append = min(count, max_output_len - len(out))
                out.extend([repeat_byte] * to_append)
        # b == 128 is a NOP in PackBits

    return bytes(out)


def compress_frame_sequence_rle(frames: List[bytes]) -> Tuple[bytes, List[int], List[int]]:
    """
    Compresses a sequence of 1024-byte frames.
    Returns:
    - concatenated rle_data bytes
    - frame_offsets list
    - frame_lengths list
    """
    all_rle = bytearray()
    offsets = []
    lengths = []

    for f in frames:
        compressed = packbits_compress(f)
        # If compressed size >= 1024, PackBits fallback
        if len(compressed) >= 1024:
            # PackBits literal fallback: flag 127 + 128 bytes (8 chunks)
            # Or store compressed as is if decompressor supports it
            pass
        offsets.append(len(all_rle))
        lengths.append(len(compressed))
        all_rle.extend(compressed)

    return bytes(all_rle), offsets, lengths
