from cad3dify import generate_step_from_2d_cad_image


def main():
    import argparse
    parser = argparse.ArgumentParser()
    parser.add_argument("image_filepath", type=str, help="Path to the image file")
    parser.add_argument("--output_filepath", type=str, default="output.step", help="Path to the output STEP file")
    args = parser.parse_args()

    generate_step_from_2d_cad_image(args.image_filepath, args.output_filepath)


if __name__ == "__main__":
    main()
