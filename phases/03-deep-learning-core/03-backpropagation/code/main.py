import math
import random


class Value:
    def __init__(self, data, children=(), op=''):
        self.data = data
        self.grad = 0.0
        self._backward = lambda: None
        self._children = set(children)
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

    def sigmoid(self):
        x = max(-500, min(500, self.data))
        s = 1.0 / (1.0 + math.exp(-x))
        out = Value(s, (self,), 'sigmoid')

        def _backward():
            self.grad += (s * (1 - s)) * out.grad

        out._backward = _backward
        return out

    def backward(self):
        topo = []
        visited = set()

        def build_topo(v):
            if v not in visited:
                visited.add(v)
                for child in v._children:
                    build_topo(child)
                topo.append(v)

        build_topo(self)
        self.grad = 1.0
        for v in reversed(topo):
            v._backward()


def mse_loss(predicted, target):
    diff = predicted + Value(-target)
    return diff * diff


class Neuron:
    def __init__(self, n_inputs):
        scale = (2.0 / n_inputs) ** 0.5
        self.weights = [Value(random.uniform(-scale, scale)) for _ in range(n_inputs)]
        self.bias = Value(0.0)

    def __call__(self, x):
        act = sum((wi * xi for wi, xi in zip(self.weights, x)), self.bias)
        return act.sigmoid()

    def parameters(self):
        return self.weights + [self.bias]


class Layer:
    def __init__(self, n_inputs, n_outputs):
        self.neurons = [Neuron(n_inputs) for _ in range(n_outputs)]

    def __call__(self, x):
        out = [n(x) for n in self.neurons]
        return out[0] if len(out) == 1 else out

    def parameters(self):
        params = []
        for n in self.neurons:
            params.extend(n.parameters())
        return params


class Network:
    def __init__(self, sizes):
        self.layers = []
        for i in range(len(sizes) - 1):
            self.layers.append(Layer(sizes[i], sizes[i + 1]))

    def __call__(self, x):
        for layer in self.layers:
            x = layer(x)
            if not isinstance(x, list):
                x = [x]
        return x[0] if len(x) == 1 else x

    def parameters(self):
        params = []
        for layer in self.layers:
            params.extend(layer.parameters())
        return params

    def zero_grad(self):
        for p in self.parameters():
            p.grad = 0.0


def train_xor():
    print("=" * 50)
    print("Training on XOR")
    print("=" * 50)

    random.seed(42)
    net = Network([2, 4, 1])

    xor_data = [
        ([0.0, 0.0], 0.0),
        ([0.0, 1.0], 1.0),
        ([1.0, 0.0], 1.0),
        ([1.0, 1.0], 0.0),
    ]

    learning_rate = 1.0

    for epoch in range(1000):
        total_loss = Value(0.0)
        for inputs, target in xor_data:
            x = [Value(i) for i in inputs]
            pred = net(x)
            loss = mse_loss(pred, target)
            total_loss = total_loss + loss

        net.zero_grad()
        total_loss.backward()

        for p in net.parameters():
            p.data -= learning_rate * p.grad

        if epoch % 100 == 0:
            print(f"Epoch {epoch:4d} | Loss: {total_loss.data:.6f}")

    print("\nXOR Results:")
    for inputs, target in xor_data:
        x = [Value(i) for i in inputs]
        pred = net(x)
        predicted_class = 1 if pred.data > 0.5 else 0
        print(f"  {inputs} -> {pred.data:.4f} (rounded: {predicted_class}, expected {int(target)})")


def generate_circle_data(n=100):
    data = []
    for _ in range(n):
        x1 = random.uniform(-1.5, 1.5)
        x2 = random.uniform(-1.5, 1.5)
        label = 1.0 if x1 * x1 + x2 * x2 < 1.0 else 0.0
        data.append(([x1, x2], label))
    return data


def train_circle():
    print("\n" + "=" * 50)
    print("Training on Circle Classification")
    print("=" * 50)

    random.seed(7)
    circle_data = generate_circle_data(80)

    net = Network([2, 8, 1])
    learning_rate = 0.5

    for epoch in range(2000):
        random.shuffle(circle_data)
        total_loss_val = 0.0
        for inputs, target in circle_data:
            x = [Value(i) for i in inputs]
            pred = net(x)
            loss = mse_loss(pred, target)
            net.zero_grad()
            loss.backward()
            for p in net.parameters():
                p.data -= learning_rate * p.grad
            total_loss_val += loss.data

        if epoch % 200 == 0:
            correct = 0
            for inputs, target in circle_data:
                x = [Value(i) for i in inputs]
                pred = net(x)
                predicted_class = 1.0 if pred.data > 0.5 else 0.0
                if predicted_class == target:
                    correct += 1
            accuracy = correct / len(circle_data) * 100
            print(f"Epoch {epoch:4d} | Loss: {total_loss_val:.4f} | Accuracy: {accuracy:.1f}%")

    print("\nSample Circle Results:")
    test_points = [
        ([0.0, 0.0], "inside"),
        ([0.5, 0.5], "inside"),
        ([1.2, 1.2], "outside"),
        ([0.0, 1.2], "outside"),
        ([-0.3, 0.3], "inside"),
    ]
    for point, expected_region in test_points:
        x = [Value(i) for i in point]
        pred = net(x)
        predicted_class = "inside" if pred.data > 0.5 else "outside"
        status = "OK" if predicted_class == expected_region else "WRONG"
        print(f"  {point} -> {pred.data:.4f} ({predicted_class}, expected {expected_region}) {status}")


if __name__ == "__main__":
    train_xor()
    train_circle()
