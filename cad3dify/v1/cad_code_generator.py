import re
import textwrap
from typing import Any, Union

from langchain.chains import LLMChain, SequentialChain, TransformChain
from langchain.prompts import ChatPromptTemplate, HumanMessagePromptTemplate, PromptTemplate
from langchain_core.prompts.image import ImagePromptTemplate

from ..chat_models import MODEL_TYPE, ChatModelParameters
from ..image import ImageData


def _parse_code(input: dict) -> dict:
    match = re.search(r"```(?:python)?\n(.*?)\n```", input["text"], re.DOTALL)
    if match:
        code_output = match.group(1).strip()
        return {"result": code_output}
    else:
        return {"result": None}


_cad_query_examples = [
    (
        "You can use a list of points to construct multiple objects at once. Most construction methods, "
        "like Workplane.circle() and Workplane.rect(), will operate on multiple points if they are on the stack",
        """r = cq.Workplane("front").circle(2.0)  # make base
r = r.pushPoints(
    [(1.5, 0), (0, 1.5), (-1.5, 0), (0, -1.5)]
)  # now four points are on the stack
r = r.circle(0.25)  # circle will operate on all four points
result = r.extrude(0.125)  # make prism""",
    ),
    (
        "This example uses a polyline to create one half of an i-beam shape, which is mirrored to create the final profile.",
        """(L, H, W, t) = (100.0, 20.0, 20.0, 1.0)
pts = [
    (0, H / 2.0),
    (W / 2.0, H / 2.0),
    (W / 2.0, (H / 2.0 - t)),
    (t / 2.0, (H / 2.0 - t)),
    (t / 2.0, (t - H / 2.0)),
    (W / 2.0, (t - H / 2.0)),
    (W / 2.0, H / -2.0),
    (0, H / -2.0),
]
result = cq.Workplane("front").polyline(pts).mirrorY().extrude(L)""",
    ),
    (
        "Combining a few basic functions, its possible to make a very good parametric bearing pillow block, with just a few lines of code.",
        """(length, height, bearing_diam, thickness, padding) = (30.0, 40.0, 22.0, 10.0, 8.0)

result = (
    cq.Workplane("XY")
    .box(length, height, thickness)
    .faces(">Z")
    .workplane()
    .hole(bearing_diam)
    .faces(">Z")
    .workplane()
    .rect(length - padding, height - padding, forConstruction=True)
    .vertices()
    .cboreHole(2.4, 4.4, 2.1)
)""",
    ),
    (
        "This sample is one of the longer ones at 13 lines, but that's very short compared to the pythonOCC version, which is 10x longer!",
        """(L, w, t) = (20.0, 6.0, 3.0)
s = cq.Workplane("XY")

# Draw half the profile of the bottle and extrude it
p = (
    s.center(-L / 2.0, 0)
    .vLine(w / 2.0)
    .threePointArc((L / 2.0, w / 2.0 + t), (L, w / 2.0))
    .vLine(-w / 2.0)
    .mirrorX()
    .extrude(30.0, True)
)

# Make the neck
p = p.faces(">Z").workplane(centerOption="CenterOfMass").circle(3.0).extrude(2.0, True)

# Make a shell
result = p.faces(">Z").shell(0.3)""",
    ),
    (
        "This specific examples generates a helical cycloidal gear.",
        """import cadquery as cq
from math import sin, cos, pi, floor


# define the generating function
def hypocycloid(t, r1, r2):
    return (
        (r1 - r2) * cos(t) + r2 * cos(r1 / r2 * t - t),
        (r1 - r2) * sin(t) + r2 * sin(-(r1 / r2 * t - t)),
    )


def epicycloid(t, r1, r2):
    return (
        (r1 + r2) * cos(t) - r2 * cos(r1 / r2 * t + t),
        (r1 + r2) * sin(t) - r2 * sin(r1 / r2 * t + t),
    )


def gear(t, r1=4, r2=1):
    if (-1) ** (1 + floor(t / 2 / pi * (r1 / r2))) < 0:
        return epicycloid(t, r1, r2)
    else:
        return hypocycloid(t, r1, r2)


# create the gear profile and extrude it
result = (
    cq.Workplane("XY")
    .parametricCurve(lambda t: gear(t * 2 * pi, 6, 1))
    .twistExtrude(15, 90)
    .faces(">Z")
    .workplane()
    .circle(2)
    .cutThruAll()
)
""",
    ),
    (
        "This script will produce any size regular rectangular Lego(TM) brick. Its only tricky because of the logic regarding the underside of the brick.",
        """#####
# Inputs
######
lbumps = 6  # number of bumps long
wbumps = 2  # number of bumps wide
thin = True  # True for thin, False for thick

#
# Lego Brick Constants-- these make a Lego brick a Lego :)
#
pitch = 8.0
clearance = 0.1
bumpDiam = 4.8
bumpHeight = 1.8
if thin:
    height = 3.2
else:
    height = 9.6

t = (pitch - (2 * clearance) - bumpDiam) / 2.0
postDiam = pitch - t  # works out to 6.5
total_length = lbumps * pitch - 2.0 * clearance
total_width = wbumps * pitch - 2.0 * clearance

# make the base
s = cq.Workplane("XY").box(total_length, total_width, height)

# shell inwards not outwards
s = s.faces("<Z").shell(-1.0 * t)

# make the bumps on the top
s = (
    s.faces(">Z")
    .workplane()
    .rarray(pitch, pitch, lbumps, wbumps, True)
    .circle(bumpDiam / 2.0)
    .extrude(bumpHeight)
)

# add posts on the bottom. posts are different diameter depending on geometry
# solid studs for 1 bump, tubes for multiple, none for 1x1
tmp = s.faces("<Z").workplane(invert=True)

if lbumps > 1 and wbumps > 1:
    tmp = (
        tmp.rarray(pitch, pitch, lbumps - 1, wbumps - 1, center=True)
        .circle(postDiam / 2.0)
        .circle(bumpDiam / 2.0)
        .extrude(height - t)
    )
elif lbumps > 1:
    tmp = (
        tmp.rarray(pitch, pitch, lbumps - 1, 1, center=True)
        .circle(t)
        .extrude(height - t)
    )
elif wbumps > 1:
    tmp = (
        tmp.rarray(pitch, pitch, 1, wbumps - 1, center=True)
        .circle(t)
        .extrude(height - t)
    )
else:
    tmp = s""",
    ),
]


_design_steps = """
1. **Model Construction Steps**
   - **Setting the Workplane**:
     - Use the `Workplane()` method to select the appropriate workplane (e.g., "XY", "XZ", "YZ").
     - If necessary, offset the plane using `workplane(offset=value)`.
     - **Note**: The workplane serves as the basis for sketches and operations, so it's crucial to set it correctly. Choosing the wrong plane may result in shapes being created in unintended positions.
   - **Drawing Basic Shapes**:
     - Use methods like `circle()`, `rect()`, `polygon()` to draw 2D shapes.
     - Specify dimensions (e.g., radius, width, height) clearly.
     - **Note**: In CadQuery, the order of method chaining is important. Always set the workplane before drawing shapes, and specify dimensions accurately.
   - **Creating 3D Shapes**:
     - Convert 2D shapes into 3D using methods like `extrude()`, `revolve()`.
     - Specify the direction and distance of extrusion precisely.
     - **Note**: Using negative values will extrude in the opposite direction, so pay attention to the direction.
   - **Adding Details**:
     - **Fillets and Chamfers**:
       - Use the `fillet()`, `chamfer()` methods to process edges.
       - Use selectors like `edges()`, `faces()` to accurately select the edges to apply.
       - **Note**: Incorrect edge selection may result in unintended areas being processed.
     - **Creating Holes and Pockets**:
       - Remove material using methods like `hole()`, `cutBlind()`, `cutThruAll()`.
       - Specify positions and dimensions in detail.
       - **Note**: Before making holes, select the appropriate workplane or face.
     - **Patterning**:
       - Repeat features using methods like `mirror()`, `array()`, `polarArray()`.
       - **Note**: Specify the direction and spacing of repetitions accurately.
   - **Defining Dimensions and Parameters**:
     - Define important dimensions as variables and use them consistently in the code.
     - **Note**: Parameterizing makes it easier to change dimensions later.
   - **Adding Comments**:
     - Add comments to each step to enhance code readability and maintainability.
2. **Setting Constraints**
   - **Dimensional Constraints**:
     - Specify dimensions accurately to ensure model precision.
     - **Note**: CadQuery supports parametric modeling, and changes in dimensions reflect throughout the model.
   - **Geometric Constraints**:
     - Use appropriate sketching techniques to maintain relationships between features.
     - **Note**: CadQuery itself does not have constraint functions within sketches, so dimensions and positions need to be set carefully.
   - **Defining Relationships Between Features**:
     - Position features using methods like `translate()`, `rotate()`, `align()`.
     - **Note**: Specify alignment using absolute or relative coordinates accurately.
3. **Verification and Adjustment**
   - **Model Verification**:
     - Confirm the validity of the model using the `val().isValid()` method.
     - **Note**: If errors occur, check boolean operations and shape consistency.
   - **Making Adjustments**:
     - Change parameters or dimensions and regenerate the model.
     - **Note**: After changing parameters, ensure all related parts are updated correctly.
   - **Error Checking and Debugging**:
     - Review error messages and identify problematic areas.
     - Visualize intermediate results using the `show_object()` method.
     - **Note**: CadQuery errors may not be specific, so check results at each step.
4. **Points Specific to CadQuery**
   - **Order of Method Chaining**:
     - The order of method chaining affects the result, so describe the sequence of operations precisely.
     - **Example**: Set the plane with `workplane()` before drawing shapes with `circle()`.
   - **Using Selectors**:
     - Use appropriate selectors like `faces()`, `edges()`, `vertices()` when selecting specific parts of the shape.
     - **Note**: Ambiguous selector specifications may result in unintended parts being selected.
   - **Workplane Context**:
     - Using `workplane()` changes the workplane, affecting subsequent operations.
     - **Note**: Be mindful of which workplane is active for each operation.
   - **Handling Boolean Operations**:
     - Confirm the validity and consistency of shapes when combining them using `union()`, `cut()`, `intersect()`.
     - **Note**: Tiny gaps or overlaps may cause errors.
   - **Ensuring Parametric Design**:
     - Manage all dimensions with variables so that the model updates dynamically.
     - **Note**: Manually entering numbers makes changes difficult later.
"""


class CadCodeGeneratorChain(SequentialChain):
    model_type: MODEL_TYPE = "gpt"

    def __init__(self, model_type: MODEL_TYPE = "gpt") -> None:
        sample_codes = "\n\n".join(
            [f"{explanation}\n```python\n{code}\n```" for explanation, code in _cad_query_examples]
        )
        gen_cad_code_prompt = (
            "You are a highly skilled CAD designer. Please write code that converts the attached 2D CAD image into a 3D CAD model using a Python CAD library called 'cadquery.'\n"
            "## Points to Note\n"
            "* Please use the `cadquery.exporters.export` function to output the created 3D model as a STEP file.\n"
            "* Where you describe the output file path, use the template string `${{output_filename}}`. The 'output_filename' includes the file extension.\n"
            "* Surround the code with a markdown code block.\n"
            "* Refer to the sample code for how to use Cadquery.\n"
            "* Write CAD code following these steps:\n"
            f"{textwrap.indent(_design_steps, prefix='  ')}\n"
            "## Cadquery Sample Code\n"
            f"{sample_codes}\n"
            "## Start here\n"
            "Output code:"
        )
        prompt = ChatPromptTemplate(
            input_variables=["image_type", "image_data"],
            messages=[
                HumanMessagePromptTemplate(
                    prompt=[
                        PromptTemplate(input_variables=[], template=gen_cad_code_prompt),
                        ImagePromptTemplate(
                            input_variables=["image_type", "image_data"],
                            template={"url": "data:image/{image_type};base64,{image_data}"},
                        ),
                    ]
                )
            ],
        )
        llm = ChatModelParameters.from_model_name(model_type).create_chat_model()

        super().__init__(
            chains=[
                LLMChain(prompt=prompt, llm=llm),  # type: ignore
                TransformChain(
                    input_variables=["text"],
                    output_variables=["result"],
                    transform=_parse_code,
                    atransform=None,
                ),
            ],
            input_variables=["image_type", "image_data"],
            output_variables=["result"],
            verbose=True,
        )
        self.model_type = model_type

    def prep_inputs(self, inputs: Union[dict[str, Any], Any]) -> dict[str, str]:
        assert isinstance(inputs, ImageData) or (
            "input" in inputs and isinstance(inputs["input"], ImageData)
        ), "inputs must be ImageData or dict with 'input' and 'input' must be ImageData"
        if isinstance(inputs, ImageData):
            inputs = {"input": inputs}
        if self.model_type == "claude" and inputs["input"].type != "png":
            inputs["input"] = inputs["input"].convert("png")
        inputs["image_type"] = inputs["input"].type
        inputs["image_data"] = inputs["input"].data
        return inputs
