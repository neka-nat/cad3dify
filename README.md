# cad3dify

Using GPT-4.1 (or Claude 3.7 sonnet, Gemini 2.0 flash, Llama 3.2 on Vertex AI), generate a 3D CAD model (STEP file) from a 2D CAD image.

## Getting started

Installation.

```bash
git clone git@github.com:neka-nat/cad3dify.git
cd cad3dify
poetry install
```

Run script.
A STEP`file ("output.step") will be generated.

```bash
cd scripts
export OPENAI_API_KEY=<YOUR API KEY>
python cli.py <2D CAD Image File>
```

Or run streamlit spp

```bash
streamlit run scripts/app.py
streamlit run scripts/app.py -- --model_type claude  # Use Claude 3.7 sonnet
streamlit run scripts/app.py -- --model_type gemini  # Use Gemini 2.0 flash
streamlit run scripts/app.py -- --model_type llama  # Use Llama 3.2 on Vertex AI
```

## Architecture

```mermaid
graph TD
    Input[Input Image] --> CodeGenerator[CAD Code Generator AI Agent]
    CodeGenerator --> PythonDebugger[Python Execution and Debugging AI Agent]
    PythonDebugger --> StepFile[STEP File]
    StepFile --> Rendering[Rendering 3D CAD Model Image from STEP File]
    Rendering --> Refiner[CAD Code Refiner AI Agent]
    Refiner --> StepFile
```

## Demo

We will use the sample file [here](http://cad.wp.xdomain.jp/).

### Input image

![input](sample_data/g1-3.jpg)

### Generated 3D CAD model

![output](sample_data/gen_result1.png)
