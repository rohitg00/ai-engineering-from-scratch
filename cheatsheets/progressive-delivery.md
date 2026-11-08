---
id: progressive-delivery
title: Shadow, Canary and A/B Tests for LLMs
code: SC
subtitle: Shadow runs, canary gates, fast rollback, sequential A/B tests, chaos guards and config drift reports.
hue: 28
sources: phases/17-infrastructure-and-production/20-shadow-canary-progressive, phases/17-infrastructure-and-production/21-ab-testing-llm-features, phases/17-infrastructure-and-production/24-chaos-engineering-llm, projects/configuration-drift-explainer
source_hash: 496849859cbd8fe9
---

## Rollout sequence
type: flow
from: phases/17-infrastructure-and-production/20-shadow-canary-progressive/docs/en.md

1. **Shadow**: the candidate gets copies of production requests. Outputs go to logs, not to users.
2. **Shadow log**: diff the output. Log token counts, latency, refusals and errors.
3. **Canary**: shift traffic 1%, 10%, 25%, 50%, 75%, 100%.
4. **Gates**: check five metrics at each step, every 5 to 15 minutes.
5. **A/B**: optional. Run it at 50% when the new model is distinctly different.
6. **Promote**: go to 100% when all canary gates pass.
7. **Rollback**: revert the flag. Set the pinned digest to the previous model.

## Canary gates in the simulator
type: defaults
from: phases/17-infrastructure-and-production/20-shadow-canary-progressive/code/main.py, phases/17-infrastructure-and-production/20-shadow-canary-progressive/docs/en.md

| Setting | Default | Note |
|---|---|---|
| `STAGES` | 0.01, 0.10, 0.25, 0.50, 0.75, 1.00 | Six traffic shares |
| `latency_p99_ms` | 1.5 | Baseline 900 ms |
| `cost_per_req` | 1.2 | Baseline 0.02. Breach above 20% |
| `error_rate` | 2.0 | 5xx plus explicit refusals |
| `output_len_p99` | 1.4 | Baseline 450 tokens |
| `thumbs_down_rate` | 1.5 | Baseline 0.03 |
| `rng.uniform` noise | 0.92, 1.08 | Noise on each measured metric |

## Run the labs
type: task-table
from: phases/17-infrastructure-and-production/20-shadow-canary-progressive/code/main.py, phases/17-infrastructure-and-production/21-ab-testing-llm-features/code/main.py, phases/17-infrastructure-and-production/24-chaos-engineering-llm/code/main.py

| Task | Code |
|---|---|
| Canary simulator, lesson 20 | `code/main.py` |
| Inject a 25% cost regression | `Regression(cost_mult=1.25)` |
| Inject an 80% latency regression | `Regression(latency_mult=1.80)` |
| Check one stage against the gates | `check_gates(metrics)` |
| Sequential A/B simulator, lesson 21 | `code/main.py` |
| Sample size at 80% power | `fixed_sample_size(baseline, lift)` |
| Simulate a 5% lift | `simulate(0.03, 0.0315)` |
| Chaos runner, lesson 24 | `run_experiment(e)` |

## Rollout and A/B terms
type: concepts
from: phases/17-infrastructure-and-production/20-shadow-canary-progressive/docs/en.md, phases/17-infrastructure-and-production/21-ab-testing-llm-features/docs/en.md

- **Shadow mode**: zero user impact. A smoke test, not a quality test.
- **Canary**: gradual rollout to real users, with metric gates.
- **Non-determinism**: up to 15% accuracy variation run to run on identical inputs.
- **Policy flag**: rollback in config. It takes seconds, not hours.
- **Model pin**: immutable registry digest. It does not auto-upgrade.
- **Eval vs A/B**: an eval asks "can the model do the job?" An A/B test asks "do users care?"
- **CUPED**: regress out pre-period variance. Typical reduction is 30-70%.
- **SRM**: sample ratio mismatch. A 50/50 split that gives 47/53 is broken.

## Sequential stop rule
type: annotated-code
lang: python
from: phases/17-infrastructure-and-production/21-ab-testing-llm-features/code/main.py

```python
required = fixed_sample_size(baseline, lift)  # 80% power, alpha 0.05
adjusted = int(required * 1.4)  # LLM non-determinism buffer
if n_a > 100 and n_b > 100 and sequential_stopped_at is None:
    z = z_statistic(success_a, n_a, success_b, n_b)
    n_total = n_a + n_b
    threshold = math.sqrt(2 * math.log(1 / 0.05) + math.log(n_total))  # grows with log(n)
    if abs(z) > threshold:
        sequential_stopped_at = n_total  # stop early on a clear winner
```

## Chaos planes
type: architecture
from: phases/17-infrastructure-and-production/24-chaos-engineering-llm/docs/en.md

```arch
node | control | 1,1 | Control plane | experiment scheduler | process
node | target | 2,1 | Target plane | services, pods, data stores | process
node | obs | 2,2 | Observability plane | trace-ID correlation | store
node | safety | 1,2 | Safety plane | kill switch, budget gates | process
node | feedback | 3,2 | Feedback loop | SLO, runbooks, code fixes | store
edge | control | target | inject fault
edge | target | obs | metrics, traces, logs
edge | obs | safety | burn rate
edge | safety | control | abort
edge | obs | feedback | findings
```

## Chaos runner experiments
type: command-table
from: phases/17-infrastructure-and-production/24-chaos-engineering-llm/code/main.py

| Command | What it does |
|---|---|
| `ERROR_BUDGET_PER_DAY = 0.001` | 99.9% SLO |
| `EXPECTED_ERROR_RATE = 0.0005` | Baseline error rate |
| `burn_rate > 2.0` | First half of the abort rule |
| `e.blast_radius_pct > 0.2` | Second half. Both must be true |
| `pod kill (1 decode replica)` | 5 min, 5% blast. Completes |
| `provider 429 fallback` | 5 min, 30% blast. Aborts |
| `malformed prompt tokenizer stall` | 3 min, 10% blast. Completes |

## Drift explainer commands
type: command-table
span: 2
from: projects/configuration-drift-explainer/README.md

| Command | What it does |
|---|---|
| `go run . --input fixtures/config.json --out /tmp/drift.json` | Write the drift report to a file |
| `go build -o /tmp/drift-explainer .` | Build the binary |
| `/tmp/drift-explainer --input fixtures/config.json --check` | Return 2 when drift exists |
| `python3 scripts/project_test.py configuration-drift-explainer --init <work>` | Make a fresh starter |
| `python3 scripts/project_test.py configuration-drift-explainer --stage 1 --path <work> --strict` | Grade one stage |
| `python3 scripts/project_test.py configuration-drift-explainer --all --solution --strict` | Grade the reference solution |

## Drift report
type: concepts
from: projects/configuration-drift-explainer/solution/main.go, projects/configuration-drift-explainer/README.md

- **Input**: `layers`, `observed` and optional `sensitive`. Later layers win.
- **equal**: the effective value and the observed value match.
- **changed**: the values differ under `reflect.DeepEqual`.
- **missing**: the layers declare the key. The observed config does not.
- **unexpected**: the observed config has a key that no layer declares.
- **History**: every layer that set the key, in order. Shadowed values stay.
- **Redaction**: password, secret, token, api-key and credential names become `[REDACTED]`.
- **Output**: `schemaVersion` 1. The file has owner-only permissions `0600`.

## Troubleshooting
type: troubleshooting
from: phases/17-infrastructure-and-production/20-shadow-canary-progressive/docs/en.md, phases/17-infrastructure-and-production/21-ab-testing-llm-features/docs/en.md, phases/17-infrastructure-and-production/24-chaos-engineering-llm/docs/en.md, projects/configuration-drift-explainer/README.md

| Symptom | Cause | Fix |
|---|---|---|
| Cost up 40% a day after the flip | No shadow or canary step | Shadow first. Gate cost at 20% over baseline |
| Rollback takes 3 hours | Rollback needs a redeploy | Flip the policy flag. Pin the old digest |
| Canary gates false alarm | Gates sit inside the noise floor | Set gates above the noise floor |
| Feedback gate noisy at 1% | Only 50-150 data points per window | Pause longer at each step |
| 50/50 split gives 47/53 | SRM. Assignment is broken | Fix the assignment hash first |
| A/B never reaches significance | Non-determinism lowers effective sample size | Multiply sample size by 1.3 to 1.5 |
| OOM after provider 429s | Gateway retries amplify concurrency | Inject one provider 429 for 5 minutes |
| Secret value in the drift report | Innocent key name hides a secret | Add the key to `sensitive` |

## Q&A
type: qa
from: phases/17-infrastructure-and-production/20-shadow-canary-progressive/docs/en.md, phases/17-infrastructure-and-production/21-ab-testing-llm-features/docs/en.md, phases/17-infrastructure-and-production/24-chaos-engineering-llm/code/main.py, projects/configuration-drift-explainer/README.md

- **Does shadow mode prove quality?** No. It catches cost, length, refusal and hard errors only.
- **When do you skip the A/B step?** When the new model is only an improved version.
- **Is "stable" equal to baseline?** No. Stable means within expected variance.
- **20 tests at 95% confidence?** One false positive by chance. Use Bonferroni or Benjamini-Hochberg.
- **Which chaos experiment aborts?** Provider 429. Burn rate is over 2.0 and blast radius is over 20%.
- **What does `--check` return on drift?** Exit status 2.

## Tips
type: tips
from: phases/17-infrastructure-and-production/20-shadow-canary-progressive/docs/en.md, phases/17-infrastructure-and-production/24-chaos-engineering-llm/docs/en.md, projects/configuration-drift-explainer/README.md

- Fix the rollback path before you roll. It must not need a redeploy.
- Track cost per request. A 20% better model can cost 3x per call.
- Pause chaos when daily error-budget burn exceeds 2x expected.
- First chaos test: pod-kill one decode replica under steady traffic.
- Cadence: weekly canary, monthly game day, quarterly audit.
- Put named source identifiers in layer names, never secret values.
