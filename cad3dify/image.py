import base64
import os
from typing import Literal

from pydantic import BaseModel

ImageTypes = Literal["jpg", "jpeg", "png", "gif"]


class ImageData(BaseModel):
    """画像データのクラス

    Args:
        data (str): 画像データ(base64エンコード)
        type (ImageTypes): 画像の拡張子
    """

    data: str
    type: ImageTypes

    @classmethod
    def load_from_file(cls, file_path: str) -> "ImageData":
        """ファイルから画像データを読み込む

        Args:
            file_path (str): 画像ファイルのパス

        Returns:
            ImageData: 画像データ
        """
        with open(file_path, "rb") as f:
            data = base64.b64encode(f.read()).decode("utf-8")
        return cls(data=data, type=os.path.splitext(file_path)[1][1:])
