#!/usr/bin/env python3
"""
Software Copyright Source Code PDF Generator
Generates front 30 pages + back 30 pages for Chinese software copyright application
Supports UTF-8 / Chinese characters
"""

import os
import shutil
from pathlib import Path
from typing import List
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.pdfgen import canvas
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont

# Config
PAGES = 30
LINES_PER_PAGE = 55  # Adjusted for PDF layout
TOTAL_LINES = PAGES * LINES_PER_PAGE

# Exclude directories and files
EXCLUDE_DIRS = {
    'node_modules', '.git', 'dist', 'build', 'Pods', '.gradle',
    '.expo', 'live2d', '__pycache__', '.venv', 'venv'
}
EXCLUDE_EXTENSIONS = {'.d.ts'}
EXCLUDE_PATTERNS = {'.min.js'}

# Source code extensions
SOURCE_EXTENSIONS = {'.ts', '.tsx', '.js', '.jsx', '.py'}


def register_chinese_font():
    """Register a Chinese-compatible font"""
    font_paths = [
        '/System/Library/Fonts/STHeiti Light.ttc',
        '/System/Library/Fonts/PingFang.ttc',
        '/System/Library/Fonts/Hiragino Sans GB.ttc',
        '/Library/Fonts/Arial Unicode.ttf',
    ]

    for path in font_paths:
        if os.path.exists(path):
            try:
                pdfmetrics.registerFont(TTFont('Chinese', path, subfontIndex=0))
                return 'Chinese'
            except:
                continue

    # Fallback: try to find any available Chinese font
    import subprocess
    result = subprocess.run(['fc-list', ':lang=zh', '-f', '%{file}\n'], capture_output=True, text=True)
    for line in result.stdout.strip().split('\n'):
        if line:
            try:
                pdfmetrics.registerFont(TTFont('Chinese', line))
                return 'Chinese'
            except:
                continue

    return 'Courier'


def should_include(file_path: Path) -> bool:
    if file_path.suffix not in SOURCE_EXTENSIONS:
        return False
    name = file_path.name
    if any(name.endswith(ext) for ext in EXCLUDE_EXTENSIONS):
        return False
    if any(pattern in name for pattern in EXCLUDE_PATTERNS):
        return False
    for part in file_path.parts:
        if part in EXCLUDE_DIRS:
            return False
    return True


def collect_source_files(root_dir: Path) -> List[Path]:
    files = []
    for file_path in root_dir.rglob('*'):
        if file_path.is_file() and should_include(file_path):
            files.append(file_path)
    files.sort()
    return files


def read_file_content(file_path: Path) -> List[str]:
    try:
        with open(file_path, 'r', encoding='utf-8', errors='replace') as f:
            return f.read().splitlines()
    except:
        return []


def generate_source_document(root_dir: Path, output_file: Path):
    """Generate source code text file"""
    print(f"Scanning directory: {root_dir}")
    files = collect_source_files(root_dir)
    print(f"Found {len(files)} source files")

    all_lines = []
    file_boundaries = {}

    for file_path in files:
        start_line = len(all_lines)
        file_boundaries[start_line] = file_path
        lines = read_file_content(file_path)
        all_lines.extend(lines)

    total_lines = len(all_lines)
    print(f"Total lines: {total_lines}")

    output_lines = []

    # Simple header - consistent with code style
    output_lines.extend([
        "// " + "=" * 50,
        "// Software: N.E.K.O",
        "// Version: V1.0",
        "// " + "=" * 50,
        "",
        "// " + "-" * 50,
        "// FRONT 30 PAGES",
        "// " + "-" * 50,
        "",
    ])

    # Front lines
    front_lines = all_lines[:TOTAL_LINES]
    for i, line in enumerate(front_lines):
        for start_line in file_boundaries:
            if start_line == i:
                output_lines.extend(["", "// " + "-" * 40, ""])
                break
        output_lines.append(line)

    print(f"Front 30 pages: {len(front_lines)} lines")

    # Back lines
    output_lines.extend([
        "",
        "// " + "-" * 50,
        "// BACK 30 PAGES",
        "// " + "-" * 50,
        "",
    ])

    back_start = max(TOTAL_LINES, total_lines - TOTAL_LINES)
    back_lines = all_lines[back_start:]

    for i, line in enumerate(back_lines, start=back_start):
        for start_line in file_boundaries:
            if start_line == i:
                output_lines.extend(["", "// " + "-" * 40, ""])
                break
        output_lines.append(line)

    print(f"Back 30 pages: {len(back_lines)} lines")

    with open(output_file, 'w', encoding='utf-8') as f:
        f.write('\n'.join(output_lines))

    print(f"Source saved to: {output_file}")
    return output_lines


def create_pdf(lines: List[str], pdf_file: Path):
    """Create PDF with Chinese font support"""
    print("Generating PDF with Chinese support...")

    font_name = register_chinese_font()
    print(f"Using font: {font_name}")

    c = canvas.Canvas(str(pdf_file), pagesize=A4)
    width, height = A4

    # Margins
    left_margin = 15 * mm
    right_margin = 15 * mm
    top_margin = 15 * mm
    bottom_margin = 15 * mm

    # Text area
    text_width = width - left_margin - right_margin
    text_height = height - top_margin - bottom_margin

    # Font size
    font_size = 7
    line_height = font_size + 2

    # Lines per page
    lines_per_page = int(text_height / line_height)

    x = left_margin
    y = height - top_margin - font_size

    current_page = 1

    for line in lines:
        # Check if need new page
        if y < bottom_margin:
            c.showPage()
            c.setFont(font_name, font_size)
            y = height - top_margin - font_size
            current_page += 1

        # Handle long lines - wrap them
        max_chars = int(text_width / (font_size * 0.5))  # Approximate char width

        if len(line) > max_chars:
            # Split line into chunks
            chunks = [line[i:i+max_chars] for i in range(0, len(line), max_chars)]
            for chunk in chunks:
                if y < bottom_margin:
                    c.showPage()
                    c.setFont(font_name, font_size)
                    y = height - top_margin - font_size
                    current_page += 1
                c.drawString(x, y, chunk)
                y -= line_height
        else:
            c.drawString(x, y, line)
            y -= line_height

    c.save()
    print(f"PDF generated: {pdf_file}")
    print(f"Total pages: {current_page}")


def main():
    root_dir = Path(__file__).parent.parent
    output_dir = root_dir / "software-copyright"
    output_dir.mkdir(exist_ok=True)

    txt_file = output_dir / "source_code.txt"
    pdf_file = output_dir / "source_code.pdf"

    lines = generate_source_document(root_dir, txt_file)
    create_pdf(lines, pdf_file)


if __name__ == "__main__":
    main()
