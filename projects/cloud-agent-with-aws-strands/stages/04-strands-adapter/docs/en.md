# Drive the actual Strands loop with a local model

Stage 4 of 4. Read the [project prerequisites](../../../README.md) before starting; this stage builds on the preceding contracts.

## What changes

The real Strands Agent consumes streaming events from an injected Model subclass. This exercises the framework loop without credentials or cloud calls. The model still only proposes a plan; parse and scope-check its result with the earlier validator. A separate Bedrock constructor is explicit and is not invoked by offline demos or tests.

## Work through one concrete case

The optional Strands Agent emits a JSON plan through its real streaming Model interface. That proposed plan then passes through the same scope validator, retry wrapper and bounded executor used by cli.py.

```figure
pj-cloud-agent-with-aws-strands-4
```

Change the lab inputs and calculate the result before reading its metrics. The figure computes from those inputs; the implementation tests below remain the source of completion evidence.

## Implement the contract

Implement `strands_adapter.py`: `parse_model_plan`, `run_strands`, `bedrock_agent`. This artifact is stage 4 of Cloud Agent With AWS Strands. It consumes explicit inputs and returns an inspectable result that the next stage can use.

Use the [public API contract](../../../API.md) and the typed starter signatures. Return values from core functions and let the supplied driver own file input, argument parsing and presentation.

Keep three modes explicit: pure offline core, installed-SDK local-model comparison, and opt-in AWS reads. An installed SDK passing a fake-model test is useful integration evidence but says nothing about IAM or Bedrock availability.

## Verify and inspect

From the repository root, initialize once with `python3 scripts/project_test.py cloud-agent-with-aws-strands --init learning-artifacts/cloud-agent-with-aws-strands`. Then grade cumulatively:

```bash
python3 scripts/project_test.py cloud-agent-with-aws-strands --stage 4 --path learning-artifacts/cloud-agent-with-aws-strands --strict
```

A fresh workspace should fail until you implement the contract. After every stage is complete, run your actual artifact from the supplied sample:

```bash
cd learning-artifacts/cloud-agent-with-aws-strands
python3 cli.py samples/input.json --output incident.json
```

## Investigate the failure boundary

Run the sample through cli.py and inspect cached=true on the repeated metrics read. Then run --optional --strict with the pinned SDK to exercise framework events without sending cloud requests.

Default mode reads the supplied recording. --mode aws is an opt-in AWS CLI adapter for ECS services, CloudWatch CPU and bounded log reads; it requires caller configuration, credentials and AWS permissions. No deployment or live verification is implied.

## Verify the actual framework

The five default stage tests check the adapter contract without importing the SDK. Install the pinned optional dependency, then include the five real-SDK tests explicitly:

```bash
python3 -m venv .venv
.venv/bin/python -m pip install -r projects/cloud-agent-with-aws-strands/requirements-framework.txt
.venv/bin/python scripts/project_test.py cloud-agent-with-aws-strands --solution --optional --strict
.venv/bin/python projects/cloud-agent-with-aws-strands/solution/framework_demo.py
```

Use `--path my-cloud-agent-with-aws-strands` instead of `--solution` to grade your implementation. Missing dependencies produce a skip in optional mode and a failure in strict optional mode. The verified SDK version is `strands-agents==1.57.1`; all model replies are local fixtures.

## References

[Reference 1](https://strandsagents.com/docs/user-guide/concepts/model-providers/custom_model_provider/)
