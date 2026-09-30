# Fingerprint normalized records

Stage 1 of 4. Read the [project prerequisites](../../../README.md) before starting; this stage builds on the preceding contracts.

## What changes

A random split can place the same example in both train and test under different ids. Normalize Unicode, whitespace, and case before hashing the content. Keep ids separate from content fingerprints so renamed records still collide.

Normalization is an explicit policy. It detects exact normalized duplicates, not paraphrases, images, or semantically equivalent code. Hashing does not make content anonymous when the input space is guessable.

## Work through one concrete case

The strings "Ｒetry  NOW" and "retry now" normalize to the same text under NFKC, case folding and whitespace collapse. Their record ids may differ, but their content fingerprints must agree.

```figure
pj-dataset-split-auditor-1
```

Change the lab inputs and calculate the result before reading its metrics. The figure computes from those inputs; the implementation tests below remain the source of completion evidence.

## Implement the contract

Implement `fingerprint` against the stated contract.

Use the [public API contract](../../../API.md) and the typed starter signatures. Return values from core functions and let the supplied driver own file input, argument parsing and presentation.

Apply normalization before UTF-8 encoding and hashing. Never hash a dictionary representation, whose ordering and incidental metadata change independently of content.

## Verify and inspect

From the repository root, initialize once with `python3 scripts/project_test.py dataset-split-auditor --init learning-artifacts/dataset-split-auditor`. Then grade cumulatively:

```bash
python3 scripts/project_test.py dataset-split-auditor --stage 1 --path learning-artifacts/dataset-split-auditor --strict
```

A fresh workspace should fail until you implement the contract. After every stage is complete, run your actual artifact from the supplied sample:

```bash
cd learning-artifacts/dataset-split-auditor
python3 cli.py samples/input.json --output split-audit.json --html split-audit.html
```

## Investigate the failure boundary

Try "retry now!". Punctuation remains meaningful, so this contract should not claim that it matches "retry now".




## References

[Primary technical reference](https://scikit-learn.org/stable/common_pitfalls.html)
