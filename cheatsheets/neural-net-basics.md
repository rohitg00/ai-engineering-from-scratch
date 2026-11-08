---
id: neural-net-basics
title: Neural Network Basics
code: NN
subtitle: Perceptron, forward pass, backprop, loss choice and a mini framework. Formulas, shapes, defaults and fixes.
hue: 265
sources: phases/03-deep-learning-core/01-the-perceptron, phases/03-deep-learning-core/02-multi-layer-networks, phases/03-deep-learning-core/03-backpropagation, phases/03-deep-learning-core/05-loss-functions, phases/03-deep-learning-core/10-mini-framework
source_hash: 79fe5ec046db5770
---

## Forward and backward through a 2-layer net
type: architecture
from: phases/03-deep-learning-core/03-backpropagation/docs/en.md, phases/03-deep-learning-core/02-multi-layer-networks/docs/en.md

```arch
node | x | 1,1 | Input x | no computation | client
node | l1 | 2,1 | Hidden layer | a1 = sigmoid(W1 x + b1) | process
node | l2 | 3,1 | Output layer | a2 = sigmoid(W2 a1 + b2) | process
node | loss | 4,1 | Loss | L = (a2 - y)^2 | store
node | g2 | 4,2 | dL/dz2 | 2(a2 - y) a2 (1 - a2) |
node | w2 | 3,2 | dL/dW2 = dL/dz2 a1 | dL/da1 = dL/dz2 W2 |
node | g1 | 2,2 | dL/dz1 | dL/da1 a1 (1 - a1) |
node | w1 | 1,2 | dL/dW1 = dL/dz1 x | dL/db1 = dL/dz1 |
edge | x | l1 | forward
edge | l1 | l2 | a1
edge | l2 | loss | a2
edge | loss | g2 | backward
edge | g2 | w2 |
edge | w2 | g1 |
edge | g1 | w1 |
```

## One training step
type: flow
from: phases/03-deep-learning-core/10-mini-framework/docs/en.md, phases/03-deep-learning-core/03-backpropagation/docs/en.md

1. **DataLoader**: yields a batch of inputs and targets. Shuffles each epoch.
2. **Model**: runs the forward pass layer by layer. Each layer stores its input and output.
3. **Loss**: compares predictions to targets and gives one scalar.
4. **Optimizer**: `optimizer.zero_grad()` resets every gradient to zero.
5. **Loss**: `loss.backward()` sends gradients right to left through the graph.
6. **Optimizer**: `optimizer.step()` updates each parameter, for SGD `param -= lr * grad`.
7. **Model**: `model.eval()` before test. Inference runs only the forward pass.

## Formulas
type: concepts
from: phases/03-deep-learning-core/01-the-perceptron/docs/en.md, phases/03-deep-learning-core/02-multi-layer-networks/docs/en.md, phases/03-deep-learning-core/03-backpropagation/docs/en.md, phases/03-deep-learning-core/05-loss-functions/docs/en.md

- **Step**: $\text{step}(z) = 1$ if $z \ge 0$, else 0.
- **Perceptron rule**: `w_i = w_i + learning_rate * error * x_i`, with error = y_true minus y_pred.
- **Sigmoid**: $\sigma(z) = \frac{1}{1 + e^{-z}}$, range (0, 1). Its derivative is $a(1 - a)$.
- **Layer**: $z = W x + b$, then $a = \text{sigmoid}(z)$.
- **MSE**: $\frac{1}{n} \sum (y_{\text{pred}} - y_{\text{true}})^2$, gradient $\frac{2}{n}(y_{\text{pred}} - y_{\text{true}})$.
- **BCE**: $-\left(y \log(p) + (1 - y) \log(1 - p)\right)$
- **CCE**: $-\sum_i y_i \log(p_i)$. Only the true class contributes.
- **Softmax plus CE gradient**: probability minus 1 for the true class, probability for the others.

## Tasks in code
type: task-table
from: phases/03-deep-learning-core/01-the-perceptron/docs/en.md, phases/03-deep-learning-core/02-multi-layer-networks/docs/en.md, phases/03-deep-learning-core/03-backpropagation/docs/en.md, phases/03-deep-learning-core/05-loss-functions/docs/en.md, phases/03-deep-learning-core/10-mini-framework/docs/en.md

| Task | Code |
|---|---|
| Train a perceptron on AND | `p_and = Perceptron(2)` then `p_and.train(and_data)` |
| Chain layers | `Network([hidden, output])` |
| Autograd net, 2-4-1 | `net = Network([2, 4, 1])` |
| Backprop from the loss | `total_loss.backward()` |
| Stable multi-class loss | `F.cross_entropy(logits, labels)` |
| Smoothed targets | `label_smoothing=0.1` |
| Pick an optimizer | `Adam(model.parameters(), lr=0.01)` |
| Batch the data | `DataLoader(train_data, batch_size=16, shuffle=True)` |

## Value node with backward
type: annotated-code
lang: python
from: phases/03-deep-learning-core/03-backpropagation/docs/en.md, phases/03-deep-learning-core/03-backpropagation/code/main.py

```python
out = Value(self.data + other.data, (self, other), '+')
self.grad += out.grad                 # add passes the gradient through
other.grad += out.grad
out = Value(self.data * other.data, (self, other), '*')
self.grad += other.data * out.grad    # mul swaps the inputs
other.grad += self.data * out.grad
self.grad += (s * (1 - s)) * out.grad # sigmoid reuses s
build_topo(self)                      # topological sort of the graph
self.grad = 1.0                       # dL/dL = 1
for v in reversed(topo):
    v._backward()                     # push gradients to children
```

## Mini framework training loop
type: annotated-code
lang: python
from: phases/03-deep-learning-core/10-mini-framework/docs/en.md, phases/03-deep-learning-core/10-mini-framework/code/main.py

```python
model = Sequential(Linear(2, 16), ReLU(), Linear(16, 16), ReLU(),
                   Linear(16, 8), ReLU(), Linear(8, 1), Sigmoid())
criterion = BCELoss()
optimizer = Adam(model.parameters(), lr=0.01)
model.train()                          # dropout and batch stats on
for batch_inputs, batch_targets in loader:
    for x, t in zip(batch_inputs, batch_targets):
        pred = model.forward(x)
        loss = criterion(pred, t)
        optimizer.zero_grad()
        grad = criterion.backward()    # dL/dpred
        model.backward(grad)           # modules in reverse
        optimizer.step()
model.eval()                           # running stats, no dropout
```

## Which loss
type: command-table
from: phases/03-deep-learning-core/05-loss-functions/docs/en.md

| Command | What it does |
|---|---|
| `F.mse_loss` | Regression. Penalizes outliers quadratically |
| MAE / Huber | Regression that is robust to outliers |
| `F.binary_cross_entropy` | Binary classification on probabilities |
| `F.cross_entropy` | Multi-class. Log-softmax and NLL in one step |
| Label smoothing | Add when multi-class CE is overconfident |
| Focal Loss | Imbalanced classes. Down-weights easy examples |
| Triplet Loss | Anchor, positive, negative with a margin |
| InfoNCE | Large batch self-supervised embeddings |

## Defaults in the lesson code
type: defaults
from: phases/03-deep-learning-core/01-the-perceptron/docs/en.md, phases/03-deep-learning-core/05-loss-functions/docs/en.md, phases/03-deep-learning-core/10-mini-framework/docs/en.md

| Setting | Default | Note |
|---|---|---|
| Perceptron `learning_rate` | 0.1 | `epochs=100` |
| Adam `lr` | 0.001 | `beta1=0.9`, `beta2=0.999`, `eps=1e-8` |
| SGD `lr` | 0.01 | `param -= lr * grad` |
| Dropout `p` | 0.5 | Survivors scale by 1/(1-p) |
| BatchNorm | `momentum=0.1` | `eps=1e-5`, running stats for eval |
| BCE clip `eps` | 1e-15 | `BCELoss` in the framework uses 1e-7 |
| `alpha` | 0.1 | Label smoothing, target 0.91 for 10 classes |
| `temperature` | 0.07 | Contrastive loss, SimCLR default |

## Numbers to remember
type: tips
from: phases/03-deep-learning-core/03-backpropagation/docs/en.md, phases/03-deep-learning-core/05-loss-functions/docs/en.md, phases/03-deep-learning-core/02-multi-layer-networks/docs/en.md

- The sigmoid derivative peaks at 0.25 when $a = 0.5$.
- Ten sigmoid layers scale the gradient by at most $0.25^{10} = 0.000001$.
- MSE that predicts 0.5 on a 50/50 binary task gives 0.25 and learns nothing.
- Cross-entropy gives $-\log(0.5) = 0.693$ and $-\log(0.99) = 0.01$.
- A wrong confident guess $p = 0.01$ costs $-\log(0.01) = 4.6$.
- Random guess on 10 classes costs $-\log(0.1) = 2.3$.
- Focal loss with $\gamma = 2$ weights an easy example at 0.01, a hard one at 0.81.
- One backward pass gives all gradients. Nudging each weight needs one forward pass per weight.

## Troubleshooting
type: troubleshooting
from: phases/03-deep-learning-core/01-the-perceptron/docs/en.md, phases/03-deep-learning-core/02-multi-layer-networks/docs/en.md, phases/03-deep-learning-core/03-backpropagation/docs/en.md, phases/03-deep-learning-core/05-loss-functions/docs/en.md, phases/03-deep-learning-core/10-mini-framework/docs/en.md

| Symptom | Cause | Fix |
|---|---|---|
| Perceptron never converges on XOR | XOR is not linearly separable | Add a hidden layer |
| Classifier outputs 0.5 for all | MSE loss on classification | Use cross-entropy |
| Early layers do not learn | Sigmoid shrinks gradients per layer | ReLU (Lesson 04), scaled init |
| Loss is inf or NaN | $\log(0) = -\infty$ | Clip p to [eps, 1 - eps] |
| `math.exp(1000)` overflow | Large input to sigmoid | Clamp to [-500, 500] |
| Gradient wrong for a reused value | `=` overwrites other paths | Accumulate with `+=` |
| Gradients grow each step | Old gradients stay | Call `zero_grad()` first |
| Test results change each run | Dropout still on | Call `model.eval()` |

## Questions
type: qa
from: phases/03-deep-learning-core/01-the-perceptron/docs/en.md, phases/03-deep-learning-core/02-multi-layer-networks/docs/en.md, phases/03-deep-learning-core/03-backpropagation/docs/en.md, phases/03-deep-learning-core/05-loss-functions/docs/en.md, phases/03-deep-learning-core/10-mini-framework/docs/en.md

- **What shape is W?** Rows match the current layer. Columns match the previous layer.
- **Why sigmoid, not step, for training?** Sigmoid is smooth, so gradients exist.
- **Why store activations?** The backward pass needs them. Memory buys one pass.
- **Why topological sort?** A node gets all its gradient before it passes it on.
- **Why `F.cross_entropy`, not softmax then log?** One operation is numerically stable.
- **Why `train()` and `eval()`?** Dropout and BatchNorm act differently in each mode.
- **Why is `zero_grad` a separate call?** Gradients accumulate with `+=` until you reset them.
