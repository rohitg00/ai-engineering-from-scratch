# Verify screenshot pixels in Python

Stage 3 of 4. Read the [project prerequisites](../../../README.md) before starting; this stage builds on the preceding contracts.

## What changes

Read the PNG signature, chunk lengths and CRCs, then decompress a bounded image payload. Reverse PNG row filters and count green success pixels. Combine this visual signal with the DOM flag; neither alone is sufficient. This is a narrow pixel-state detector for the authored fixture, not OCR or general vision. Corrupt, oversized, interlaced and unsupported color formats fail explicitly.

The boundary for this stage is `inspectPNG`. Keep earlier stage behavior intact: the final grader runs every stage against the same workspace.

## Work through one concrete case

A4x4 RGB screenshot contains 16 pixels. Four green pixels produce 0.25, while zero green pixels produce 0.0. A valid PNG signature is only the beginning: changing an IHDR byte without changing CRC must fail.

```figure
pj-browser-agent-3
```

Change the lab inputs and calculate the result before reading its metrics. The figure computes from those inputs; the implementation tests below remain the source of completion evidence.

## Implement the contract

Implement `inspectPNG` in your workspace `main.ts`. Read the exported types in the reference only after attempting the contract. Preserve the starter's public names so tests can call your implementation. Return structured values instead of printing inside the core function; the CLI prints the final result.

Use the [public API contract](../../../API.md) and the typed starter signatures. Return values from core functions and let the supplied driver own file input, argument parsing and presentation.

For filter 1, reconstructed byte = stored byte + reconstructed left byte modulo 256. For filter 2, use the previous row. RGB has three bytes per pixel, so left means index-3, not index-1.

## Verify and inspect

From the repository root, initialize once with `python3 scripts/project_test.py browser-agent --init learning-artifacts/browser-agent`. Then grade cumulatively:

```bash
python3 scripts/project_test.py browser-agent --stage 3 --path learning-artifacts/browser-agent --strict
```

A fresh workspace should fail until you implement the contract. After every stage is complete, run your actual artifact from the supplied sample:

```bash
cd learning-artifacts/browser-agent
node cli.ts --task samples/contact.json --output browser-run.json
```

## Investigate the failure boundary

Construct one row with pixels(20,140,80) and(30,150,90). For the red bytes, filter 1 stores 20 then 10; reconstruction must recover 20 then 30. General color detection remains outside this fixture contract.




## References

[Chrome DevTools Protocol](https://chromedevtools.github.io/devtools-protocol/)
[PNG specification](https://www.w3.org/TR/png-3/)
[HTML form controls](https://html.spec.whatwg.org/multipage/forms.html)
