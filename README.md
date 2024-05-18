# cad3dify

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

## Demo

We will use the sample file [here](http://cad.wp.xdomain.jp/).

### Input image

![input](sample_data/g1-3.jpg)

### Generate CAD

![output](sample_data/gen_result1.png)
