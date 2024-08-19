import streamlit as st
from PIL import Image

from cad3dify import generate_step_from_2d_cad_image


st.title("2D図面 to 3DCAD")

uploaded_file = st.sidebar.file_uploader("画像ファイルを選択してください", type=["jpg", "jpeg", "png"])

# 画像がアップロードされたら表示
if uploaded_file is not None:
    image = Image.open(uploaded_file)
    st.image(image, caption="アップロードされた画像", use_column_width=True)
    st.write("画像のサイズ: ", image.size)
    with open("temp.png", "wb") as f:
        f.write(uploaded_file.getbuffer())
    with st.spinner("画像を処理中..."):
        generate_step_from_2d_cad_image("temp.png", "output.step")
    st.success("3DCADデータの生成が完了しました。")
else:
    st.write("画像がアップロードされていません。")
