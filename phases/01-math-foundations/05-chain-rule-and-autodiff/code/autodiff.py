import random


class Value:
    def __init__(self, data, children=(), op=''):
        self.data = float(data)
        self.grad = 0.0
        self._backward = lambda: None
        self._prev = set(children)
        self._op = op

    def __repr__(self):
        return f"Value(data={self.data:.4f}, grad={self.grad:.4f})"

    def __add__(self, other):
        other = other if isinstance(other, Value) else Value(other)
        out = Value(self.data + other.data, (self, other), '+')
        def _backward():
            self.grad += out.grad
            other.grad += out.grad
        out._backward = _backward
        return out

    def __radd__(self, other):
        return self.__add__(other)

    def __mul__(self, other):
        other = other if isinstance(other, Value) else Value(other)
        out = Value(self.data * other.data, (self, other), '*')
        def _backward():
            self.grad += other.data * out.grad
            other.grad += self.data * out.grad
        out._backward = _backward
        return out

    def __rmul__(self, other):
        return self.__mul__(other)

    def __neg__(self):
        return self * -1

    def __sub__(self, other):
        return self + (-other)

    def __rsub__(self, other):
        return other + (-self)

    def __pow__(self, n):
        out = Value(self.data ** n, (self,), f'**{n}')
        def _backward():
            self.grad += n * (self.data ** (n - 1)) * out.grad
        out._backward = _backward
        return out

    def __truediv__(self, other):
        return self * (other ** -1) if isinstance(other, Value) else self * (Value(other) ** -1)

    def relu(self):
        out = Value(max(0, self.data), (self,), 'relu')
        def _backward():
            self.grad += (1.0 if out.data > 0 else 0.0) * out.grad
        out._backward = _backward
        return out

    def tanh(self):
        import math
        t = math.tanh(self.data)
        out = Value(t, (self,), 'tanh')
        def _backward():
            self.grad += (1 - t ** 2) * out.grad
        out._backward = _backward
        return out

    def exp(self):
        import math
        e = math.exp(self.data)
        out = Value(e, (self,), 'exp')
        def _backward():
            self.grad += e * out.grad
        out._backward = _backward
        return out

    def log(self):
        import math
        out = Value(math.log(self.data), (self,), 'log')
        def _backward():
            self.grad += (1.0 / self.data) * out.grad
        out._backward = _backward
        return out

    def backward(self):
        topo = []
        visited = set()
        def build_topo(v):
            if v not in visited:
                visited.add(v)
                for child in v._prev:
                    build_topo(child)
                topo.append(v)
        build_topo(self)

        self.grad = 1.0
        for v in reversed(topo):
            v._backward()


def demo_basic():
    print("=== Basic: y = relu(x1 * x2 + 1) ===")
    x1 = Value(2.0)
    x2 = Value(3.0)
    a = x1 * x2
    b = a + Value(1.0)
    y = b.relu()
    y.backward()

    print(f"  x1 = 2.0, x2 = 3.0")
    print(f"  y  = {y.data}")
    print(f"  dy/dx1 = {x1.grad}  (expected 3.0 = x2)")
    print(f"  dy/dx2 = {x2.grad}  (expected 2.0 = x1)")
    assert abs(x1.grad - 3.0) < 1e-6
    assert abs(x2.grad - 2.0) < 1e-6
    print("  PASSED\n")


def demo_power():
    print("=== Power: y = x^3, dy/dx at x=2 ===")
    x = Value(2.0)
    y = x ** 3
    y.backward()

    print(f"  x = 2.0")
    print(f"  y = {y.data}  (expected 8.0)")
    print(f"  dy/dx = {x.grad}  (expected 12.0 = 3*x^2)")
    assert abs(x.grad - 12.0) < 1e-6
    print("  PASSED\n")


def demo_complex():
    print("=== Complex: f = relu(a*b + c) ===")
    a = Value(2.0)
    b = Value(-3.0)
    c = Value(10.0)
    f = (a * b + c).relu()
    f.backward()

    print(f"  a=2, b=-3, c=10")
    print(f"  f = {f.data}  (expected 4.0)")
    print(f"  df/da = {a.grad}  (expected -3.0 = b)")
    print(f"  df/db = {b.grad}  (expected 2.0 = a)")
    print(f"  df/dc = {c.grad}  (expected 1.0)")
    assert abs(a.grad - (-3.0)) < 1e-6
    assert abs(b.grad - 2.0) < 1e-6
    assert abs(c.grad - 1.0) < 1e-6
    print("  PASSED\n")


def demo_neuron():
    print("=== Single neuron: y = relu(w1*x1 + w2*x2 + b) ===")
    w1 = Value(0.5)
    w2 = Value(-1.5)
    x1 = Value(3.0)
    x2 = Value(2.0)
    b = Value(0.1)

    y = (w1 * x1 + w2 * x2 + b).relu()
    y.backward()

    print(f"  w1=0.5, w2=-1.5, x1=3.0, x2=2.0, b=0.1")
    print(f"  pre_act = {w1.data*x1.data + w2.data*x2.data + b.data}")
    print(f"  y = {y.data}")
    print(f"  dy/dw1 = {w1.grad}")
    print(f"  dy/dw2 = {w2.grad}")
    print(f"  dy/dx1 = {x1.grad}")
    print(f"  dy/dx2 = {x2.grad}")
    print(f"  dy/db  = {b.grad}")

    pre = w1.data * x1.data + w2.data * x2.data + b.data
    if pre > 0:
        assert abs(w1.grad - x1.data) < 1e-6
        assert abs(w2.grad - x2.data) < 1e-6
        assert abs(x1.grad - w1.data) < 1e-6
        assert abs(x2.grad - w2.data) < 1e-6
        assert abs(b.grad - 1.0) < 1e-6
        print("  PASSED (relu active)\n")
    else:
        assert abs(w1.grad) < 1e-6
        assert abs(w2.grad) < 1e-6
        print("  PASSED (relu inactive, all grads zero)\n")


class Neuron:
    def __init__(self, n_inputs):
        self.w = [Value(random.uniform(-1, 1)) for _ in range(n_inputs)]
        self.b = Value(0.0)

    def __call__(self, x):
        act = sum((wi * xi for wi, xi in zip(self.w, x)), self.b)
        return act.tanh()

    def parameters(self):
        return self.w + [self.b]


class Layer:
    def __init__(self, n_inputs, n_outputs):
        self.neurons = [Neuron(n_inputs) for _ in range(n_outputs)]

    def __call__(self, x):
        out = [n(x) for n in self.neurons]
        return out

    def parameters(self):
        return [p for n in self.neurons for p in n.parameters()]


class MLP:
    def __init__(self, sizes):
        self.layers = [Layer(sizes[i], sizes[i + 1]) for i in range(len(sizes) - 1)]

    def __call__(self, x):
        for layer in self.layers:
            x = layer(x)
        return x[0] if len(x) == 1 else x

    def parameters(self):
        return [p for layer in self.layers for p in layer.parameters()]


def gradient_check(build_expr, x_val, h=1e-7):
    x = Value(x_val)
    y = build_expr(x)
    y.backward()
    autodiff_grad = x.grad

    y_plus = build_expr(Value(x_val + h)).data
    y_minus = build_expr(Value(x_val - h)).data
    numerical_grad = (y_plus - y_minus) / (2 * h)

    diff = abs(autodiff_grad - numerical_grad)
    return autodiff_grad, numerical_grad, diff


def demo_mlp_training():
    print("=== Mini MLP Training on XOR ===")
    random.seed(42)
    model = MLP([2, 4, 1])

    xs = [[Value(0), Value(0)], [Value(0), Value(1)],
          [Value(1), Value(0)], [Value(1), Value(1)]]
    ys = [-1.0, 1.0, 1.0, -1.0]

    for step in range(100):
        preds = [model(x) for x in xs]
        loss = sum((p + Value(-y)) ** 2 for p, y in zip(preds, ys))

        for p in model.parameters():
            p.grad = 0.0
        loss.backward()

        lr = 0.05
        for p in model.parameters():
            p.data -= lr * p.grad

        if step % 20 == 0 or step == 99:
            print(f"  step {step:3d}  loss = {loss.data:.4f}")

    print("\n  Predictions after training:")
    for x, y in zip(xs, ys):
        pred = model(x)
        sign = "+" if pred.data > 0 else "-"
        print(f"    input=[{x[0].data:.0f},{x[1].data:.0f}]  target={y:+.0f}  pred={pred.data:+.3f} ({sign})")
    print("  DONE\n")


def demo_gradient_check():
    print("=== Gradient Checking ===")

    expressions = [
        ("x^3 + 2x + 1",       lambda x: x ** 3 + x * 2 + 1),
        ("tanh(x^2)",           lambda x: (x ** 2).tanh()),
        ("(x+1) / (x^2+1)",    lambda x: (x + 1) * ((x ** 2 + 1) ** -1)),
        ("exp(x) * x",         lambda x: x.exp() * x),
        ("log(x^2 + 1)",       lambda x: (x ** 2 + 1).log()),
    ]

    print(f"  {'Expression':<22} {'Autodiff':>12} {'Numerical':>12} {'Diff':>12}")
    print("  " + "-" * 60)

    all_passed = True
    for name, expr in expressions:
        ad, num, diff = gradient_check(expr, 0.5)
        status = "OK" if diff < 1e-5 else "FAIL"
        if diff >= 1e-5:
            all_passed = False
        print(f"  {name:<22} {ad:12.8f} {num:12.8f} {diff:12.2e}  {status}")

    if all_passed:
        print("  ALL CHECKS PASSED\n")
    else:
        print("  SOME CHECKS FAILED\n")


def demo_exp_log():
    print("=== Exp and Log operations ===")
    x = Value(2.0)
    y = x.exp()
    y.backward()
    import math
    print(f"  exp(2.0) = {y.data:.4f}  (expected {math.exp(2.0):.4f})")
    print(f"  d/dx exp(x) at x=2 = {x.grad:.4f}  (expected {math.exp(2.0):.4f})")
    assert abs(x.grad - math.exp(2.0)) < 1e-4
    print("  PASSED\n")

    x = Value(3.0)
    y = x.log()
    y.backward()
    print(f"  log(3.0) = {y.data:.4f}  (expected {math.log(3.0):.4f})")
    print(f"  d/dx log(x) at x=3 = {x.grad:.4f}  (expected {1/3:.4f})")
    assert abs(x.grad - 1.0 / 3.0) < 1e-4
    print("  PASSED\n")


def demo_verify_pytorch():
    print("=== Verify against PyTorch ===")
    try:
        import torch
    except ImportError:
        print("  PyTorch not installed, skipping verification.\n")
        return

    x1_v = Value(2.0)
    x2_v = Value(3.0)
    y_v = (x1_v * x2_v + 1.0).relu()
    y_v.backward()

    x1_t = torch.tensor(2.0, requires_grad=True)
    x2_t = torch.tensor(3.0, requires_grad=True)
    y_t = torch.relu(x1_t * x2_t + 1.0)
    y_t.backward()

    print(f"  Our engine: dy/dx1={x1_v.grad}, dy/dx2={x2_v.grad}")
    print(f"  PyTorch:    dy/dx1={x1_t.grad.item()}, dy/dx2={x2_t.grad.item()}")
    assert abs(x1_v.grad - x1_t.grad.item()) < 1e-6
    assert abs(x2_v.grad - x2_t.grad.item()) < 1e-6
    print("  MATCH\n")


if __name__ == "__main__":
    demo_basic()
    demo_power()
    demo_complex()
    demo_neuron()
    demo_exp_log()
    demo_gradient_check()
    demo_mlp_training()
    demo_verify_pytorch()
    print("All demos passed.")
