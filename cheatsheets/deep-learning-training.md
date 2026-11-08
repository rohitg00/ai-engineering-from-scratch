---
id: deep-learning-training
title: Training Neural Networks
code: TN
subtitle: Pick the optimizer, init, normalization, regularization and schedule. Then debug the run when the loss misbehaves.
hue: 270
sources: phases/03-deep-learning-core/03-backpropagation, phases/03-deep-learning-core/04-activation-functions, phases/03-deep-learning-core/06-optimizers, phases/03-deep-learning-core/07-regularization, phases/03-deep-learning-core/08-weight-initialization, phases/03-deep-learning-core/09-learning-rate-schedules, phases/03-deep-learning-core/13-debugging-neural-networks
source_hash: 1b7829256d417a05
---

## One AdamW step
type: architecture
from: phases/03-deep-learning-core/06-optimizers/docs/en.md

```arch
node | loss | 1,1 | Loss | forward pass output
node | bwd | 2,1 | loss.backward() | chain rule fills grads
node | clip | 3,1 | clip_grad_norm_ | max_norm=1.0
node | m | 1,2 | First moment m_t | mean, beta1 0.9
node | v | 2,2 | Second moment v_t | variance, beta2 0.999
node | hat | 3,2 | Bias correction | divide by 1 - beta^t
node | upd | 2,3 | Adam update | lr · m̂ / (√v̂ + ε)
node | wd | 3,3 | Decoupled decay | minus lr · λ · w
edge | loss | bwd |
edge | bwd | clip |
edge | clip | m |
edge | clip | v |
edge | m | hat |
edge | v | hat |
edge | hat | upd |
edge | upd | wd | AdamW
```

## The training step
type: flow
from: phases/03-deep-learning-core/06-optimizers/docs/en.md

1. **zero_grad**: clear the gradients from the last batch.
2. **Forward**: run the model on the batch.
3. **Loss**: compare the output with the targets.
4. **backward**: compute the gradient of every parameter.
5. **Clip**: cap the global gradient norm. This step is optional.
6. **step**: the optimizer updates the weights.
7. **Schedule**: `scheduler.step()` comes after `optimizer.step()`.

## Training loop with AdamW and cosine
type: annotated-code
lang: python
from: phases/03-deep-learning-core/06-optimizers/docs/en.md, phases/03-deep-learning-core/09-learning-rate-schedules/docs/en.md

```python
optimizer = optim.AdamW(model.parameters(), lr=3e-4, weight_decay=0.01)
scheduler = optim.lr_scheduler.CosineAnnealingLR(optimizer, T_max=100)
for epoch in range(100):
    optimizer.zero_grad()                  # clear old gradients
    output = model(torch.randn(32, 784))   # forward pass
    loss = torch.nn.functional.cross_entropy(output, torch.randint(0, 10, (32,)))
    loss.backward()                        # fill .grad by chain rule
    torch.nn.utils.clip_grad_norm_(model.parameters(), max_norm=1.0)
    optimizer.step()                       # update the weights
    scheduler.step()                       # after optimizer.step()
# Warmup then cosine, from the HuggingFace library
scheduler = get_cosine_schedule_with_warmup(
    optimizer, num_warmup_steps=2000, num_training_steps=100000)
```

## Key formulas
type: concepts
from: phases/03-deep-learning-core/03-backpropagation/docs/en.md, phases/03-deep-learning-core/06-optimizers/docs/en.md, phases/03-deep-learning-core/07-regularization/docs/en.md, phases/03-deep-learning-core/08-weight-initialization/docs/en.md, phases/03-deep-learning-core/09-learning-rate-schedules/docs/en.md

- **Chain rule**: $\frac{dy}{dx} = f'(g(x)) \cdot g'(x)$
- **Adam moments**: $m_t = \beta_1 m_{t-1} + (1 - \beta_1) \cdot \text{gradient}$ and $v_t = \beta_2 v_{t-1} + (1 - \beta_2) \cdot \text{gradient}^2$
- **Bias correction**: $\hat{m} = \frac{m_t}{1 - \beta_1^t}$ and $\hat{v} = \frac{v_t}{1 - \beta_2^t}$
- **AdamW update**: $w = w - \text{lr} \cdot \frac{\hat{m}}{\sqrt{\hat{v}} + \epsilon} - \text{lr} \cdot \lambda w$
- **Cosine decay**: $\text{lr}(t) = \text{lr}_{\min} + 0.5 \cdot (\text{lr}_{\max} - \text{lr}_{\min}) \cdot \left(1 + \cos\left(\frac{\pi t}{T}\right)\right)$
- **Linear warmup**: $\text{lr}(t) = \text{lr}_{\max} \cdot \frac{t}{\text{warmup\_steps}} \quad \text{for } t < \text{warmup\_steps}$
- **Init variance**: Kaiming $\mathrm{Var}(w) = \frac{2}{\text{fan}_{\text{in}}}$, Xavier $\mathrm{Var}(w) = \frac{2}{\text{fan}_{\text{in}} + \text{fan}_{\text{out}}}$
- **Inverted dropout**: $\text{output} = \text{activation}(z) \cdot \text{mask} / (1 - p)$ during training

## Pick by situation
type: command-table
from: phases/03-deep-learning-core/06-optimizers/docs/en.md, phases/03-deep-learning-core/08-weight-initialization/docs/en.md

| Situation | Choice |
|---|---|
| Transformer or LLM | AdamW, lr=1e-4, wd=0.01-0.1 |
| CNN or ResNet | SGD + Momentum, lr=0.1, momentum=0.9 |
| GAN | Adam, lr=2e-4, beta1=0.5 |
| Fine-tuning | AdamW, lr=2e-5, wd=0.01 |
| Not sure yet | AdamW, lr=3e-4, wd=0.01 |
| Sigmoid or tanh layers | Xavier init |
| ReLU, GELU or Swish layers | Kaiming init |
| Transformer residual layers | scale by 1/sqrt(2N), N layers |

## Init, norm and regularization in code
type: task-table
from: phases/03-deep-learning-core/08-weight-initialization/docs/en.md, phases/03-deep-learning-core/07-regularization/docs/en.md, phases/03-deep-learning-core/09-learning-rate-schedules/docs/en.md, phases/03-deep-learning-core/13-debugging-neural-networks/docs/en.md

| Task | Code |
|---|---|
| Kaiming init for ReLU | `nn.init.kaiming_normal_(layer.weight, nonlinearity='relu')` |
| Xavier init | `nn.init.xavier_uniform_(layer.weight)` |
| BatchNorm after a Linear | `nn.BatchNorm1d(256)` |
| LayerNorm in a transformer | `nn.LayerNorm(d_model)` |
| Dropout in an MLP | `nn.Dropout(0.3)` |
| Cosine decay to a floor | `CosineAnnealingLR(optimizer, T_max=1000, eta_min=1e-5)` |
| Find the first NaN or Inf | `with torch.autograd.detect_anomaly():` |
| Measure the gradient norm | `torch.nn.utils.clip_grad_norm_(model.parameters(), float("inf"))` |

## Optimizer defaults
type: defaults
from: phases/03-deep-learning-core/06-optimizers/docs/en.md

| Setting | Default | Note |
|---|---|---|
| Adam lr | 0.001 | change lr first |
| beta1 | 0.9 | almost never change |
| beta2 | 0.999 | change second if needed |
| epsilon | 1e-8 | almost never change |
| AdamW weight_decay | 0.01 | not scaled by the adaptive rate |
| SGD momentum | 0.9 | about the last 10 gradients |
| SGD weight decay on CNNs | 1e-4 | with step or cosine schedule |
| Gradient clip max_norm | 1.0 | clip by global norm |

## Regularization and schedule defaults
type: defaults
from: phases/03-deep-learning-core/07-regularization/docs/en.md, phases/03-deep-learning-core/09-learning-rate-schedules/docs/en.md, phases/03-deep-learning-core/13-debugging-neural-networks/docs/en.md

| Setting | Default | Note |
|---|---|---|
| Dropout, transformers | 0.1 | LayerNorm models |
| Dropout, MLPs | 0.5 | half the neurons off |
| BatchNorm momentum | 0.1 | 90% old plus 10% new |
| BatchNorm eps | 1e-5 | added to the variance |
| Warmup share | 3-5% | of total steps |
| Cosine floor eta_min | 1e-5 | lowest lr |
| Step decay factor | 0.1 | at fixed epochs |
| Log clamp eps | 1e-7 | keeps log(p) finite |

## Troubleshooting
type: troubleshooting
from: phases/03-deep-learning-core/13-debugging-neural-networks/docs/en.md, phases/03-deep-learning-core/03-backpropagation/docs/en.md, phases/03-deep-learning-core/08-weight-initialization/docs/en.md

| Symptom | Cause | Fix |
|---|---|---|
| Loss stuck at -log(1/num_classes) | model predicts a uniform distribution | check data pipeline and labels |
| Loss NaN after a few steps | learning rate too high | reduce lr by 10x |
| Loss NaN at once | log(0) or division by zero | clamp predictions to [eps, 1-eps] |
| Loss oscillates | no `optimizer.zero_grad()` | call it before `loss.backward()` |
| Test accuracy varies between runs | no `model.eval()` | add `model.eval()` and `torch.no_grad()` |
| Train acc high, test acc low | overfitting | dropout, weight decay, more data |
| Gradients all zero | dead ReLUs or detached graph | LeakyReLU, check `.requires_grad` |
| Early layers stop learning | sigmoid derivative is at most 0.25 | ReLU or GELU with Kaiming init |

## Glossary
type: glossary
from: phases/03-deep-learning-core/06-optimizers/docs/en.md, phases/03-deep-learning-core/07-regularization/docs/en.md, phases/03-deep-learning-core/09-learning-rate-schedules/docs/en.md, phases/03-deep-learning-core/13-debugging-neural-networks/docs/en.md

- **SGD**: stochastic gradient descent on a mini-batch.
- **AdamW**: Adam with decoupled weight decay.
- **BatchNorm**: normalizes each feature across the mini-batch.
- **LayerNorm**: normalizes each sample across its features.
- **RMSNorm**: LayerNorm without the mean subtraction.
- **1cycle**: lr goes up, then down, in one cycle.
- **SGDR**: cosine annealing with warm restarts.
- **LR range test**: raise lr during a short run and find where loss diverges.

## Questions
type: qa
from: phases/03-deep-learning-core/06-optimizers/docs/en.md, phases/03-deep-learning-core/09-learning-rate-schedules/docs/en.md, phases/03-deep-learning-core/07-regularization/docs/en.md, phases/03-deep-learning-core/08-weight-initialization/docs/en.md

- **Why AdamW and not Adam plus L2?** Adam scales the L2 term by its adaptive rate. AdamW shrinks every weight by the same proportion.
- **Why warmup?** Adam moments start at zero. Large early steps follow bad statistics.
- **Why bias correction?** At step 1 with beta1 0.9, m is 0.1 times the gradient.
- **Why LayerNorm in transformers?** It does not depend on batch size or sequence length.
- **Why Kaiming for ReLU?** ReLU zeros half the activations, so the variance is 2/fan_in.

## Tips
type: tips
from: phases/03-deep-learning-core/13-debugging-neural-networks/docs/en.md, phases/03-deep-learning-core/06-optimizers/docs/en.md

- Run the overfit-one-batch test first. Loss must go to nearly zero.
- Try 3 learning rates 10x apart before you blame anything else.
- If you tune one hyperparameter, tune the learning rate.
- Print tensor shapes after every operation while you debug.
- Check that gradient sizes are similar across layers.
- Use `.to(device)` on the model and the data.
