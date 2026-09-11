#!/usr/bin/env python3
"""Unduh Google Fonts (offline) ke src/assets/fonts.

Menghasilkan src/assets/fonts/fonts-offline.css berisi @font-face dengan
path lokal, sehingga aplikasi TIDAK memerlukan internet saat dijalankan.

Jalankan ulang bila ingin menambah keluarga/ketebalan:
    python3 scripts/fonts-offline.py
"""
from __future__ import annotations

import re
import subprocess
import sys
from pathlib import Path

# Keluarga font sans-serif (tanpa kaki) + ketebalan yang diunduh.
FAMILIES: dict[str, list[int]] = {
    "Inter": [300, 400],
    "Roboto": [300, 400],
    "Open Sans": [300, 400],
    "Lato": [300, 400],
    "Noto Sans": [300, 400],
    "Source Sans 3": [300, 400],
    "Work Sans": [300, 400],
    "Plus Jakarta Sans": [300, 400],
}

# Subset yang diunduh (cukup untuk teks Latin; latin-ext untuk aksen).
SUBSETS = ("latin", "latin-ext")

UA = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
)

ROOT = Path(__file__).resolve().parents[1]
OUT_DIR = ROOT / "src" / "assets" / "fonts"
OUT_CSS = OUT_DIR / "fonts-offline.css"

BLOCK_RE = re.compile(
    r"/\*\s*(?P<subset>[\w-]+)\s*\*/\s*@font-face\s*\{(?P<body>[^}]*)\}", re.S
)


def slug(name: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")


def fetch(url: str) -> bytes:
    """Ambil URL via curl (memakai trust store sistem; urllib gagal di macOS)."""
    proc = subprocess.run(
        ["curl", "-fsSL", "--max-time", "60", "-A", UA, url],
        capture_output=True,
        check=False,
    )
    if proc.returncode != 0:
        raise RuntimeError(proc.stderr.decode("utf-8", "replace").strip() or "curl gagal")
    return proc.stdout


def parse_css(css: str) -> list[dict[str, str]]:
    out: list[dict[str, str]] = []
    for m in BLOCK_RE.finditer(css):
        body = m.group("body")
        url = re.search(r"url\((https://[^)]+\.woff2)\)", body)
        weight = re.search(r"font-weight:\s*(\d+)", body)
        urange = re.search(r"unicode-range:\s*([^;]+);", body)
        if not url or not weight:
            continue
        out.append(
            {
                "subset": m.group("subset"),
                "url": url.group(1),
                "weight": weight.group(1),
                "unicode_range": (urange.group(1).strip() if urange else ""),
            }
        )
    return out


def main() -> int:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    css_parts: list[str] = [
        "/* Dibuat otomatis oleh scripts/fonts-offline.py — jangan diedit manual. */\n"
        "/* Google Fonts disimpan lokal agar aplikasi berjalan tanpa internet. */\n"
    ]
    total = 0
    bytes_total = 0

    for family, weights in FAMILIES.items():
        axes = ";".join(str(w) for w in weights)
        url = (
            "https://fonts.googleapis.com/css2?"
            f"family={family.replace(' ', '+')}:wght@{axes}&display=swap"
        )
        try:
            css = fetch(url).decode("utf-8")
        except Exception as exc:  # noqa: BLE001
            print(f"GAGAL ambil CSS {family}: {exc}", file=sys.stderr)
            continue

        blocks = [b for b in parse_css(css) if b["subset"] in SUBSETS]
        folder = OUT_DIR / slug(family)
        folder.mkdir(parents=True, exist_ok=True)

        for b in blocks:
            fname = f"{b['weight']}-{b['subset']}.woff2"
            dest = folder / fname
            if not dest.exists() or dest.stat().st_size == 0:
                data = fetch(b["url"])
                dest.write_bytes(data)
                bytes_total += len(data)
            total += 1
            css_parts.append(
                "@font-face {\n"
                f"  font-family: '{family}';\n"
                "  font-style: normal;\n"
                f"  font-weight: {b['weight']};\n"
                "  font-display: swap;\n"
                f"  src: url('./{slug(family)}/{fname}') format('woff2');\n"
                + (f"  unicode-range: {b['unicode_range']};\n" if b["unicode_range"] else "")
                + "}\n"
            )
        print(f"{family}: {len(blocks)} berkas")

    OUT_CSS.write_text("\n".join(css_parts), encoding="utf-8")
    print(f"\nTotal {total} @font-face, unduhan baru {bytes_total / 1024:.0f} KB")
    print(f"CSS: {OUT_CSS.relative_to(ROOT)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
