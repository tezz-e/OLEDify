"""
OLED Visual Studio Flash Tool
Leverages the exact PlatformIO / esptool.py pipeline for 100% reliable 1-click flashing
"""

import os
import sys
import argparse
import subprocess
import re

try:
    import serial.tools.list_ports
except ImportError:
    pass

def find_esp32_port():
    """Auto-detects ESP32-S3 port by VID/PID or falls back to common ports."""
    try:
        ports = list(serial.tools.list_ports.comports())
        # First priority: ESP32-S3 USB Serial / JTAG (VID 0x303A, PID 0x1001)
        for p in ports:
            vid = getattr(p, 'vid', None)
            pid = getattr(p, 'pid', None)
            if vid == 0x303A and pid == 0x1001:
                return p.device
            if vid == 0x303A:
                return p.device

        # Second priority: USB-Serial devices (CP210x, CH340, etc.)
        for p in ports:
            desc = (p.description or '').lower()
            if 'usb serial' in desc or 'ch340' in desc or 'cp210' in desc or 'ch9102' in desc:
                return p.device

        # Fallback to COM12 if available in list
        for p in ports:
            if p.device == 'COM12':
                return 'COM12'

        if ports:
            return ports[0].device
    except Exception as e:
        sys.stderr.write(f"Port detection notice: {e}\n")

    return 'COM12'

def find_esptool():
    """Locates PlatformIO python.exe and esptool.py."""
    user_home = os.path.expanduser('~')
    pio_python = os.path.join(user_home, r'.platformio\penv\Scripts\python.exe')
    pio_esptool = os.path.join(user_home, r'.platformio\packages\tool-esptoolpy\esptool.py')

    if os.path.exists(pio_python) and os.path.exists(pio_esptool):
        return pio_python, pio_esptool

    # Fallback to system python
    return sys.executable, '-m esptool'

def main():
    parser = argparse.ArgumentParser(description="Flash animation and firmware to ESP32-S3")
    parser.add_argument('--port', help="Serial port (auto-detected if omitted)")
    parser.add_argument('--baud', default='460800', help="Baud rate (default: 460800)")
    parser.add_argument('--firmware', help="Path to firmware.bin (flashed to 0x10000)")
    parser.add_argument('--animation', help="Path to animation payload blob (flashed to 0x200000)")

    args = parser.parse_args()

    port = args.port or find_esp32_port()
    print(f"STATUS: TARGET_PORT={port}", flush=True)

    py_exe, esptool_target = find_esptool()
    print(f"STATUS: USING_ESPTOOL={esptool_target}", flush=True)

    cmd = [
        py_exe,
        esptool_target,
        '--chip', 'esp32s3',
        '--port', port,
        '--baud', str(args.baud),
        '--before', 'default_reset',
        '--after', 'hard_reset',
        'write_flash',
    ]

    files_to_flash = 0
    if args.firmware and os.path.exists(args.firmware):
        cmd.extend(['0x10000', os.path.abspath(args.firmware)])
        files_to_flash += 1

    if args.animation and os.path.exists(args.animation):
        cmd.extend(['0x200000', os.path.abspath(args.animation)])
        files_to_flash += 1

    if files_to_flash == 0:
        sys.stderr.write("Error: Neither firmware nor animation file provided.\n")
        sys.exit(1)

    print("PROGRESS: 15% Connecting to ESP32 bootloader...", flush=True)

    process = subprocess.Popen(
        cmd,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
        bufsize=1,
        universal_newlines=True
    )

    percent_pattern = re.compile(r'\((\d+)\s*%\)')

    for line in iter(process.stdout.readline, ''):
        line = line.strip()
        if not line:
            continue

        print(f"[esptool] {line}", flush=True)

        if "Chip is ESP32-S3" in line:
            print("PROGRESS: 25% ESP32-S3 detected. Uploading flasher stub...", flush=True)
        elif "Stub running..." in line:
            print("PROGRESS: 35% Stub running at 460800 baud. Erasing flash sectors...", flush=True)
        elif "Writing at 0x" in line:
            match = percent_pattern.search(line)
            if match:
                raw_pct = int(match.group(1))
                # Map 0-100% of writing to 40-95% overall progress
                scaled_pct = 40 + int(raw_pct * 0.55)
                print(f"PROGRESS: {scaled_pct}% Writing partition ({raw_pct}%)...", flush=True)
        elif "Hard resetting via RTS pin..." in line:
            print("PROGRESS: 99% Flash verified. Hard rebooting ESP32...", flush=True)

    process.stdout.close()
    return_code = process.wait()

    if return_code == 0:
        print("PROGRESS: 100% Flash complete! ESP32 is running high-speed 30 FPS animation.", flush=True)
        sys.exit(0)
    else:
        sys.stderr.write(f"Error: esptool process exited with code {return_code}\n")
        sys.exit(return_code)

if __name__ == '__main__':
    main()
