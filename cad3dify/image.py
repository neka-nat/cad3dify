import base64
import io
import os
from typing import Literal

from pydantic import BaseModel
from PIL import Image

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

    def merge(self, other: "ImageData") -> "ImageData":
        """2つの画像データをマージする

        Args:
            other (ImageData): マージする画像データ

        Returns:
            ImageData: マージされた画像データ
        """
        img1 = Image.open(io.BytesIO(base64.b64decode(self.data)))
        img2 = Image.open(io.BytesIO(base64.b64decode(other.data)))
        dst = Image.new("RGB", (img1.width + img2.width, img1.height))
        dst.paste(img1, (0, 0))
        dst.paste(img2, (img1.width, 0))
        output = io.BytesIO()
        dst.save(output, format=self.type)
        return ImageData(data=base64.b64encode(output.getvalue()).decode("utf-8"), type=self.type)

    def convert(self, type: ImageTypes) -> "ImageData":
        """画像データを指定された形式に変換する

        Args:
            type (ImageTypes): 変換する形式
        """
        img = Image.open(io.BytesIO(base64.b64decode(self.data)))
        output = io.BytesIO()
        img.save(output, format=type)
        return ImageData(data=base64.b64encode(output.getvalue()).decode("utf-8"), type=type)
