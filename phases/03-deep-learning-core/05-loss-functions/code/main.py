import math
import random


def mse(predictions, targets):
    assert len(predictions) == len(targets), "predictions and targets must have the same length"
    n = len(predictions)
    total = 0.0
    for p, t in zip(predictions, targets):
        total += (p - t) ** 2
    return total / n


def mse_gradient(predictions, targets):
    assert len(predictions) == len(targets), "predictions and targets must have the same length"
    n = len(predictions)
    grads = []
    for p, t in zip(predictions, targets):
        grads.append(2.0 * (p - t) / n)
    return grads


def binary_cross_entropy(predictions, targets, eps=1e-15):
    assert len(predictions) == len(targets), "predictions and targets must have the same length"
    n = len(predictions)
    total = 0.0
    for p, t in zip(predictions, targets):
        p_clipped = max(eps, min(1 - eps, p))
        total += -(t * math.log(p_clipped) + (1 - t) * math.log(1 - p_clipped))
    return total / n


def bce_gradient(predictions, targets, eps=1e-15):
    assert len(predictions) == len(targets), "predictions and targets must have the same length"
    n = len(predictions)
    grads = []
    for p, t in zip(predictions, targets):
        p_clipped = max(eps, min(1 - eps, p))
        grads.append((-(t / p_clipped) + (1 - t) / (1 - p_clipped)) / n)
    return grads


def softmax(logits):
    max_val = max(logits)
    exps = [math.exp(x - max_val) for x in logits]
    total = sum(exps)
    return [e / total for e in exps]


def categorical_cross_entropy(logits, target_index, eps=1e-15):
    probs = softmax(logits)
    p = max(eps, probs[target_index])
    return -math.log(p)


def cce_gradient(logits, target_index):
    probs = softmax(logits)
    grads = list(probs)
    grads[target_index] -= 1.0
    return grads


def label_smoothed_cce(logits, target_index, num_classes, alpha=0.1, eps=1e-15):
    probs = softmax(logits)
    loss = 0.0
    for i in range(num_classes):
        if i == target_index:
            smooth_target = 1.0 - alpha + alpha / num_classes
        else:
            smooth_target = alpha / num_classes
        p = max(eps, probs[i])
        loss += -smooth_target * math.log(p)
    return loss


def cosine_similarity(a, b):
    assert len(a) == len(b), "vectors must have the same length"
    dot = sum(x * y for x, y in zip(a, b))
    norm_a = math.sqrt(sum(x * x for x in a))
    norm_b = math.sqrt(sum(x * x for x in b))
    if norm_a < 1e-10 or norm_b < 1e-10:
        return 0.0
    return dot / (norm_a * norm_b)


def contrastive_loss(anchor, positive, negatives, temperature=0.07):
    sim_pos = cosine_similarity(anchor, positive) / temperature
    sim_negs = [cosine_similarity(anchor, neg) / temperature for neg in negatives]

    max_sim = max(sim_pos, max(sim_negs)) if sim_negs else sim_pos
    exp_pos = math.exp(sim_pos - max_sim)
    exp_negs = [math.exp(s - max_sim) for s in sim_negs]
    total_exp = exp_pos + sum(exp_negs)

    return -math.log(max(1e-15, exp_pos / total_exp))


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


class LossComparisonNetwork:
    def __init__(self, loss_type="bce", hidden_size=8, lr=0.1):
        random.seed(0)
        self.loss_type = loss_type
        self.lr = lr
        self.hidden_size = hidden_size

        self.w1 = [[random.gauss(0, 0.5) for _ in range(2)] for _ in range(hidden_size)]
        self.b1 = [0.0] * hidden_size
        self.w2 = [random.gauss(0, 0.5) for _ in range(hidden_size)]
        self.b2 = 0.0

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

    def backward(self, target):
        if self.loss_type == "mse":
            d_loss = 2.0 * (self.out - target)
        else:
            eps = 1e-15
            p = max(eps, min(1 - eps, self.out))
            d_loss = -(target / p) + (1 - target) / (1 - p)

        d_sigmoid = self.out * (1 - self.out)
        d_out = d_loss * d_sigmoid

        for i in range(self.hidden_size):
            d_relu = 1.0 if self.z1[i] > 0 else 0.0
            d_h = d_out * self.w2[i] * d_relu
            self.w2[i] -= self.lr * d_out * self.h[i]
            for j in range(2):
                self.w1[i][j] -= self.lr * d_h * self.x[j]
            self.b1[i] -= self.lr * d_h
        self.b2 -= self.lr * d_out

    def compute_loss(self, pred, target):
        if self.loss_type == "mse":
            return (pred - target) ** 2
        else:
            eps = 1e-15
            p = max(eps, min(1 - eps, pred))
            return -(target * math.log(p) + (1 - target) * math.log(1 - p))

    def train(self, data, epochs=200):
        losses = []
        for epoch in range(epochs):
            total_loss = 0.0
            correct = 0
            for x, y in data:
                pred = self.forward(x)
                self.backward(y)
                total_loss += self.compute_loss(pred, y)
                if (pred >= 0.5) == (y >= 0.5):
                    correct += 1
            avg_loss = total_loss / len(data)
            accuracy = correct / len(data) * 100
            losses.append((avg_loss, accuracy))
            if epoch % 50 == 0 or epoch == epochs - 1:
                print(f"    Epoch {epoch:3d}: loss={avg_loss:.4f}, accuracy={accuracy:.1f}%")
        return losses


if __name__ == "__main__":
    print("=" * 60)
    print("STEP 1: MSE Loss")
    print("=" * 60)
    preds = [0.9, 0.1, 0.7, 0.4]
    targets = [1.0, 0.0, 1.0, 0.0]
    print(f"  Predictions: {preds}")
    print(f"  Targets:     {targets}")
    print(f"  MSE Loss:    {mse(preds, targets):.6f}")
    print(f"  MSE Grads:   {[f'{g:.4f}' for g in mse_gradient(preds, targets)]}")

    print("\n" + "=" * 60)
    print("STEP 2: Binary Cross-Entropy")
    print("=" * 60)
    print(f"  Predictions: {preds}")
    print(f"  Targets:     {targets}")
    print(f"  BCE Loss:    {binary_cross_entropy(preds, targets):.6f}")
    print(f"  BCE Grads:   {[f'{g:.4f}' for g in bce_gradient(preds, targets)]}")

    print("\n  CE loss at different confidence levels (true label = 1):")
    for conf in [0.01, 0.1, 0.5, 0.9, 0.99]:
        ce = -(1.0 * math.log(max(1e-15, conf)))
        ms = (conf - 1.0) ** 2
        print(f"    p={conf:.2f}: CE={ce:.4f}, MSE={ms:.4f}, ratio={ce/max(0.0001, ms):.1f}x")

    print("\n" + "=" * 60)
    print("STEP 3: Categorical Cross-Entropy + Softmax")
    print("=" * 60)
    logits = [2.0, 1.0, 0.1, -1.0, 3.0]
    target_idx = 4
    probs = softmax(logits)
    print(f"  Logits:  {logits}")
    print(f"  Softmax: {[f'{p:.4f}' for p in probs]}")
    print(f"  Target class: {target_idx}")
    print(f"  CCE Loss: {categorical_cross_entropy(logits, target_idx):.6f}")
    print(f"  Gradient: {[f'{g:.4f}' for g in cce_gradient(logits, target_idx)]}")

    print("\n" + "=" * 60)
    print("STEP 4: Label Smoothing")
    print("=" * 60)
    num_classes = 5
    hard_loss = categorical_cross_entropy(logits, target_idx)
    smooth_loss = label_smoothed_cce(logits, target_idx, num_classes, alpha=0.1)
    print(f"  Hard target loss:    {hard_loss:.6f}")
    print(f"  Smooth target loss:  {smooth_loss:.6f}")
    print(f"  Smoothing increases loss by {smooth_loss - hard_loss:.6f}")
    print(f"  This prevents overconfidence by targeting 0.9 instead of 1.0")

    print("\n" + "=" * 60)
    print("STEP 5: Contrastive Loss")
    print("=" * 60)
    random.seed(42)
    anchor = [random.gauss(0, 1) for _ in range(8)]
    positive = [a + random.gauss(0, 0.1) for a in anchor]
    negatives = [[random.gauss(0, 1) for _ in range(8)] for _ in range(7)]

    loss_val = contrastive_loss(anchor, positive, negatives, temperature=0.07)
    sim_pos = cosine_similarity(anchor, positive)
    sim_negs = [cosine_similarity(anchor, neg) for neg in negatives]
    print(f"  Anchor-positive similarity: {sim_pos:.4f}")
    print(f"  Anchor-negative similarities: {[f'{s:.4f}' for s in sim_negs]}")
    print(f"  Contrastive loss (tau=0.07): {loss_val:.4f}")

    loss_easy = contrastive_loss(anchor, positive, negatives, temperature=0.5)
    print(f"  Contrastive loss (tau=0.5):  {loss_easy:.4f}")
    print(f"  Lower temperature = sharper = higher loss for imperfect separation")

    print("\n" + "=" * 60)
    print("STEP 6: MSE vs Cross-Entropy on Classification")
    print("=" * 60)
    data = make_circle_data()

    for loss_type in ["mse", "bce"]:
        print(f"\n--- Training with {loss_type.upper()} ---")
        net = LossComparisonNetwork(loss_type=loss_type, hidden_size=8, lr=0.1)
        results = net.train(data, epochs=200)
        final_loss, final_acc = results[-1]
        print(f"  Final: loss={final_loss:.4f}, accuracy={final_acc:.1f}%")

    print("\n=== Key Takeaway ===")
    print("  Cross-entropy converges faster on classification because its")
    print("  gradient is strong when predictions are wrong and weak when correct.")
    print("  MSE gradient flattens near 0 and 1 due to sigmoid saturation.")
