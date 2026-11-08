---
id: fairness-privacy
title: Bias, Fairness and Differential Privacy
code: BF
subtitle: Measure bias, pick a fairness criterion, train with DP-SGD and audit the privacy claim. Stdlib Python toys.
hue: 285
sources: phases/18-ethics-safety-alignment/20-bias-representational-harm, phases/18-ethics-safety-alignment/21-fairness-criteria-group-individual-counterfactual, phases/18-ethics-safety-alignment/22-differential-privacy-for-llms
source_hash: d3fc9ec6c40299a3
---

## Three fairness families side by side
type: comparison
span: 2
from: phases/18-ethics-safety-alignment/21-fairness-criteria-group-individual-counterfactual/docs/en.md

| Factor | Group fairness | Individual fairness | Counterfactual fairness |
|---|---|---|---|
| Rule | Equal rates across protected groups | Similar individuals get similar decisions | Decision unchanged when sensitive attributes change |
| Source | Demographic parity, equalized odds, CUAE | Dwork et al. 2012 | Kusner et al. 2017 |
| Needs | Group labels and outcomes | A similarity metric d | A causal DAG |
| Formal test | Equal rates per group | Lipschitz constant L | Counterfactual alteration |
| Weak point | Criteria conflict under unequal base rates | Defining d is a policy question | Only as justified as the DAG |

## Use each criterion when
type: tips
from: phases/18-ethics-safety-alignment/21-fairness-criteria-group-individual-counterfactual/docs/en.md

- Use demographic parity when the claim is equal acceptance rates.
- Use equalized odds when the claim is equal TPR and FPR across groups.
- Use conditional use accuracy equality when the claim is equal predictive value.
- Use individual fairness when you can define a task-specific metric d.
- Use counterfactual fairness when you have a causal DAG of the population.
- Use backtracking counterfactuals when the law forbids interventions on protected attributes.

## Formulas
type: concepts
from: phases/18-ethics-safety-alignment/21-fairness-criteria-group-individual-counterfactual/docs/en.md, phases/18-ethics-safety-alignment/22-differential-privacy-for-llms/docs/en.md, phases/18-ethics-safety-alignment/20-bias-representational-harm/code/main.py

- **Demographic parity**: P(Y=1 | A=a) = P(Y=1 | A=a') for all groups.
- **Equalized odds**: P(Y=1 | Y*=y, A=a) = P(Y=1 | Y*=y, A=a').
- **Conditional use accuracy**: P(Y*=y | Y=y, A=a) = P(Y*=y | Y=y, A=a').
- **Individual fairness**: |f(x) - f(x')| <= L * d(x, x')
- **(ε, δ)-DP**: $P(M(D) \in S) \le e^{\varepsilon} \cdot P(M(D') \in S) + \delta$
- **WEAT term**: s(w, X, Y) = mean cosine(w, X) - mean cosine(w, Y)
- **WEAT effect**: mean_a(s) - mean_b(s) over identity groups.

## DP-SGD recipe
type: flow
from: phases/18-ethics-safety-alignment/22-differential-privacy-for-llms/docs/en.md

1. **Sampler**: sample a mini-batch.
2. **Trainer**: compute per-example gradients.
3. **Clipper**: clip each per-example gradient to a threshold C.
4. **Noise**: sum the clipped gradients and add Gaussian noise with std $\sigma \cdot C$.
5. **Optimizer**: use the noisy sum to update parameters.
6. **Accountant**: track the privacy cost with Moments Accountant or Rényi DP accountant.

## Where bias is measured
type: architecture
from: phases/18-ethics-safety-alignment/20-bias-representational-harm/docs/en.md

```arch
node | emb | 1,1 | Embedding-based | WEAT on pre-RLHF embeddings | model
node | prob | 2,1 | Probability-based | stereotype log-likelihood | model
node | gen | 3,1 | Generated-text-based | resume scoring, dialogue | process
node | rep | 2,2 | Representational harm | stereotypes, erasure |
node | alloc | 3,2 | Allocational harm | unequal material outcomes |
edge | emb | prob | representation
edge | prob | gen | behaviour
edge | gen | rep |
edge | gen | alloc |
```

## Toy WEAT probe
type: annotated-code
lang: python
from: phases/18-ethics-safety-alignment/20-bias-representational-harm/code/main.py

```python
A = ["he", "his", "man"]                      # identity group A
B = ["she", "her", "woman"]                   # identity group B
X = ["engineer", "programmer", "scientist"]   # tech / career
Y = ["nurse", "teacher", "caregiver"]         # care / family
pre = weat_score(A, B, X, Y)                  # positive: A closer to X
EMB = debias(EMB)                             # project out the gender direction
gender_dir = [1.0, -1.0, 0.0, 0.0]            # axis 1 minus axis 0
post = weat_score(A, B, X, Y)                 # drops, not to zero
```

## Group metrics and DP reweighting
type: annotated-code
lang: python
from: phases/18-ethics-safety-alignment/21-fairness-criteria-group-individual-counterfactual/code/main.py

```python
train_data = gen(1000)                        # A=0 base 0.3, A=1 base 0.6
test_data = gen(500)
baseline = train(train_data)                  # steps 200, lr 0.1
preds = predict(baseline, test_data)          # (pred, label, group)
demographic_parity(preds)                     # rate0, rate1
equalized_odds(preds)                         # (TPR, FPR) per group
conditional_use(preds)                        # (PPV, NPV) per group
dp_reweighted = train(train_data, sample_weights=weights)  # a=0 y=1: 2.0, a=1 y=1: 0.5
```

## DP-SGD toy
type: annotated-code
lang: python
from: phases/18-ethics-safety-alignment/22-differential-privacy-for-llms/code/main.py

```python
grad_w = clip(grad_w, C)                      # scale to norm C
grad_b = max(-C, min(C, grad_b))              # clip the bias gradient
noise_b = random.gauss(0.0, sigma * C)        # noise std sigma * C
b -= lr * (grad_b + noise_b)                  # noisy update per example
for sigma in (0.0, 0.5, 1.0, 2.0, 4.0):       # sweep the noise multiplier
    model = dp_sgd(train_data, epochs=epochs, lr=0.05, sigma=sigma, C=C)
    acc = accuracy(model, test_data)
eps = analytical_epsilon(max(sigma, 0.01), steps=epochs * len(train_data), delta=delta)
```

## Toy defaults
type: defaults
from: phases/18-ethics-safety-alignment/21-fairness-criteria-group-individual-counterfactual/code/main.py, phases/18-ethics-safety-alignment/22-differential-privacy-for-llms/code/main.py, phases/18-ethics-safety-alignment/22-differential-privacy-for-llms/docs/en.md

| Setting | Default | Note |
|---|---|---|
| Clip norm `C` | 1.0 | Lesson 22 toy |
| `delta` | 1e-5 | Default of `analytical_epsilon` |
| `epochs` | 10 | DP-SGD toy, 500 train rows |
| DP-SGD `lr` | 0.05 | Fixed in the sweep |
| `sigma` | 0.0 | Standard SGD, infinite epsilon |
| Published ε | [1, 10] | Illustrative, not a recommended default |
| Fairness `train` | `steps: int = 200` | `lr: float = 0.1` |

## Troubleshooting
type: troubleshooting
from: phases/18-ethics-safety-alignment/20-bias-representational-harm/docs/en.md, phases/18-ethics-safety-alignment/20-bias-representational-harm/code/main.py, phases/18-ethics-safety-alignment/21-fairness-criteria-group-individual-counterfactual/code/main.py, phases/18-ethics-safety-alignment/22-differential-privacy-for-llms/docs/en.md

| Symptom | Cause | Fix |
|---|---|---|
| WEAT effect does not drop to zero | Debiasing reduces but does not eliminate it | Add probability and generated-text metrics |
| Diverse portrayals, unequal decisions | Only representational harm measured | Measure allocational harm too |
| Gender eval passes, bias remains | Bias fires on (gender, race) pairs | Run intersectional tests |
| DP gap shrinks, EO and CUAE worsen | Unequal base rates | State the chosen criterion as policy |
| Canary MIA shows little leakage | Canaries are not "most extractable" data | Add training-data extraction tests |
| Outputs safe, individuals re-identified | Confidence scores leak | Do not expose, or truncate/quantize them |

## Call the toy code
type: task-table
from: phases/18-ethics-safety-alignment/20-bias-representational-harm/code/main.py, phases/18-ethics-safety-alignment/21-fairness-criteria-group-individual-counterfactual/code/main.py, phases/18-ethics-safety-alignment/22-differential-privacy-for-llms/code/main.py

| Task | Code |
|---|---|
| Score a WEAT probe | `weat_score(<identity_a>, <identity_b>, ...)` |
| Project out a bias direction | `debias(<emb>)` |
| Train with reweighting | `train(data, sample_weights=<w>)` |
| Demographic parity per group | `demographic_parity(preds)` |
| Equalized odds per group | `equalized_odds(preds)` |
| Clip one gradient | `clip(<g>, <C>)` |
| Train with DP-SGD | `dp_sgd(data, epochs, lr, sigma, C)` |
| Epsilon for a run | `analytical_epsilon(sigma, steps)` |

## Questions
type: qa
from: phases/18-ethics-safety-alignment/21-fairness-criteria-group-individual-counterfactual/docs/en.md, phases/18-ethics-safety-alignment/22-differential-privacy-for-llms/docs/en.md, phases/18-ethics-safety-alignment/20-bias-representational-harm/docs/en.md

- **Can one model meet all three group criteria?** No. Unequal base rates prevent it (Chouldechova, KMR 2017).
- **Why backtracking counterfactuals?** They reason from actual features. They do not intervene on the attribute.
- **Why do MIA and extraction disagree?** They measure different things: inserted canaries vs "most extractable" data.
- **What does LoRA + DP-SGD protect?** The adapter. The base model is held fixed.
- **Why uncertainty in WinoIdentity?** Equal error with unequal uncertainty still changes allocation.
