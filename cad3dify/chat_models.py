from typing import Literal

try:
    import os

    import vertexai
    vertexai.init(project=os.environ["VERTEXAI_PROJECT"], location=os.environ["VERTEXAI_LOCATION"])
except KeyError:
    print("VertexAI is not initialized. Please set VERTEXAI_PROJECT and VERTEXAI_LOCATION environment variables.")
except Exception as e:
    pass
from langchain_anthropic import ChatAnthropic
from langchain_core.language_models.chat_models import BaseChatModel
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_openai import ChatOpenAI
from pydantic import BaseModel

MODEL_TYPE = Literal["gpt", "claude", "gemini", "llama"]
PROVIDER_TYPE = Literal["openai", "anthropic", "google", "vertex_ai"]


class ChatModelParameters(BaseModel):
    provider: PROVIDER_TYPE
    model_name: str
    temperature: float
    max_tokens: int | None = None

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
                model_name="gpt-4.1-2025-04-14",
                temperature=temperature,
                max_tokens=16384,
            ),
            "claude": cls(
                provider="anthropic",
                model_name="claude-3-7-sonnet-20250219",
                temperature=temperature,
                max_tokens=8192,
            ),
            "gemini": cls(
                provider="google",
                model_name="gemini-2.0-flash-exp",
                temperature=temperature,
                max_tokens=8192,
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
                max_tokens=self.max_tokens,
            )
        elif self.provider == "anthropic":
            return ChatAnthropic(
                model=self.model_name,
                temperature=self.temperature,
                max_tokens=self.max_tokens,
            )
        elif self.provider == "google":
            return ChatGoogleGenerativeAI(
                model=self.model_name,
                temperature=self.temperature,
                max_tokens=self.max_tokens,
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
