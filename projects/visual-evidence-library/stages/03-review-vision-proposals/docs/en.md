# Keep extraction proposals separate from labels

> Call an optional vision endpoint and require review before indexing.

**Type:** Build  
**Language:** Python  
**Stage:** 3 of 4  
**Time:** About 2 hours

## What you are building

A model can propose visible text and can also classify an image as a sign or diagram. These are different outputs. A classification label has no text rectangle and must never become OCR evidence. Validate the transport and schema first, then require a person to inspect each proposed text span against the image.

```figure
pj-visual-evidence-library-3
```

## Work through an example

A provider returning regions=[{text: Return tools, bbox: [40,120,200,40]}] and labels=[notice] yields one model-proposed region with reviewed=False. The label notice stays in classification_labels. If a proposed box extends beyond the image, reject the proposal rather than clipping it into apparent validity.

Before coding, write down the returned fields for that example and one input that should fail. Keep the expected result beside your implementation so you can distinguish a contract change from a bug.

## Implement the contract

- `validate_proposal(proposal: dict, width: int, height: int) -> dict`
- `request_vision(path, endpoint, model, width, height, api_key="") -> dict`

Return regions, classification_labels, status=review-required and a clear warning. Region IDs are assigned deterministically. Reject malformed, empty or out-of-bounds regions and nonstring labels. The HTTP adapter sends actual image bytes in a data URL to the configured chat-completions endpoint, with a timeout and response-size check. Support only PNG/JPEG uploads with matching signatures; SVG fixtures remain offline.

Keep earlier stages working. Implement these functions in your learner workspace, leaving the reference solution closed while you work through the example.

## Hints and failure cases

Make the provider URL explicit. In tests, inspect the JSON request and return a controlled envelope with choices[0].message.content. A passing mock or local-wire test proves serialization and validation, not that a real model reads text accurately.

## Run your stage

Initialize once from the repository root, then run the cumulative tests:

```bash
python3 scripts/project_test.py visual-evidence-library --init my-visual-evidence-library
python3 scripts/project_test.py visual-evidence-library --stage 3 --path my-visual-evidence-library
```

The starter deliberately raises an implementation error. Later initialization preserves your source rather than replacing it. A passing result requires every selected test to run; a skipped test is not completion evidence.

## Check your reasoning

What remains unverified after valid JSON is received? Why does setting reviewed=True represent a human assertion rather than a model confidence threshold?

## Connect it to the finished artifact

A standalone HTML evidence gallery with highlighted rectangles and evidence.json for reuse. The offline core indexes provided OCR metadata; it does not read pixels or perform OCR. The included SVG signs and metadata were authored for this project. Query coverage is lexical overlap, not confidence that the image says something. Dimensions and supplied text remain human assertions.

After completing the project, try your own inputs:

```bash
cd my-visual-evidence-library
python3 main.py --manifest ./fixtures/manifest.json --query "return dry seeds" --out ./visual-output
```

Store reviewer name and review time in a separate local review log. Evaluate character errors and rectangle overlap against a held-out human-labeled set.

## Primary reference

[Official API documentation](https://docs.python.org/3/library/xml.etree.elementtree.html). The implementation, examples and fixtures are original. The reference explains the underlying API; the project-specific policies are stated above.
