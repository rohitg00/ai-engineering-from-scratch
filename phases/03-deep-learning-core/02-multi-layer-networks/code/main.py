import math
import random


def sigmoid(x):
    x = max(-500.0, min(500.0, x))
    return 1.0 / (1.0 + math.exp(-x))


class Layer:
    def __init__(self, n_inputs, n_neurons, weights=None, biases=None):
        if weights is not None:
            self.weights = weights
        else:
            self.weights = [
                [random.uniform(-1, 1) for _ in range(n_inputs)]
                for _ in range(n_neurons)
            ]
        if biases is not None:
            self.biases = biases
        else:
            self.biases = [0.0] * n_neurons

    def forward(self, inputs):
        self.last_input = inputs
        self.last_output = []
        for neuron_idx in range(len(self.weights)):
            z = sum(
                w * x for w, x in zip(self.weights[neuron_idx], inputs)
            )
            z += self.biases[neuron_idx]
            self.last_output.append(sigmoid(z))
        return self.last_output


class Network:
    def __init__(self, layers):
        self.layers = layers

    def forward(self, inputs):
        current = inputs
        for layer in self.layers:
            current = layer.forward(current)
        return current

    def count_parameters(self):
        total = 0
        for layer in self.layers:
            for neuron_weights in layer.weights:
                total += len(neuron_weights)
            total += len(layer.biases)
        return total


if __name__ == "__main__":
    print("=" * 60)
    print("DEMO 1: XOR with hand-tuned 2-2-1 network")
    print("=" * 60)

    hidden = Layer(
        n_inputs=2,
        n_neurons=2,
        weights=[[20.0, 20.0], [-20.0, -20.0]],
        biases=[-10.0, 30.0],
    )

    output = Layer(
        n_inputs=2,
        n_neurons=1,
        weights=[[20.0, 20.0]],
        biases=[-30.0],
    )

    xor_net = Network([hidden, output])

    xor_data = [
        ([0, 0], 0),
        ([0, 1], 1),
        ([1, 0], 1),
        ([1, 1], 0),
    ]

    all_correct = True
    for inputs, expected in xor_data:
        result = xor_net.forward(inputs)
        predicted = 1 if result[0] >= 0.5 else 0
        status = "OK" if predicted == expected else "WRONG"
        if predicted != expected:
            all_correct = False
        print(f"  {inputs} -> {result[0]:.6f} (rounded: {predicted}, expected: {expected}) {status}")

    print(f"\nXOR solved: {all_correct}")
    print(f"Parameters: {xor_net.count_parameters()}")

    print()
    print("=" * 60)
    print("DEMO 2: Circle classification with 2-8-1 network")
    print("=" * 60)

    random.seed(42)

    data = []
    for _ in range(200):
        x = random.uniform(-1, 1)
        y = random.uniform(-1, 1)
        label = 1 if (x * x + y * y) < 0.25 else 0
        data.append(([x, y], label))

    inside_count = sum(1 for _, label in data if label == 1)
    outside_count = len(data) - inside_count
    print(f"  Dataset: {len(data)} points ({inside_count} inside, {outside_count} outside)")

    random.seed(7)
    circle_net = Network([
        Layer(n_inputs=2, n_neurons=8),
        Layer(n_inputs=8, n_neurons=1),
    ])

    correct = 0
    for inputs, expected in data:
        result = circle_net.forward(inputs)
        predicted = 1 if result[0] >= 0.5 else 0
        if predicted == expected:
            correct += 1

    print(f"  Accuracy with random weights: {correct}/{len(data)} ({100 * correct / len(data):.1f}%)")
    print(f"  Parameters: {circle_net.count_parameters()}")
    print(f"  (Random weights give poor accuracy -- training needed)")

    print()
    print("=" * 60)
    print("DEMO 3: Forward pass internals on XOR")
    print("=" * 60)

    for inputs, expected in xor_data:
        xor_net.forward(inputs)
        h = xor_net.layers[0].last_output
        o = xor_net.layers[1].last_output
        print(f"  Input: {inputs}")
        print(f"    Hidden: [{h[0]:.6f}, {h[1]:.6f}]")
        print(f"    Output: {o[0]:.6f} -> {'1' if o[0] >= 0.5 else '0'} (expected: {expected})")

    print()
    print("=" * 60)
    print("DEMO 4: Parameter count for classic architectures")
    print("=" * 60)

    architectures = [
        ("2-3-1 (this lesson)", [2, 3, 1]),
        ("2-8-1 (circle)", [2, 8, 1]),
        ("784-256-128-10 (MNIST)", [784, 256, 128, 10]),
        ("784-512-256-128-10 (deep MNIST)", [784, 512, 256, 128, 10]),
    ]

    for name, sizes in architectures:
        layers = []
        for i in range(1, len(sizes)):
            layers.append(Layer(n_inputs=sizes[i - 1], n_neurons=sizes[i]))
        net = Network(layers)
        print(f"  {name}: {net.count_parameters():,} parameters")
