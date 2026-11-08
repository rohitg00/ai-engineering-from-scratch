# Evidence: cheatsheets/calculus-optimization.md

Abbreviations: P = phases/01-math-foundations. L04 = P/04-calculus-for-ml, L05 = P/05-chain-rule-and-autodiff, L08 = P/08-optimization, L18 = P/18-convex-optimization. d = docs/en.md. L04/c = code/derivatives.py, L05/c = code/autodiff.py, L08/c = code/optimizers.py, L18/c = code/convex.py.

## Forward and backward through one neuron (architecture, 8 nodes, 7 edges)
- x input node: L04/d:340
- z1 = w*x node, edge *w: L04/d:340-341
- z2 = w*x + b node, edge +b: L04/d:341-342
- a = sigmoid(z2) activation node: L04/d:342-343
- L cross-entropy loss node: L04/d:343
- dL/dz2 = dL/da * a(1-a): L04/d:351
- dL/dw = dL/dz2 * x: L04/d:352
- dL/db = dL/dz2 * 1: L04/d:353

## Reverse-mode autodiff in Value.backward (flow, 7 steps)
1. Value with children and _backward closure: L05/d:178-183, 196-200
2. build_topo topological order: L05/d:228-234, 241
3. self.grad = 1.0 seed: L05/d:236, L05/c:102
4. v._backward() in reversed(topo): L05/d:237-238, L05/c:103-104
5. += accumulation for reused values: L05/d:220, 523
6. p.grad = 0.0 before loss.backward(): L05/d:370-372
7. p.data -= lr * p.grad: L05/d:375-376

## Tasks in code (task-table, 8 rows)
- numerical_derivative(f, x, h=1e-7): L04/c:5
- numerical_gradient(f, point, h=1e-7): L04/c:9
- hessian_2d(f, x, y, h=1e-5): L04/c:121
- gradient_check(build_expr, x_val, h=1e-7): L05/c:229
- model = MLP([2, 4, 1]), 4 hidden neurons: L05/d:361
- optimize(optimizer, func, grad_func, start, steps=5000): L08/c:75
- check_convexity(f, dim, ...): L18/c:5
- newtons_method(grad_f, hessian_f, x0, ...): L18/c:87

## Optimizers from scratch (annotated-code, 6 lines)
- GradientDescent(lr=0.001), w = w - lr * gradient: L08/c:16-17, L08/d:42
- SGDMomentum(lr=0.001, momentum=0.9), v = beta * v + gradient: L08/c:24-25, L08/d:99
- Adam(lr=0.001, beta1=0.9, beta2=0.999, epsilon=1e-8), two moments per weight: L08/c:40-41, L08/d:127-130
- m_hat bias correction: L08/c:66
- p - self.lr * mh / (vh ** 0.5 + self.epsilon): L08/c:69-70
- adam_history = optimize(Adam(lr=0.01), rosenbrock, rosenbrock_gradient, start): L08/d:310

## Autograd and optimizers in PyTorch (annotated-code, 8 lines)
- torch.tensor(2.0, requires_grad=True), y = x ** 2 + 3 * x + 1, y.backward(), x.grad 7.0: L05/d:152-155
- backward is reverse mode through the recorded graph: L05/d:162
- torch.optim.SGD, torch.optim.Adam, torch.optim.AdamW with weight_decay=0.01: L08/d:329-331
- torch.optim.lr_scheduler.CosineAnnealingLR(adam, T_max=100): L08/d:333

## Key formulas (concepts, 8 bullets)
- Central difference: L04/d:123-127
- Chain rule, sum branches: L05/d:34, L04/d:356
- Gradient descent: L08/d:42
- Momentum: L08/d:99-100
- Adam update with bias correction: L08/d:134-138
- Newton update: L18/d:164
- Convex function inequality: L18/d:52-55
- Lagrangian, gradient zero: L18/d:225-233

## Derivatives to know (command-table, 8 rows)
- x^2 to 2x, MSE: L04/d:141
- wx + b: L04/d:142-144
- e^x: L04/d:145
- ln(x) to 1/x: L04/d:146
- sigmoid f(x)(1-f(x)): L04/d:147
- tanh 1 - tanh^2: L05/d:309
- x^n to n x^(n-1), __pow__: L05/d:305
- sin(x^2) to cos(x^2) * 2x: L05/d:39-45

## Pick a method (command-table, 7 rows)
- Gradient descent O(n), baseline: L18/d:387
- SGD with momentum for best final accuracy: L08/d:339
- Adam diagonal approximation, deep learning default: L18/d:383, 390
- AdamW for transformers: L08/d:340
- Newton O(n^3), small convex problems: L18/d:388
- L-BFGS last m gradient differences, medium convex problems: L18/d:377, 389
- K-FAC, large-batch training: L18/d:379, 391

## Numbers and defaults (defaults, 8 rows)
- Adam lr 0.001: L08/d:75, 144, 338
- beta2 0.999, beta1 0.9: L08/d:144
- epsilon 1e-8: L08/d:144
- SGD momentum lr 0.01, momentum 0.9: L08/d:75, 339
- AdamW weight_decay 0.01: L08/d:331
- Mini-batch 32-256: L08/d:89
- h = 1e-7 in numerical_derivative: L04/c:5
- Gradient check difference < 1e-5: L05/d:417

## Troubleshooting (troubleshooting, 8 rows)
- Divergence and nan from a large learning rate: L08/d:342, 362
- Too slow, increase lr, use schedule: L08/d:341-342
- Elongated valley from condition number: L18/d:488, 560
- Saddle point, momentum and noise: L08/d:179
- Gradients accumulate, reset to 0.0: L05/d:164, 371
- Gradient checking catches backward bugs: L05/d:420, 427
- h=1e-4 for a noisy second derivative: L04/d:617
- Newton O(n^2) memory, O(n^3) inverse: L18/d:194-196

## Questions (qa, 5 bullets)
- Reverse mode for many inputs and one output: L05/d:113
- Convexity tests f'' >= 0 and Hessian PSD: L18/d:78, 84
- Saddle points dominate, minima near global: L18/d:356-358
- L1 diamond corners give sparsity: L18/d:317
- Complementary slackness and support vectors: L18/d:274, 280

## Tips (tips, 6 bullets)
- Schedule for longer runs: L08/d:341
- Cosine annealing for transformers, warmup for large models: L08/d:156-157
- Newton solves a quadratic in one step: L18/d:488, 542
- Gradient check 2x forward passes per parameter, not in production: L05/d:428
- Mixed eigenvalue signs mean a saddle: L04/d:209, L18/d:153
- Flat minima generalize better: L08/d:198, L18/d:371
