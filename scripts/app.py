import argparse
import os

import streamlit as st
from PIL import Image
from dotenv import load_dotenv

load_dotenv()
from cad3dify import generate_step_from_2d_cad_image


def parse_args():
    parser = argparse.ArgumentParser()
    parser.add_argument("--model_type", type=str, default="gpt")
    return parser.parse_args()


args = parse_args()

st.title("2D図面 to 3DCAD")

uploaded_file = st.sidebar.file_uploader("画像ファイルを選択してください", type=["jpg", "jpeg", "png"])

# 画像がアップロードされたら表示
if uploaded_file is not None:
    image = Image.open(uploaded_file)
    ext = os.path.splitext(uploaded_file.name)[1]
    st.image(image, caption="アップロードされた画像", use_column_width=True)
    st.write("画像のサイズ: ", image.size)
    with open(f"temp.{ext}", "wb") as f:
        f.write(uploaded_file.getbuffer())
    with st.spinner("画像を処理中..."):
        generate_step_from_2d_cad_image(
            f"temp.{ext}", "output.step", model_type=args.model_type
        )
    st.success("3DCADデータの生成が完了しました。")
else:
    st.write("画像がアップロードされていません。")
