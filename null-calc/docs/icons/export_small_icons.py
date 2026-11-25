#!/usr/bin/env python3
"""
Resize each PNG icon to fit a 40x30 canvas (aspect preserved, centered),
and save as <original-name>-Small.png next to the source.

Requires: pip install pillow
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

from PIL import Image


CANVAS_W = 40
CANVAS_H = 30


def fit_on_canvas(img: Image.Image, width: int, height: int) -> Image.Image:
    if img.mode != "RGBA":
        img = img.convert("RGBA")
    iw, ih = img.size
    if iw == 0 or ih == 0:
        return Image.new("RGBA", (width, height), (0, 0, 0, 0))
    scale = min(width / iw, height / ih)
    nw = max(1, int(round(iw * scale)))
    nh = max(1, int(round(ih * scale)))
    resized = img.resize((nw, nh), Image.Resampling.NEAREST)
    out = Image.new("RGBA", (width, height), (0, 0, 0, 0))
    x = (width - nw) // 2
    y = (height - nh) // 2
    out.paste(resized, (x, y), resized)
    return out


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Export each PNG to a 40x30 canvas as *-Small.png"
    )
    parser.add_argument(
        "directory",
        nargs="?",
        default=".",
        type=Path,
        help="Folder containing PNG icons (default: current directory)",
    )
    parser.add_argument(
        "--width",
        type=int,
        default=CANVAS_W,
        help=f"Canvas width (default: {CANVAS_W})",
    )
    parser.add_argument(
        "--height",
        type=int,
        default=CANVAS_H,
        help=f"Canvas height (default: {CANVAS_H})",
    )
    args = parser.parse_args()
    root = args.directory.resolve()
    if not root.is_dir():
        print(f"Not a directory: {root}", file=sys.stderr)
        return 1

    w, h = args.width, args.height
    if w < 1 or h < 1:
        print("Canvas dimensions must be positive.", file=sys.stderr)
        return 1

    count = 0
    for path in sorted(root.iterdir()):
        if not path.is_file() or path.suffix.lower() != ".png":
            continue
        name = path.name
        if name.endswith("-Small.png"):
            continue
        stem = path.stem
        out_path = path.with_name(f"{stem}-Small.png")
        with Image.open(path) as im:
            canvas = fit_on_canvas(im, w, h)
        canvas.save(out_path, format="PNG")
        count += 1

    print(f"Wrote {count} file(s) to {w}x{h} canvas in {root}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
