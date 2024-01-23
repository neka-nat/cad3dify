import tempfile

import cadquery as cq
from cadquery import exporters
from reportlab.graphics import renderPM
from svglib.svglib import svg2rlg


def render_and_export_image(cat_filepath: str, output_filepath: str):
    """Render a CAD file and export it as an SVG file

    Args:
        cat_file (str): Path to the CAD file
        output_filename (str): Path to the output PNG file
    """
    cad = cq.importers.importStep(cat_filepath)
    with tempfile.NamedTemporaryFile(suffix=".svg", delete=True) as f:
        exporters.export(cad, f.name)
        drawing = svg2rlg(f.name)

    renderPM.drawToFile(drawing, output_filepath, fmt="PNG")
