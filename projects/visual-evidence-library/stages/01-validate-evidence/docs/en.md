# Validate image paths and text rectangles

> Preserve where a text assertion came from before indexing it.

**Type:** Build  
**Language:** Python  
**Stage:** 1 of 4  
**Time:** About 2 hours

## What you are building

A search result can only be as trustworthy as its evidence record. An asset has an ID, local path, width, height and regions. A region has its own ID, text, a rectangle [x,y,width,height] and an origin. The manifest is a set of assertions supplied by a person or reviewed after model extraction.

```figure
pj-visual-evidence-library-1
```

## Work through an example

For a 600 by 320 sign, [45,130,510,45] ends at x=555 and y=175, so it is inside the image. [590,130,30,45] crosses the right edge and must fail. A negative width is not a way to express a mirrored box.

Before coding, write down the returned fields for that example and one input that should fail. Keep the expected result beside your implementation so you can distinguish a contract change from a bug.

## Implement the contract

- `validate_manifest(manifest: dict, root: Path) -> list[dict]`

Require unique asset IDs and unique region IDs within each asset. Dimensions are integers from 1 to 20000. Rectangles contain four finite nonboolean numbers, with positive width and height and no edge outside the image. Resolve every path under root, including symlinks. Require a supported existing image no larger than 5 MB. Model-proposed regions require reviewed=True before indexing.

Keep earlier stages working. Implement these functions in your learner workspace, leaving the reference solution closed while you work through the example.

## Hints and failure cases

Resolve the root and candidate path before checking containment. Compare x+w and y+h with the declared bounds. Explicitly reject bool even though Python treats it as an integer. Keep the resolved path as an internal field, not portable report data.

## Run your stage

Initialize once from the repository root, then run the cumulative tests:

```bash
python3 scripts/project_test.py visual-evidence-library --init my-visual-evidence-library
python3 scripts/project_test.py visual-evidence-library --stage 1 --path my-visual-evidence-library
```

The starter deliberately raises an implementation error. Later initialization preserves your source rather than replacing it. A passing result requires every selected test to run; a skipped test is not completion evidence.

## Check your reasoning

Which checks establish structural validity, and which claims still require looking at the actual image? Why does valid geometry not prove the text is correct?

## Connect it to the finished artifact

A standalone HTML evidence gallery with highlighted rectangles and evidence.json for reuse. The offline core indexes provided OCR metadata; it does not read pixels or perform OCR. The included SVG signs and metadata were authored for this project. Query coverage is lexical overlap, not confidence that the image says something. Dimensions and supplied text remain human assertions.

After completing the project, try your own inputs:

```bash
cd my-visual-evidence-library
python3 main.py --manifest ./fixtures/manifest.json --query "return dry seeds" --out ./visual-output
```

Add a dimension reader for a single image format and compare actual dimensions with the declaration. Do not replace the supplied-text provenance label.

## Primary reference

[Official API documentation](https://docs.python.org/3/library/xml.etree.elementtree.html). The implementation, examples and fixtures are original. The reference explains the underlying API; the project-specific policies are stated above.
