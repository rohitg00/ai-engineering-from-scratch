# Evidence: cheatsheets/neural-net-basics.md

Abbreviations: P = phases/03-deep-learning-core. L01 = P/01-the-perceptron, L02 = P/02-multi-layer-networks, L03 = P/03-backpropagation, L05 = P/05-loss-functions, L10 = P/10-mini-framework. d = docs/en.md, c = code/main.py.

## Forward and backward through a 2-layer net (architecture, 8 nodes, 7 edges)
- Input x, no computation: L02/d:33
- Hidden layer a1 = sigmoid(W1 x + b1): L03/d:111-112
- Output layer a2 = sigmoid(W2 a1 + b2): L03/d:113-114
- Loss L = (a2 - y)^2: L03/d:115
- dL/dz2 = 2(a2 - y) a2 (1 - a2): L03/d:125
- dL/dW2 = dL/dz2 a1, dL/da1 = dL/dz2 W2: L03/d:126, 128
- dL/dz1 = dL/da1 a1 (1 - a1): L03/d:129-130
- dL/dW1 = dL/dz1 x, dL/db1 = dL/dz1: L03/d:131-132
- forward left to right, backward right to left: L03/d:48, 50

## One training step (flow, 7 steps)
1. DataLoader yields batches, shuffles each epoch: L10/d:53, 102
2. Forward pass layer by layer, stores values: L10/d:103, L03/d:73
3. Loss computes one scalar: L10/d:104-105
4. optimizer.zero_grad() resets gradients: L10/d:660, 705
5. loss.backward() gradients right to left: L10/d:663, L03/d:50
6. optimizer.step(), SGD param -= lr * grad: L10/d:49, 664
7. model.eval() before test, inference forward only: L10/d:666, L03/d:436

## Formulas (concepts, 8)
- Step function: L01/d:41-45
- Perceptron rule w_i = w_i + learning_rate * error * x_i, error = y_true - y_pred: L01/d:75, 78
- Sigmoid range (0, 1): L02/d:79, 82. Derivative a(1 - a): L03/d:87
- Layer z = W x + b, a = sigmoid(z): L02/d:102-107
- MSE and its gradient: L05/d:33-35, 43-45
- BCE: L05/d:55-57
- CCE, only the true class contributes: L05/d:75-79
- Softmax + CE gradient: L05/d:260

## Tasks in code (task-table, 8)
- p_and = Perceptron(2), p_and.train(and_data): L01/d:174-175
- Network([hidden, output]): L02/d:244
- net = Network([2, 4, 1]): L03/d:313
- total_loss.backward(): L03/d:333
- F.cross_entropy(logits, labels): L05/d:412
- label_smoothing=0.1: L05/d:413
- Adam(model.parameters(), lr=0.01): L10/d:580
- DataLoader(train_data, batch_size=16, shuffle=True): L10/d:587

## Value node with backward (annotated-code, 11 lines)
- add Value and both grads += out.grad: L03/c:18, 21-22
- mul Value and swapped grads: L03/c:32, 35-36
- sigmoid backward reuses s: L03/c:56, L03/d:215
- build_topo(self), self.grad = 1.0, reversed(topo), v._backward(): L03/c:72-75, L03/d:247

## Mini framework training loop (annotated-code, 14 lines)
- Sequential of Linear(2, 16) ... Sigmoid(): L10/d:568-577
- criterion = BCELoss(), Adam(model.parameters(), lr=0.01): L10/c:394-395
- model.train(): L10/c:404, train mode turns on dropout and batch stats: L10/d:703
- loop over batches and samples, forward, criterion: L10/c:411-414
- zero_grad, criterion.backward(), model.backward(grad), step: L10/c:417-420
- model.eval(): L10/c:433, running stats, no dropout: L10/d:704
- backward goes right to left: L10/d:382

## Which loss (command-table, 8)
- F.mse_loss: L05/d:407, regression penalizes outliers: L05/d:37, 163
- MAE / Huber robust to outliers: L05/d:164
- F.binary_cross_entropy: L05/d:166, 408
- F.cross_entropy, log-softmax and NLL in one: L05/d:416
- Label smoothing when overconfident: L05/d:169
- Focal Loss for imbalanced, down-weights easy: L05/d:141, 168
- Triplet Loss anchor positive negative margin: L05/d:131-137, 172
- InfoNCE for large batch self-supervised: L05/d:173

## Defaults in the lesson code (defaults, 8)
- Perceptron learning_rate=0.1, epochs=100: L01/d:124, 134
- Adam lr=0.001, beta1=0.9, beta2=0.999, eps=1e-8: L10/d:484
- SGD lr=0.01, param -= lr * grad: L10/d:49, 464
- Dropout p=0.5, scale 1/(1-p): L10/d:279, 283
- BatchNorm momentum=0.1, eps=1e-5, running stats in eval: L10/d:302, 306
- BCE eps=1e-15: L05/d:221. BCELoss eps = 1e-7: L10/d:439
- alpha 0.1, target 0.91 with 10 classes: L05/d:109, 265
- temperature=0.07, SimCLR default: L05/d:127, 289

## Numbers to remember (tips, 8)
- Sigmoid derivative max 0.25 at a = 0.5: L03/d:87
- 0.25^10 = 0.000001: L03/d:87, 98
- MSE predicting 0.5 on 50/50 gives 0.25: L05/d:23
- -log(0.5) = 0.693, -log(0.99) = 0.01: L05/d:23
- -log(0.01) = 4.6: L05/d:61
- -log(0.1) = 2.3 for 10 classes: L05/d:79
- Focal gamma 2, easy 0.01, hard 0.81: L05/d:147-150
- One backward pass vs one forward pass per weight: L03/d:19-23

## Troubleshooting (troubleshooting, 8)
- XOR never converges, not linearly separable, add layers: L01/d:97, 110-112, 211
- MSE classifier predicts 0.5, use cross-entropy: L05/d:19, 23
- Early layers barely learn, vanishing gradient, ReLU in Lesson 04: L03/d:91, 101. Scaled init sqrt(2/n_inputs): L03/d:307
- log(0) = -inf, clipping: L05/d:216, 225
- math.exp(1000) is infinity, clamp to [-500, 500]: L02/d:169
- Reused Value needs +=: L03/d:195
- zero_grad resets gradients before the next batch: L10/d:705
- Dropout active in training, eval disables it: L10/d:45, 704

## Questions (qa, 7)
- W shape rows current layer, columns previous layer: L02/d:123
- Sigmoid is smooth so gradients exist: L01/d:322, L02/d:82
- Backward needs stored activations, memory for speed: L03/d:73
- Topological sort accumulates gradient first: L03/d:227, 467
- F.cross_entropy is numerically stable: L05/d:416
- train() and eval() toggle dropout and BatchNorm: L10/d:45
- zero_grad separate because grads accumulate with +=: L10/d:25, 215-217, 705
