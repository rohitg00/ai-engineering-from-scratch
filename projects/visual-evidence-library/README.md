# Visual Evidence Library

Find text inside screenshots and diagrams with inspectable coordinate evidence.

You build a standalone HTML evidence gallery with highlighted rectangles and evidence.json for reuse. Inputs: A JSON manifest naming local SVG, PNG or JPEG assets, their declared dimensions and explicitly supplied text rectangles.

## Before you start

Python 3.10 or newer. The required core uses standard libraries and runs offline. Python makes file validation, Unicode token search, HTTP payloads and SVG parsing explicit without an OCR framework.

- Work with nested Python dictionaries and lists.
- Understand x/y coordinates and width/height in image pixels.
- Understand the difference between supplied labels and independently observed evidence.

## Build it

```bash
python3 scripts/project_test.py visual-evidence-library --init my-visual-evidence-library
python3 scripts/project_test.py visual-evidence-library --stage 1 --path my-visual-evidence-library
python3 scripts/project_test.py visual-evidence-library --all --solution --strict
```

The first command creates an intentionally incomplete workspace. Later stages extend the same source file; their tests include new held-out inputs. Reference-solution passes verify the examples and do not earn a learner certificate.

## Use it

```bash
cd projects/visual-evidence-library/solution
python3 main.py --manifest ./fixtures/manifest.json --query "return dry seeds" --out ./visual-output
```

Open the resulting index.html locally. Copy the HTML and JSON into your own workflow, or import the named functions from main. The included demo runs the same implementation on original fixtures:

```bash
python3 demo.py
```

## Stages

1. [Validate image paths and text rectangles](stages/01-validate-evidence/docs/en.md)
2. [Rank matches and preserve the rectangle](stages/02-search-text-regions/docs/en.md)
3. [Keep extraction proposals separate from labels](stages/03-review-vision-proposals/docs/en.md)
4. [Export evidence you can point to](stages/04-export-the-gallery/docs/en.md)

## What the result establishes

The offline core indexes provided OCR metadata; it does not read pixels or perform OCR. The included SVG signs and metadata were authored for this project. Query coverage is lexical overlap, not confidence that the image says something. Dimensions and supplied text remain human assertions.

Optional: python3 main.py --vision-image YOUR_IMAGE.png --provider-url http://127.0.0.1:1234/v1/chat/completions --model YOUR_VISION_MODEL --width 600 --height 320 --out ./proposals. VISION_API_KEY supplies authentication if needed. The adapter uploads the selected PNG/JPEG and writes unreviewed regions. Check the actual image, text and coordinates, then explicitly set reviewed=true before adding model-proposed regions to a manifest.

Provider tests use controlled responses or loopback HTTP. They verify request and response contracts, not a model's quality or live service availability. No account connection, outgoing message, recurring task or cloud deployment is configured by this project.

## Make it your own

Replace the authored fixtures with a small export from your workflow and write down the expected result before running it. Preserve a second set of examples for evaluation. A useful before-and-after demonstration should show the input, inspectable intermediate evidence and portable output; it should not substitute a popularity claim for a measured result.

## Primary reference

[Official API documentation](https://docs.python.org/3/library/xml.etree.elementtree.html). All project code, lesson prose and fixtures are original.
