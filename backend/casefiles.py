from __future__ import annotations

import io
import json
import textwrap
from html import escape
from typing import Any


def render_pdf(report: dict[str, Any]) -> bytes:
    from reportlab.lib import colors
    from reportlab.lib.enums import TA_LEFT
    from reportlab.lib.pagesizes import letter
    from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
    from reportlab.lib.units import inch
    from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer

    output = io.BytesIO()
    document = SimpleDocTemplate(output, pagesize=letter, rightMargin=0.65 * inch, leftMargin=0.65 * inch, topMargin=0.6 * inch, bottomMargin=0.6 * inch)
    styles = getSampleStyleSheet()
    title_style = ParagraphStyle("PolarixTitle", parent=styles["Title"], alignment=TA_LEFT, textColor=colors.HexColor("#80652f"), spaceAfter=10)
    body_style = ParagraphStyle("PolarixBody", parent=styles["BodyText"], fontName="Courier", fontSize=7.2, leading=9.2, wordWrap="CJK")
    story = [Paragraph("POLARIX Scientific Case File", title_style)]
    story.append(Paragraph("Candidate evidence is provisional. This report preserves supplied ML output, measured data, catalog records, verification rows, and user/model notes; it does not assert a discovery.", styles["BodyText"]))
    story.append(Spacer(1, 10))
    encoded = json.dumps(report, indent=2, ensure_ascii=False, allow_nan=False)
    for line in encoded.splitlines():
        for chunk in textwrap.wrap(line, width=105, subsequent_indent="    ") or [""]:
            story.append(Paragraph(escape(chunk).replace(" ", "&nbsp;"), body_style))
    document.build(story)
    return output.getvalue()
