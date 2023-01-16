import argparse
import os
import subprocess
from ntpath import basename

import onnx
from onnx import version_converter


def convert(infile, outdir):
    original_model = onnx.load(infile)
    converted_model = version_converter.convert_version(original_model, 17)

    infile_name = basename(infile)
    converted_file = os.path.join(outdir, infile_name.replace(".onnx", "-upver.onnx"))
    onnx.save(converted_model, converted_file)

    subprocess.run(
        [
            "python3",
            "-m",
            "onnxruntime.tools.convert_onnx_models_to_ort",
            converted_file,
            "--output_dir",
            outdir,
            "--optimization_style",
            "Fixed",
        ]
    )


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--infile", type=str, required=True)
    parser.add_argument("--outdir", type=str, required=True)
    args = parser.parse_args()
    convert(args.infile, args.outdir)
