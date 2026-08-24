---
name: skill-release-gate
description: Evaluate an Agent Skill bundle for structural integrity, trigger quality, artifact improvement, script correctness, safety, installed-tree integrity, and target-host portability before release.
license: MIT
metadata:
  lesson: "27"
---

# Skill release gate

Use this skill before publishing or distributing an Agent Skill directory bundle.

## Workflow

1. Resolve `SKILL_ROOT` to the absolute directory containing this installed
   `SKILL.md`. Do not assume the process cwd is the installed bundle.
2. Resolve `TARGET_ROOT` from the original workspace working directory and
   resolve the user-supplied candidate as an absolute `TARGET_BUNDLE`.
3. Read `references/eval-contract.md` from `SKILL_ROOT`.
4. Inspect the positive and near-miss trigger cases in
   `evals/cases.json` under `TARGET_BUNDLE`.
5. Inspect the shared baseline and with-skill assertions in
   `evals/artifacts.json` under `TARGET_BUNDLE`.
6. Inspect the explicit script and safety results in
   `evals/evidence.json` under `TARGET_BUNDLE`.
7. Inspect the declared runtime capabilities in
   `assets/hosts.json` under `TARGET_BUNDLE` and verify the target file hashes
   against its `assets/manifest.json`.
8. For production, replace deterministic predictions, artifacts, evidence,
   and host capabilities with captured results; set all four captured modes;
   and bind every raw trigger observation, both artifacts, the complete
   evidence set, and the non-empty host matrix to non-empty sources and
   matching SHA-256 provenance digests. These local checks can set
   `localEvidenceReady`, but locally recomputable hashes do not prove capture.
9. Obtain an external JSON attestation whose `evidenceRoot` matches the report,
   plus the SHA-256 of its exact bytes from a separate trusted policy or
   release channel. The attestation must be a regular file outside the target
   bundle.
10. Before execution, show the exact resolved argv. The installed evaluator is
    `scripts/evaluate_skill.py` under `SKILL_ROOT`. For the shipped lesson
    fixture, build argv from `python3`, that absolute evaluator path,
    `--fixture-demo`, and the absolute `TARGET_BUNDLE`. For production, use the
    same installed script with `--attestation`,
    `--trusted-attestation-sha256`, and the absolute `TARGET_BUNDLE`, without
    `--fixture-demo`.
11. Return `checksPassed`, `fixturePassed`, `localEvidenceReady`,
    `trustAnchorValid`, `productionReady`, and `passed` with the evidence root,
    evaluation modes, failed checks, precision, recall, every raw trigger
    observation, per-case repeated-run rates, artifact comparison, script and
    safety evidence, installed-tree verification, and portability matrix.
    Include the resolved script path, resolved target path, cwd, exact argv,
    and exit code. Mark unavailable observations unverified.

## Output contract

Return the complete JSON evaluation report. Preserve every layer-specific check and its evidence so a passing aggregate cannot hide a routing, artifact, script, safety, installed-tree, or portability failure. `fixturePassed` reports a successful teaching fixture. `localEvidenceReady` reports only local digest integrity. `passed` is true only when `productionReady` also has a valid out-of-bundle trust anchor.

## Failure behavior

If configuration is invalid, provenance is absent or mismatched, the trusted attestation is missing or invalid, a file hash differs, a required capability is absent, or any production gate fails, stop with a nonzero result and report the failed layer. The explicit `--fixture-demo` path may exit successfully only when `fixturePassed` is true, and it never makes a release claim. Never publish, install elsewhere, repair evidence, create the trust decision, or weaken a threshold automatically.

Do not publish a bundle merely because SKILL.md parses or one positive prompt activates. Do not label a package portable when a target drops required companion files or ignores required runtime extensions.
