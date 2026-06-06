import math
import random


class SGD:
    def __init__(self, lr=0.01):
        self.lr = lr

    def step(self, params, grads):
        for i in range(len(params)):
            params[i] -= self.lr * grads[i]


class SGDMomentum:
    def __init__(self, lr=0.01, beta=0.9):
        self.lr = lr
        self.beta = beta
        self.velocities = None

    def step(self, params, grads):
        if self.velocities is None:
            self.velocities = [0.0] * len(params)
        for i in range(len(params)):
            self.velocities[i] = self.beta * self.velocities[i] + grads[i]
            params[i] -= self.lr * self.velocities[i]


class Adam:
    def __init__(self, lr=0.001, beta1=0.9, beta2=0.999, epsilon=1e-8):
        self.lr = lr
        self.beta1 = beta1
        self.beta2 = beta2
        self.epsilon = epsilon
        self.m = None
        self.v = None
        self.t = 0

    def step(self, params, grads):
        if self.m is None:
            self.m = [0.0] * len(params)
            self.v = [0.0] * len(params)

        self.t += 1

        for i in range(len(params)):
            self.m[i] = self.beta1 * self.m[i] + (1 - self.beta1) * grads[i]
            self.v[i] = self.beta2 * self.v[i] + (1 - self.beta2) * grads[i] ** 2

            m_hat = self.m[i] / (1 - self.beta1 ** self.t)
            v_hat = self.v[i] / (1 - self.beta2 ** self.t)

            params[i] -= self.lr * m_hat / (math.sqrt(v_hat) + self.epsilon)


class AdamW:
    def __init__(self, lr=0.001, beta1=0.9, beta2=0.999, epsilon=1e-8, weight_decay=0.01):
        self.lr = lr
        self.beta1 = beta1
        self.beta2 = beta2
        self.epsilon = epsilon
        self.weight_decay = weight_decay
        self.m = None
        self.v = None
        self.t = 0

    def step(self, params, grads):
        if self.m is None:
            self.m = [0.0] * len(params)
            self.v = [0.0] * len(params)

        self.t += 1

        for i in range(len(params)):
            self.m[i] = self.beta1 * self.m[i] + (1 - self.beta1) * grads[i]
            self.v[i] = self.beta2 * self.v[i] + (1 - self.beta2) * grads[i] ** 2

            m_hat = self.m[i] / (1 - self.beta1 ** self.t)
            v_hat = self.v[i] / (1 - self.beta2 ** self.t)

            params[i] = params[i] * (1 - self.weight_decay * self.lr)
            params[i] -= self.lr * m_hat / (math.sqrt(v_hat) + self.epsilon)


def sigmoid(x):
    x = max(-500, min(500, x))
    return 1.0 / (1.0 + math.exp(-x))


def make_circle_data(n=200, seed=42):
    random.seed(seed)
    data = []
    for _ in range(n):
        x = random.uniform(-2, 2)
        y = random.uniform(-2, 2)
        label = 1.0 if x * x + y * y < 1.5 else 0.0
        data.append(([x, y], label))
    return data


class OptimizerTestNetwork:
    def __init__(self, optimizer, hidden_size=8):
        random.seed(0)
        self.hidden_size = hidden_size
        self.optimizer = optimizer

        self.w1 = [[random.gauss(0, 0.5) for _ in range(2)] for _ in range(hidden_size)]
        self.b1 = [0.0] * hidden_size
        self.w2 = [random.gauss(0, 0.5) for _ in range(hidden_size)]
        self.b2 = 0.0

    def get_params(self):
        params = []
        for row in self.w1:
            params.extend(row)
        params.extend(self.b1)
        params.extend(self.w2)
        params.append(self.b2)
        return params

    def set_params(self, params):
        idx = 0
        for i in range(self.hidden_size):
            for j in range(2):
                self.w1[i][j] = params[idx]
                idx += 1
        for i in range(self.hidden_size):
            self.b1[i] = params[idx]
            idx += 1
        for i in range(self.hidden_size):
            self.w2[i] = params[idx]
            idx += 1
        self.b2 = params[idx]

    def forward(self, x):
        self.x = x
        self.z1 = []
        self.h = []
        for i in range(self.hidden_size):
            z = self.w1[i][0] * x[0] + self.w1[i][1] * x[1] + self.b1[i]
            self.z1.append(z)
            self.h.append(max(0.0, z))

        self.z2 = sum(self.w2[i] * self.h[i] for i in range(self.hidden_size)) + self.b2
        self.out = sigmoid(self.z2)
        return self.out

    def compute_grads(self, target):
        eps = 1e-15
        p = max(eps, min(1 - eps, self.out))
        d_loss = -(target / p) + (1 - target) / (1 - p)
        d_sigmoid = self.out * (1 - self.out)
        d_out = d_loss * d_sigmoid

        grads = [0.0] * (self.hidden_size * 2 + self.hidden_size + self.hidden_size + 1)
        idx = 0
        for i in range(self.hidden_size):
            d_relu = 1.0 if self.z1[i] > 0 else 0.0
            d_h = d_out * self.w2[i] * d_relu
            grads[idx] = d_h * self.x[0]
            grads[idx + 1] = d_h * self.x[1]
            idx += 2

        for i in range(self.hidden_size):
            d_relu = 1.0 if self.z1[i] > 0 else 0.0
            grads[idx] = d_out * self.w2[i] * d_relu
            idx += 1

        for i in range(self.hidden_size):
            grads[idx] = d_out * self.h[i]
            idx += 1

        grads[idx] = d_out
        return grads

    def train(self, data, epochs=300):
        losses = []
        for epoch in range(epochs):
            total_loss = 0.0
            correct = 0
            for x, y in data:
                pred = self.forward(x)
                grads = self.compute_grads(y)
                params = self.get_params()
                self.optimizer.step(params, grads)
                self.set_params(params)

                eps = 1e-15
                p = max(eps, min(1 - eps, pred))
                total_loss += -(y * math.log(p) + (1 - y) * math.log(1 - p))
                if (pred >= 0.5) == (y >= 0.5):
                    correct += 1
            avg_loss = total_loss / len(data)
            accuracy = correct / len(data) * 100
            losses.append((avg_loss, accuracy))
            if epoch % 75 == 0 or epoch == epochs - 1:
                print(f"    Epoch {epoch:3d}: loss={avg_loss:.4f}, accuracy={accuracy:.1f}%")
        return losses


def bias_correction_demo():
    beta1 = 0.9
    beta2 = 0.999
    gradient = 1.0

    print("  Step | m_raw  | m_corrected | v_raw    | v_corrected")
    print("  " + "-" * 55)

    m = 0.0
    v = 0.0
    for t in range(1, 11):
        m = beta1 * m + (1 - beta1) * gradient
        v = beta2 * v + (1 - beta2) * gradient ** 2
        m_hat = m / (1 - beta1 ** t)
        v_hat = v / (1 - beta2 ** t)
        print(f"  {t:4d} | {m:.4f} | {m_hat:.4f}      | {v:.6f} | {v_hat:.6f}")


if __name__ == "__main__":
    print("=" * 60)
    print("STEP 1: SGD on a Simple Function")
    print("=" * 60)
    print("  Minimizing f(x) = (x - 3)^2, starting at x = 10")
    x = [10.0]
    sgd = SGD(lr=0.1)
    for step in range(20):
        grad = [2.0 * (x[0] - 3.0)]
        sgd.step(x, grad)
        loss = (x[0] - 3.0) ** 2
        if step % 5 == 0 or step == 19:
            print(f"    Step {step:2d}: x={x[0]:.6f}, loss={loss:.6f}")

    print("\n" + "=" * 60)
    print("STEP 2: Bias Correction in Adam")
    print("=" * 60)
    print("  Showing how raw moments are biased toward zero initially")
    bias_correction_demo()

    print("\n" + "=" * 60)
    print("STEP 3: Optimizer Comparison on Circle Dataset")
    print("=" * 60)
    data = make_circle_data()

    configs = [
        ("SGD (lr=0.05)", SGD(lr=0.05)),
        ("SGD+Momentum (lr=0.05, beta=0.9)", SGDMomentum(lr=0.05, beta=0.9)),
        ("Adam (lr=0.001)", Adam(lr=0.001)),
        ("AdamW (lr=0.001, wd=0.01)", AdamW(lr=0.001, weight_decay=0.01)),
    ]

    results = {}
    for name, opt in configs:
        print(f"\n--- {name} ---")
        net = OptimizerTestNetwork(opt, hidden_size=8)
        history = net.train(data, epochs=300)
        results[name] = history

    print("\n" + "=" * 60)
    print("FINAL COMPARISON")
    print("=" * 60)
    for name, history in results.items():
        final_loss, final_acc = history[-1]
        first_90 = None
        for epoch, (loss, acc) in enumerate(history):
            if acc >= 85.0:
                first_90 = epoch
                break
        reached = f"epoch {first_90}" if first_90 is not None else "never"
        print(f"  {name:40s}: acc={final_acc:.1f}%, loss={final_loss:.4f}, reached 85%: {reached}")

    print("\n" + "=" * 60)
    print("STEP 4: Weight Decay Effect")
    print("=" * 60)
    random.seed(42)
    large_weights = [random.uniform(-5, 5) for _ in range(10)]
    weights_adam = list(large_weights)
    weights_adamw = list(large_weights)

    opt_adam = Adam(lr=0.001)
    opt_adamw = AdamW(lr=0.001, weight_decay=0.1)

    print(f"  Initial weight L2 norm: {math.sqrt(sum(w*w for w in large_weights)):.4f}")

    for step in range(100):
        grads = [random.gauss(0, 0.1) for _ in range(10)]
        opt_adam.step(weights_adam, list(grads))
        opt_adamw.step(weights_adamw, list(grads))

    norm_adam = math.sqrt(sum(w * w for w in weights_adam))
    norm_adamw = math.sqrt(sum(w * w for w in weights_adamw))
    print(f"  After 100 steps:")
    print(f"    Adam  weight L2 norm: {norm_adam:.4f}")
    print(f"    AdamW weight L2 norm: {norm_adamw:.4f}")
    print(f"    AdamW shrinks weights {norm_adam/max(0.001, norm_adamw):.1f}x more")
