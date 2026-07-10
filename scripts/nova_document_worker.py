#!/usr/bin/env python3
"""Trusted PDF renderer for Nova.

The model never supplies Python. It supplies a bounded JSON document spec and
this fixed worker turns it into a polished PDF inside a per-job temp folder.
"""

from __future__ import annotations

import argparse
import html
import json
import re
from pathlib import Path
from typing import Any

from reportlab.lib import colors
from reportlab.lib.colors import HexColor
from reportlab.lib.enums import TA_CENTER, TA_LEFT
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import inch
from reportlab.platypus import (
    HRFlowable,
    KeepTogether,
    ListFlowable,
    ListItem,
    PageBreak,
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)
from pypdf import PdfReader


GLACIANAV_PALETTE = {
    "ink": "#17202B",
    "muted": "#647282",
    "accent": "#3D6FA6",
    "accent_dark": "#2C527E",
    "soft": "#F2F4F9",
    "line": "#DDE3EE",
    "header": "#17202B",
}

# Presets change editorial structure and density in the document spec; they do
# not change brands. Every archetype deliberately inherits the same GlaciaNav
# palette so a proposal, field guide, and report still look like one product.
PRESETS: dict[str, dict[str, str]] = {
    name: dict(GLACIANAV_PALETTE)
    for name in (
        "business_brief",
        "editorial_report",
        "field_guide",
        "proposal",
        "customer_pack",
    )
}


def normalize_text(value: Any, limit: int) -> str:
    text = str(value or "").strip()
    text = text.replace("\u2010", "-").replace("\u2011", "-")
    text = text.replace("\u2012", "-").replace("\u2013", "-").replace("\u2014", "-")
    text = text.replace("\u00a0", " ")
    return text[:limit]


def inline_markup(value: str) -> str:
    value = html.escape(value.strip())
    value = re.sub(r"\*\*(.+?)\*\*", r"<b>\1</b>", value)
    value = re.sub(r"(?<!\*)\*([^*]+?)\*(?!\*)", r"<i>\1</i>", value)
    value = re.sub(r"`([^`]+?)`", r"<font name='Courier'>\1</font>", value)
    return value


def build_styles(palette: dict[str, str], layout: str) -> dict[str, ParagraphStyle]:
    base = getSampleStyleSheet()
    compact = layout == "compact"
    body_size = 9.6 if compact else 10.2
    leading = 13.2 if compact else 14.4
    return {
        "body": ParagraphStyle(
            "NovaBody",
            parent=base["BodyText"],
            fontName="Helvetica",
            fontSize=body_size,
            leading=leading,
            textColor=HexColor(palette["ink"]),
            spaceAfter=7 if compact else 9,
            allowWidows=0,
            allowOrphans=0,
        ),
        "title": ParagraphStyle(
            "NovaTitle",
            parent=base["Title"],
            fontName="Helvetica-Bold",
            fontSize=25 if compact else 30,
            leading=28 if compact else 34,
            textColor=HexColor(palette["header"]),
            alignment=TA_LEFT,
            spaceAfter=8,
        ),
        "subtitle": ParagraphStyle(
            "NovaSubtitle",
            parent=base["BodyText"],
            fontName="Helvetica",
            fontSize=12 if compact else 13,
            leading=16 if compact else 18,
            textColor=HexColor(palette["muted"]),
            spaceAfter=18 if compact else 24,
        ),
        "kicker": ParagraphStyle(
            "NovaKicker",
            parent=base["BodyText"],
            fontName="Helvetica-Bold",
            fontSize=8.2,
            leading=10,
            tracking=1.25,
            textColor=HexColor(palette["accent_dark"]),
            spaceAfter=8,
        ),
        "h1": ParagraphStyle(
            "NovaH1",
            parent=base["Heading1"],
            fontName="Helvetica-Bold",
            fontSize=16,
            leading=20,
            textColor=HexColor(palette["header"]),
            spaceBefore=16,
            spaceAfter=7,
            keepWithNext=True,
        ),
        "h2": ParagraphStyle(
            "NovaH2",
            parent=base["Heading2"],
            fontName="Helvetica-Bold",
            fontSize=12.5,
            leading=16,
            textColor=HexColor(palette["accent_dark"]),
            spaceBefore=12,
            spaceAfter=6,
            keepWithNext=True,
        ),
        "h3": ParagraphStyle(
            "NovaH3",
            parent=base["Heading3"],
            fontName="Helvetica-Bold",
            fontSize=10.4,
            leading=13,
            textColor=HexColor(palette["ink"]),
            spaceBefore=9,
            spaceAfter=4,
            keepWithNext=True,
        ),
        "table_header": ParagraphStyle(
            "NovaTableHeader",
            parent=base["BodyText"],
            fontName="Helvetica-Bold",
            fontSize=8.5,
            leading=10.5,
            textColor=colors.white,
        ),
        "table_body": ParagraphStyle(
            "NovaTableBody",
            parent=base["BodyText"],
            fontName="Helvetica",
            fontSize=8.4,
            leading=10.8,
            textColor=HexColor(palette["ink"]),
        ),
        "callout": ParagraphStyle(
            "NovaCallout",
            parent=base["BodyText"],
            fontName="Helvetica-Bold",
            fontSize=10.2,
            leading=14.4,
            textColor=HexColor(palette["header"]),
        ),
        "footer": ParagraphStyle(
            "NovaFooter",
            parent=base["BodyText"],
            fontName="Helvetica",
            fontSize=7.5,
            textColor=HexColor(palette["muted"]),
        ),
    }


def table_from_rows(
    rows: list[list[str]],
    styles: dict[str, ParagraphStyle],
    palette: dict[str, str],
    usable_width: float,
) -> Table:
    column_count = min(max(len(row) for row in rows), 5)
    normalized = [(row + [""] * column_count)[:column_count] for row in rows]
    lengths = [max(4, max(len(row[index]) for row in normalized)) for index in range(column_count)]
    capped = [min(length, 38) for length in lengths]
    total = sum(capped) or column_count
    widths = [usable_width * value / total for value in capped]
    min_width = 0.72 * inch
    widths = [max(min_width, width) for width in widths]
    width_total = sum(widths)
    if width_total > usable_width:
        widths = [width * usable_width / width_total for width in widths]

    data: list[list[Paragraph]] = []
    for row_index, row in enumerate(normalized):
        style = styles["table_header"] if row_index == 0 else styles["table_body"]
        data.append([Paragraph(inline_markup(cell), style) for cell in row])

    table = Table(data, colWidths=widths, repeatRows=1, hAlign="LEFT")
    commands: list[tuple[Any, ...]] = [
        ("BACKGROUND", (0, 0), (-1, 0), HexColor(palette["header"])),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("LEFTPADDING", (0, 0), (-1, -1), 7),
        ("RIGHTPADDING", (0, 0), (-1, -1), 7),
        ("TOPPADDING", (0, 0), (-1, -1), 6),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
        ("LINEBELOW", (0, 0), (-1, 0), 0.8, HexColor(palette["header"])),
        ("GRID", (0, 1), (-1, -1), 0.35, HexColor(palette["line"])),
    ]
    for row_index in range(1, len(data)):
        if row_index % 2 == 0:
            commands.append(("BACKGROUND", (0, row_index), (-1, row_index), HexColor("#F7F9FC")))
    table.setStyle(TableStyle(commands))
    return table


def markdown_story(
    content: str,
    title: str,
    styles: dict[str, ParagraphStyle],
    palette: dict[str, str],
    usable_width: float,
) -> list[Any]:
    lines = content.splitlines()
    story: list[Any] = []
    paragraph_lines: list[str] = []
    list_items: list[str] = []
    list_kind = "bullet"

    def flush_paragraph() -> None:
        if not paragraph_lines:
            return
        value = " ".join(part.strip() for part in paragraph_lines if part.strip())
        if value:
            story.append(Paragraph(inline_markup(value), styles["body"]))
        paragraph_lines.clear()

    def flush_list() -> None:
        if not list_items:
            return
        items = [
            ListItem(Paragraph(inline_markup(item), styles["body"]), leftIndent=8)
            for item in list_items
        ]
        list_options: dict[str, Any] = {
            "bulletType": "1" if list_kind == "number" else "bullet",
            "leftIndent": 18,
            "bulletFontName": "Helvetica-Bold",
            "bulletFontSize": 8.5,
            "bulletColor": HexColor(palette["accent_dark"]),
            "spaceAfter": 7,
        }
        if list_kind == "number":
            list_options["start"] = "1"
        else:
            list_options["bulletChar"] = "•"
        story.append(ListFlowable(items, **list_options))
        list_items.clear()

    index = 0
    while index < len(lines):
        raw = lines[index].rstrip()
        line = raw.strip()

        if line.startswith("|") and index + 1 < len(lines):
            separator = lines[index + 1].strip()
            if separator.startswith("|") and re.fullmatch(r"[|:\-\s]+", separator):
                flush_paragraph()
                flush_list()
                rows: list[list[str]] = []
                rows.append([cell.strip() for cell in line.strip("|").split("|")])
                index += 2
                while index < len(lines) and lines[index].strip().startswith("|"):
                    rows.append([cell.strip() for cell in lines[index].strip().strip("|").split("|")])
                    index += 1
                if len(rows) > 1:
                    story.extend([Spacer(1, 3), table_from_rows(rows, styles, palette, usable_width), Spacer(1, 10)])
                continue

        bullet_match = re.match(r"^[-*+]\s+(.+)$", line)
        number_match = re.match(r"^\d+[.)]\s+(.+)$", line)
        if bullet_match or number_match:
            flush_paragraph()
            next_kind = "number" if number_match else "bullet"
            if list_items and next_kind != list_kind:
                flush_list()
            list_kind = next_kind
            list_items.append((number_match or bullet_match).group(1))
            index += 1
            continue

        if line.startswith(">"):
            flush_paragraph()
            flush_list()
            quote_lines: list[str] = []
            while index < len(lines) and lines[index].strip().startswith(">"):
                quote_lines.append(lines[index].strip()[1:].strip())
                index += 1
            callout = Table(
                [[Paragraph(inline_markup(" ".join(quote_lines)), styles["callout"])]],
                colWidths=[usable_width],
                hAlign="LEFT",
            )
            callout.setStyle(
                TableStyle(
                    [
                        ("BACKGROUND", (0, 0), (-1, -1), HexColor(palette["soft"])),
                        ("BOX", (0, 0), (0, -1), 0.8, HexColor(palette["line"])),
                        ("LINEBEFORE", (0, 0), (0, -1), 4, HexColor(palette["accent"])),
                        ("LEFTPADDING", (0, 0), (-1, -1), 14),
                        ("RIGHTPADDING", (0, 0), (-1, -1), 14),
                        ("TOPPADDING", (0, 0), (-1, -1), 11),
                        ("BOTTOMPADDING", (0, 0), (-1, -1), 11),
                    ]
                )
            )
            story.extend([Spacer(1, 3), callout, Spacer(1, 10)])
            continue

        heading = re.match(r"^(#{1,3})\s+(.+)$", line)
        if heading:
            flush_paragraph()
            flush_list()
            heading_text = heading.group(2).strip()
            if heading_text.lower() != title.lower():
                story.append(Paragraph(inline_markup(heading_text), styles[f"h{len(heading.group(1))}"]))
            index += 1
            continue

        if line in {"---", "***"}:
            flush_paragraph()
            flush_list()
            story.append(HRFlowable(width="100%", thickness=0.5, color=HexColor(palette["line"]), spaceBefore=7, spaceAfter=9))
            index += 1
            continue

        if line == "[[PAGE BREAK]]":
            flush_paragraph()
            flush_list()
            story.append(PageBreak())
            index += 1
            continue

        if not line:
            flush_paragraph()
            flush_list()
        else:
            paragraph_lines.append(line)
        index += 1

    flush_paragraph()
    flush_list()
    return story


def render_pdf(spec: dict[str, Any], output_path: Path) -> dict[str, Any]:
    title = normalize_text(spec.get("title"), 180) or "Nova document"
    subtitle = normalize_text(spec.get("subtitle"), 360)
    content = normalize_text(spec.get("content"), 120_000)
    if len(content) < 20:
        raise ValueError("Document content is too short")

    preset_name = normalize_text(spec.get("preset"), 40)
    if preset_name not in PRESETS:
        preset_name = "business_brief"
    layout = normalize_text(spec.get("layout"), 20)
    if layout not in {"compact", "standard", "editorial"}:
        layout = "standard"
    document_type = normalize_text(spec.get("document_type"), 80) or "Workspace document"
    audience = normalize_text(spec.get("audience"), 140)

    palette = PRESETS[preset_name]
    styles = build_styles(palette, layout)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    doc = SimpleDocTemplate(
        str(output_path),
        pagesize=letter,
        rightMargin=0.78 * inch,
        leftMargin=0.78 * inch,
        topMargin=0.72 * inch,
        bottomMargin=0.7 * inch,
        title=title,
        author="Nova - GlaciaNav",
        subject=document_type,
        pageCompression=1,
    )
    usable_width = letter[0] - doc.leftMargin - doc.rightMargin

    def decorate_page(canvas: Any, page_doc: Any) -> None:
        page_number = canvas.getPageNumber()
        width, height = letter
        canvas.saveState()
        canvas.setFillColor(HexColor(palette["accent"]))
        canvas.rect(0, height - 8, width, 8, stroke=0, fill=1)
        if page_number > 1:
            canvas.setFont("Helvetica-Bold", 7.5)
            canvas.setFillColor(HexColor(palette["muted"]))
            canvas.drawString(page_doc.leftMargin, height - 30, document_type.upper()[:62])
            canvas.setStrokeColor(HexColor(palette["line"]))
            canvas.setLineWidth(0.45)
            canvas.line(page_doc.leftMargin, height - 37, width - page_doc.rightMargin, height - 37)
        canvas.setStrokeColor(HexColor(palette["line"]))
        canvas.setLineWidth(0.45)
        canvas.line(page_doc.leftMargin, 35, width - page_doc.rightMargin, 35)
        canvas.setFont("Helvetica", 7.5)
        canvas.setFillColor(HexColor(palette["muted"]))
        canvas.drawString(page_doc.leftMargin, 22, "GLACIANAV  /  NOVA")
        canvas.drawRightString(width - page_doc.rightMargin, 22, f"{page_number:02d}")
        canvas.restoreState()

    story: list[Any] = []
    if layout == "editorial":
        story.append(Spacer(1, 0.45 * inch))
    story.append(Paragraph(html.escape(document_type.upper()), styles["kicker"]))
    story.append(Paragraph(inline_markup(title), styles["title"]))
    if subtitle:
        story.append(Paragraph(inline_markup(subtitle), styles["subtitle"]))
    if audience:
        audience_block = Table(
            [[Paragraph(f"<b>PREPARED FOR</b><br/>{inline_markup(audience)}", styles["body"])]],
            colWidths=[usable_width],
            hAlign="LEFT",
        )
        audience_block.setStyle(
            TableStyle(
                [
                    ("BACKGROUND", (0, 0), (-1, -1), HexColor(palette["soft"])),
                    ("BOX", (0, 0), (-1, -1), 0.6, HexColor(palette["line"])),
                    ("LEFTPADDING", (0, 0), (-1, -1), 11),
                    ("RIGHTPADDING", (0, 0), (-1, -1), 11),
                    ("TOPPADDING", (0, 0), (-1, -1), 8),
                    ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
                ]
            )
        )
        story.extend([audience_block, Spacer(1, 13)])
    story.append(HRFlowable(width="100%", thickness=1.2, color=HexColor(palette["accent"]), spaceAfter=15))
    story.extend(markdown_story(content, title, styles, palette, usable_width))

    doc.build(story, onFirstPage=decorate_page, onLaterPages=decorate_page)
    raw = output_path.read_bytes()
    if len(raw) < 900 or not raw.startswith(b"%PDF") or b"%%EOF" not in raw[-2048:]:
        raise ValueError("Renderer produced an invalid PDF")

    reader = PdfReader(str(output_path))
    extracted_text = " ".join(page.extract_text() or "" for page in reader.pages).strip()
    if not reader.pages or len(extracted_text) < 20:
        raise ValueError("Rendered PDF failed its text and page integrity check")
    return {
        "bytes": len(raw),
        "pages": len(reader.pages),
        "preset": preset_name,
        "layout": layout,
    }


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", required=True)
    parser.add_argument("--output", required=True)
    args = parser.parse_args()

    input_path = Path(args.input).resolve()
    output_path = Path(args.output).resolve()
    if input_path.parent != output_path.parent:
        raise ValueError("Input and output must stay inside the same job workspace")
    spec = json.loads(input_path.read_text(encoding="utf-8"))
    if not isinstance(spec, dict):
        raise ValueError("Document spec must be an object")
    result = render_pdf(spec, output_path)
    print(json.dumps(result), flush=True)


if __name__ == "__main__":
    main()
