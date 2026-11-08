# Evidence: cheatsheets/fairness-privacy.md

Abbreviations: P18 = phases/18-ethics-safety-alignment. L20 = P18/20-bias-representational-harm, L21 = P18/21-fairness-criteria-group-individual-counterfactual, L22 = P18/22-differential-privacy-for-llms. d = docs/en.md, c = code/main.py.

## Three fairness families side by side (comparison, 5 rows)
- Rule: equal rates across groups, similar individuals similar decisions, unchanged under counterfactual attribute change: L21/d:3, 33, 39
- Source: demographic parity, equalized odds, conditional use accuracy equality; Dwork et al. 2012; Kusner et al. 2017: L21/d:25-27, 33, 39
- Needs: group labels (P(Y=1 | A=a)), metric d, causal DAG: L21/d:25, 35, 41
- Formal test: equal rates, Lipschitz constant L, counterfactual alteration: L21/d:25-27, 33, 39
- Weak point: three criteria cannot hold under unequal base rates, defining d is a policy question, only as justified as the DAG: L21/d:29, 35, 41

## Use each criterion when (tips, 6)
- Demographic parity, equal acceptance rates: L21/d:25
- Equalized odds, equal TPR and FPR: L21/d:26
- Conditional use accuracy equality, equal predictive value: L21/d:27
- Individual fairness needs a task-specific similarity metric d: L21/d:33-35
- Counterfactual fairness needs a causal DAG: L21/d:39-41
- Backtracking counterfactuals sidestep the legal objection to intervening on protected attributes: L21/d:49-51

## Formulas (concepts, 7)
- Demographic parity: L21/d:25
- Equalized odds: L21/d:26
- Conditional use accuracy equality: L21/d:27
- Individual fairness Lipschitz: L21/d:33
- (ε, δ)-DP: L22/d:25-29
- WEAT s(w, X, Y): L20/c:8, 50-53
- WEAT effect mean_a(s) - mean_b(s): L20/c:9, 54-56

## DP-SGD recipe (flow, 6 steps)
1. Sample a mini-batch: L22/d:36
2. Per-example gradients: L22/d:37
3. Clip to threshold C: L22/d:38
4. Sum and add Gaussian noise with std σ·C: L22/d:39
5. Update parameters with the noisy sum: L22/d:40
6. Accountant, Moments Accountant or Rényi DP accountant: L22/d:42

## Where bias is measured (architecture, 5 nodes, 4 edges)
- Embedding-based, WEAT on pre-RLHF embeddings, measures the representation: L20/d:32
- Probability-based, log-likelihood of stereotype completions, captures some behavioural bias: L20/d:33
- Generated-text-based, resume scoring, recommendation writing, dialogue: L20/d:34
- Representational harm, stereotypes and erasure: L20/d:25
- Allocational harm, unequal material outcomes: L20/d:26
- Evaluations need to measure both harms: L20/d:28

## Toy WEAT probe (annotated-code, 8 lines)
- A, B, X, Y lists: L20/c:77-80
- tech / career and care / family axes: L20/c:31, 35
- pre = weat_score(A, B, X, Y), positive meaning: L20/c:82-84
- EMB = debias(EMB): L20/c:86
- gender_dir and axis 1 minus axis 0: L20/c:60, 62
- post = weat_score, does not drop to zero: L20/c:87, 92-93

## Group metrics and DP reweighting (annotated-code, 8 lines)
- gen(1000), gen(500): L21/c:106-107
- base rates 0.3 and 0.6: L21/c:24, 29
- train defaults steps 200, lr 0.1: L21/c:37
- predict returns (pred, y, a): L21/c:56-62
- demographic_parity rate0, rate1: L21/c:65-68
- equalized_odds TPR, FPR: L21/c:71-77
- conditional_use PPV, NPV: L21/c:80-86
- weights 2.0 and 0.5, train with sample_weights: L21/c:114-122

## DP-SGD toy (annotated-code, 8 lines)
- clip(grad_w, C), clip scales to norm C: L22/c:32-36, 49
- grad_b clip: L22/c:50
- noise std sigma * C: L22/c:51-53
- b -= lr * (grad_b + noise_b): L22/c:55
- sigma sweep (0.0, 0.5, 1.0, 2.0, 4.0): L22/c:87
- dp_sgd call and accuracy: L22/c:88-89
- analytical_epsilon call: L22/c:90

## Toy defaults (defaults, 7)
- C 1.0: L22/c:84
- delta 1e-5 default of analytical_epsilon: L22/c:69, 85
- epochs 10, 500 train rows: L22/c:81, 83
- lr 0.05: L22/c:88
- sigma 0.0 is standard SGD, infinite epsilon: L22/c:87, 94
- epsilon in [1, 10]: L22/c:96, illustrative not recommended defaults: L22/d:42
- train steps: int = 200, lr: float = 0.1: L21/c:37

## Troubleshooting (troubleshooting, 6)
- WEAT does not drop to zero, debiasing reduces but does not eliminate, need probability and generated-text metrics: L20/c:92-96
- Representationally unbiased but allocationally biased, measure both: L20/d:28
- Single-axis misses (gender, race) bias: L20/d:38
- DP reweighting costs EO and CUAE under unequal base rates, policy decision: L21/c:127-132
- Canaries under-report, "most extractable" data matters: L22/d:52-55
- Confidence scores leak, do not expose or truncate/quantize: L22/d:68-70

## Call the toy code (task-table, 8)
- weat_score(identity_a, identity_b, ...): L20/c:48
- debias(emb): L20/c:59
- train(data, steps=200, lr=0.1, sample_weights=None): L21/c:37
- demographic_parity(preds): L21/c:65
- equalized_odds(preds): L21/c:71
- clip(g, C): L22/c:32
- dp_sgd(data, epochs, lr, sigma, C): L22/c:39
- analytical_epsilon(sigma, steps, delta=1e-5): L22/c:69

## Questions (qa, 5)
- Group criteria impossible under unequal base rates, Chouldechova / KMR 2017: L21/d:29, 97
- Backtracking counterfactuals reason from actual features: L21/d:51, 96
- MIA vs extraction measure different things: L22/d:55
- LoRA + DP-SGD guarantees apply to the adapter, base fixed: L22/d:46
- WinoIdentity uncertainty changes downstream allocation: L20/d:40
