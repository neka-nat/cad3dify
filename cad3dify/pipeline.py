import tempfile

from loguru import logger

from .agents import execute_python_code
from .chains import CadCodeGeneratorChain, CadCodeRefinerChain
from .image import ImageData
from .render import render_and_export_image


def index_map(index: int) -> str:
    if index == 0:
        return "1st"
    elif index == 1:
        return "2nd"
    elif index == 2:
        return "3rd"
    else:
        return f"{index + 1}th"


def generate_step_from_2d_cad_image(image_filepath: str, output_filepath: str, num_refinements: int = 3):
    """Generate a STEP file from a 2D CAD image

    Args:
        image_filepath (str): Path to the 2D CAD image
        output_filepath (str): Path to the output STEP file
    """
    image_data = ImageData.load_from_file(image_filepath)
    chain = CadCodeGeneratorChain()

    result = chain.invoke(image_data)["result"]
    code = result.format(output_filename=output_filepath)
    logger.info("1st code generation complete. Running code...")
    logger.debug("Generated 1st code:")
    logger.debug(code)
    output = execute_python_code(code)
    logger.debug(output)

    refiner_chain = CadCodeRefinerChain()

    for i in range(num_refinements):
        with tempfile.NamedTemporaryFile(suffix=".png", delete=False) as f:
            render_and_export_image(output_filepath, f.name)
            logger.info(f"Temporarily rendered image to {f.name}")
            rendered_image = ImageData.load_from_file(f.name)
            result = refiner_chain.invoke(
                {"code": code, "original_input": image_data, "rendered_result": rendered_image}
            )["result"]
            code = result.format(output_filename=output_filepath)
            logger.info("Refined code generation complete. Running code...")
            logger.debug(f"Generated {index_map(i)} refined code:")
            logger.debug(code)
            output = execute_python_code(code)
            logger.debug(output)
