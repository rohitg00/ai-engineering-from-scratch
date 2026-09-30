# Export evidence you can point to

> Render a portable gallery with exact region overlays and JSON results.

**Type:** Build  
**Language:** Python  
**Stage:** 4 of 4  
**Time:** About 2 hours

## What you are building

The final report should make a result inspectable in one glance. Embed the image and draw a rectangle above it. Convert pixel coordinates to percentages so the overlay remains aligned when the page is narrower than the source image. Keep the original pixel box in JSON for downstream tools.

```figure
pj-visual-evidence-library-4
```

## Work through an example

The seed sign is 600 pixels wide. A box beginning at x=45 starts at 7.5% of the displayed image width; a width of 510 becomes 85%. Resizing the browser changes the displayed pixels while preserving the same image region.

Before coding, write down the returned fields for that example and one input that should fail. Keep the expected result beside your implementation so you can distinguish a contract change from a bug.

## Implement the contract

- `image_data(asset: dict) -> str`
- `export_library(assets, query: str, out: Path) -> dict`

Write index.html and evidence.json. Include query, method, matches and portable asset metadata, excluding resolved filesystem paths. Escape all textual fields. Embed image data so the HTML can travel alone. For SVG, allow only a small documented shape/text subset and strip unsupported attributes; reject unsupported elements such as scripts or foreignObject. Do not render extracted text as HTML.

Keep earlier stages working. Implement these functions in your learner workspace, leaving the reference solution closed while you work through the example.

## Hints and failure cases

Use a positioned wrapper around an image with width:100% and an absolutely positioned overlay. Compare left=x/width and top=y/height separately. A test should decode the embedded SVG and verify event-handler attributes are absent.

## Run your stage

Initialize once from the repository root, then run the cumulative tests:

```bash
python3 scripts/project_test.py visual-evidence-library --init my-visual-evidence-library
python3 scripts/project_test.py visual-evidence-library --stage 4 --path my-visual-evidence-library
```

The starter deliberately raises an implementation error. Later initialization preserves your source rather than replacing it. A passing result requires every selected test to run; a skipped test is not completion evidence.

## Check your reasoning

Which information can a reader verify in the report, and which still depends on the input manifest? What breaks if a rectangle uses screen coordinates rather than source-image coordinates?

## Connect it to the finished artifact

A standalone HTML evidence gallery with highlighted rectangles and evidence.json for reuse. The offline core indexes provided OCR metadata; it does not read pixels or perform OCR. The included SVG signs and metadata were authored for this project. Query coverage is lexical overlap, not confidence that the image says something. Dimensions and supplied text remain human assertions.

After completing the project, try your own inputs:

```bash
cd my-visual-evidence-library
python3 main.py --manifest ./fixtures/manifest.json --query "return dry seeds" --out ./visual-output
```

Add a query form that reads an embedded index locally. Keep model extraction outside the viewer so opening a saved report never initiates an upload.

## Primary reference

[Official API documentation](https://docs.python.org/3/library/xml.etree.elementtree.html). The implementation, examples and fixtures are original. The reference explains the underlying API; the project-specific policies are stated above.
