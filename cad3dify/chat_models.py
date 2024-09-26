from typing import Literal

from langchain_core.language_models.chat_models import BaseChatModel
from langchain_openai import ChatOpenAI
from pydantic import BaseModel

MODEL_TYPE = Literal["gpt", "llama"]


class ChatModelParameters(BaseModel):
    provider: str
    model_name: str
    temperature: float

    @classmethod
    def default(cls) -> "ChatModelParameters":
        return cls(
            provider="openai",
            model_name="gpt-4o-2024-08-06",
            temperature=0.0,
            max_tokens=16384,
        )

    @classmethod
    def from_model_name(
        cls,
        model_type: MODEL_TYPE,
        temperature: float = 0.0,
    ) -> "ChatModelParameters":
        model_type_to_parameters = {
            "gpt": cls(
                provider="openai",
                model_name="gpt-4o-2024-08-06",
                temperature=temperature,
            ),
            "llama": cls(
                provider="vertex_ai",
                model_name="meta/llama-3.2-90b-vision-instruct-maas",
                temperature=temperature,
            ),
        }
        return model_type_to_parameters.get(model_type, cls.default())

    def create_chat_model(self) -> BaseChatModel:
        if self.provider == "openai":
            return ChatOpenAI(
                model=self.model_name,
                temperature=self.temperature,
                max_tokens=16384,
            )
        elif self.provider == "vertex_ai":
            from google.auth import default
            from langchain_google_vertexai.model_garden_maas.llama import (
                VertexModelGardenLlama,
            )

            credentials, _ = default(scopes=["https://www.googleapis.com/auth/cloud-platform"])
            return VertexModelGardenLlama(
                model_name=self.model_name,
                temperature=self.temperature,
                credentials=credentials,
            )
        else:
            raise ValueError(f"provider {self.provider} is not supported.")
