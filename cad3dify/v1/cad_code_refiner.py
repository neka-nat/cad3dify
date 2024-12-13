from typing import Any, Union

from langchain import PromptTemplate
from langchain.chains import LLMChain, SequentialChain, TransformChain
from langchain.prompts import ChatPromptTemplate, HumanMessagePromptTemplate
from langchain_core.prompts.image import ImagePromptTemplate

from .cad_code_generator import _parse_code
from ..chat_models import MODEL_TYPE, ChatModelParameters
from ..image import ImageData


class CadCodeRefinerChain(SequentialChain):
    model_type: MODEL_TYPE = "gpt"

    def __init__(self, model_type: MODEL_TYPE = "gpt") -> None:
        refine_cad_code_prompt = (
            "You are a highly skilled CAD designer. You have created the following code that converts the attached 2D CAD image into a 3D CAD model using a Python CAD library called 'cadquery.'\n"
            "When the CAD model obtained from this code is rendered in 3D, the attached 3D view image is obtained.\n"
            "Please compare this 3D view image with the 2D CAD drawing and modify the code to correct the CAD model.\n"
            "## Code\n"
            "```python\n"
            "{code}\n"
            "```\n"
            "## Start here\n"
            "Corrected code:"
        )
        if model_type in ["gpt", "claude", "gemini"]:
            prompt = ChatPromptTemplate(
                input_variables=[
                    "code",
                    "original_image_type",
                    "original_image_data",
                    "rendered_image_type",
                    "rendered_image_data",
                ],
                messages=[
                    HumanMessagePromptTemplate(
                        prompt=[
                            PromptTemplate(input_variables=["code"], template=refine_cad_code_prompt),
                            ImagePromptTemplate(
                                input_variables=["original_image_type", "original_image_data"],
                                template={
                                    "url": "data:image/{original_image_type};base64,{original_image_data}",
                                },
                            ),
                            ImagePromptTemplate(
                                input_variables=["rendered_image_type", "rendered_image_data"],
                                template={
                                    "url": "data:image/{rendered_image_type};base64,{rendered_image_data}",
                                },
                            ),
                        ]
                    )
                ],
            )
        elif model_type == "llama":
            prompt = ChatPromptTemplate(
                input_variables=[
                    "code",
                    "original_and_rendered_image_type",
                    "original_and_rendered_image_data",
                ],
                messages=[
                    HumanMessagePromptTemplate(
                        prompt=[
                            PromptTemplate(input_variables=["code"], template=refine_cad_code_prompt),
                            ImagePromptTemplate(
                                input_variables=["original_and_rendered_image_type", "original_and_rendered_image_data"],
                                template={
                                    "url": "data:image/{original_and_rendered_image_type};base64,{original_and_rendered_image_data}",
                                },
                            ),
                            
                        ]
                    )
                ],
            )
        else:
            raise ValueError(f"Invalid model type: {model_type}")
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
            input_variables=prompt.input_variables,
            output_variables=["result"],
            verbose=True,
        )
        self.model_type = model_type

    def prep_inputs(self, inputs: Union[dict[str, Any], Any]) -> dict[str, str]:
        assert (
            "original_input" in inputs
            and isinstance(inputs["original_input"], ImageData)
            and "rendered_result" in inputs
            and isinstance(inputs["rendered_result"], ImageData)
            and "code" in inputs
            and isinstance(inputs["code"], str)
        ), "inputs must have 'original_input' and 'rendered_result' and 'code' keys"
        if self.model_type in ["gpt", "claude", "gemini"]:
            if self.model_type == "claude" and inputs["original_input"].type != "png":
                # if the image type is not png and the model is claude, convert it to png.
                inputs["original_input"] = inputs["original_input"].convert("png")
                inputs["rendered_result"] = inputs["rendered_result"].convert("png")
            inputs["original_image_type"] = inputs["original_input"].type
            inputs["original_image_data"] = inputs["original_input"].data
            inputs["rendered_image_type"] = inputs["rendered_result"].type
            inputs["rendered_image_data"] = inputs["rendered_result"].data
        elif self.model_type == "llama":
            inputs["original_and_rendered_image_type"] = inputs["original_input"].type
            inputs["original_and_rendered_image_data"] = inputs["original_input"].merge(
                inputs["rendered_result"]
            )
        else:
            raise ValueError(f"Invalid model type: {self.model_type}")
        inputs["code"] = inputs["code"]
        return inputs
