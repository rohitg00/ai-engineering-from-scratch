# Rank matches and preserve the rectangle

> Search region text with transparent lexical query coverage.

**Type:** Build  
**Language:** Python  
**Stage:** 2 of 4  
**Time:** About 2 hours

## What you are building

Index the text of each region separately. A query can match several images or several regions inside one image. Keeping region identity prevents a title match from appearing as though it came from the paragraph below it. The score counts unique query tokens found in that one region.

```figure
pj-visual-evidence-library-2
```

## Work through an example

The query return dry seeds has three unique tokens. A region saying Return dry seeds in paper envelopes matches all three and scores 1. A different sign saying Return tools to the blue shelf matches only return and scores 1/3. The word seed does not automatically match seeds; this is a visible lexical baseline.

Before coding, write down the returned fields for that example and one input that should fail. Keep the expected result beside your implementation so you can distinguish a contract change from a bug.

## Implement the contract

- `terms(text: str) -> set[str]`
- `search(assets, query: str, limit: int = 20) -> list[dict]`

Case-fold Unicode text and tokenize word characters. Empty queries return no matches. Limit must be an integer from 1 to 100. Return asset_id, region_id, original text, bbox, matched_terms, score and origin. Sort by descending score, then asset ID and region ID. Repeated query words do not increase the denominator.

Keep earlier stages working. Implement these functions in your learner workspace, leaving the reference solution closed while you work through the example.

## Hints and failure cases

Use sets for coverage but preserve the original text for display. Test an accented word and a score tie. Keep scores as numbers in JSON, formatting percentages only in the view.

## Run your stage

Initialize once from the repository root, then run the cumulative tests:

```bash
python3 scripts/project_test.py visual-evidence-library --init my-visual-evidence-library
python3 scripts/project_test.py visual-evidence-library --stage 2 --path my-visual-evidence-library
```

The starter deliberately raises an implementation error. Later initialization preserves your source rather than replacing it. A passing result requires every selected test to run; a skipped test is not completion evidence.

## Check your reasoning

Why is a 100% query score not evidence that a region contains the answer to a question? How would phrase matching change the contract?

## Connect it to the finished artifact

A standalone HTML evidence gallery with highlighted rectangles and evidence.json for reuse. The offline core indexes provided OCR metadata; it does not read pixels or perform OCR. The included SVG signs and metadata were authored for this project. Query coverage is lexical overlap, not confidence that the image says something. Dimensions and supplied text remain human assertions.

After completing the project, try your own inputs:

```bash
cd my-visual-evidence-library
python3 main.py --manifest ./fixtures/manifest.json --query "return dry seeds" --out ./visual-output
```

Add a separate optional synonym table and measure precision on manually labeled queries. Show expanded terms so a user can explain unexpected matches.

## Primary reference

[Official API documentation](https://docs.python.org/3/library/xml.etree.elementtree.html). The implementation, examples and fixtures are original. The reference explains the underlying API; the project-specific policies are stated above.
