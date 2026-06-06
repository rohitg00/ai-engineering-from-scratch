import math
import random


def constant_schedule(step, lr=0.01, **kwargs):
    return lr


def step_decay_schedule(step, lr=0.1, step_size=100, gamma=0.1, **kwargs):
    return lr * (gamma ** (step // step_size))


def cosine_schedule(step, lr=0.01, total_steps=1000, lr_min=1e-5, **kwargs):
    if step >= total_steps:
        return lr_min
    return lr_min + 0.5 * (lr - lr_min) * (1 + math.cos(math.pi * step / total_steps))


def warmup_cosine_schedule(step, lr=0.01, total_steps=1000, warmup_steps=100, lr_min=1e-5, **kwargs):
    if total_steps <= warmup_steps:
        return lr * (step / max(warmup_steps, 1))
    if step < warmup_steps:
        return lr * step / warmup_steps
    progress = (step - warmup_steps) / (total_steps - warmup_steps)
    return lr_min + 0.5 * (lr - lr_min) * (1 + math.cos(math.pi * progress))


def one_cycle_schedule(step, lr=0.01, total_steps=1000, **kwargs):
    mid = max(total_steps // 2, 1)
    if step < mid:
        return (lr / 25) + (lr - lr / 25) * step / mid
    else:
        progress = (step - mid) / max(total_steps - mid, 1)
        return lr * (1 - progress) + (lr / 10000) * progress


def visualize_schedule(name, schedule_fn, total_steps=500, **kwargs):
    steps = list(range(0, total_steps, total_steps // 20))
    if total_steps - 1 not in steps:
        steps.append(total_steps - 1)

    lrs = [schedule_fn(s, total_steps=total_steps, **kwargs) for s in steps]
    max_lr = max(lrs) if max(lrs) > 0 else 1.0

    print(f"\n{name}:")
    for s, lr_val in zip(steps, lrs):
        bar_len = int(lr_val / max_lr * 40)
        bar = "#" * bar_len
        print(f"  Step {s:4d}: lr={lr_val:.6f} {bar}")


def sigmoid(x):
    x = max(-500, min(500, x))
    return 1.0 / (1.0 + math.exp(-x))


def relu(x):
    return max(0.0, x)


def relu_deriv(x):
    return 1.0 if x > 0 else 0.0


def make_circle_data(n=200, seed=42):
    random.seed(seed)
    data = []
    for _ in range(n):
        x = random.uniform(-2, 2)
        y = random.uniform(-2, 2)
        label = 1.0 if x * x + y * y < 1.5 else 0.0
        data.append(([x, y], label))
    return data


def train_with_schedule(schedule_fn, schedule_name, data, epochs=300, base_lr=0.05, **kwargs):
    random.seed(0)
    hidden_size = 8
    total_steps = epochs * len(data)

    std = math.sqrt(2.0 / 2)
    w1 = [[random.gauss(0, std) for _ in range(2)] for _ in range(hidden_size)]
    b1 = [0.0] * hidden_size
    w2 = [random.gauss(0, std) for _ in range(hidden_size)]
    b2 = 0.0

    step = 0
    epoch_losses = []

    for epoch in range(epochs):
        total_loss = 0
        correct = 0

        for x, target in data:
            lr = schedule_fn(step, lr=base_lr, total_steps=total_steps, **kwargs)

            z1 = []
            h = []
            for i in range(hidden_size):
                z = w1[i][0] * x[0] + w1[i][1] * x[1] + b1[i]
                z1.append(z)
                h.append(relu(z))

            z2 = sum(w2[i] * h[i] for i in range(hidden_size)) + b2
            out = sigmoid(z2)

            error = out - target
            d_out = error * out * (1 - out)

            for i in range(hidden_size):
                d_h = d_out * w2[i] * relu_deriv(z1[i])
                w2[i] -= lr * d_out * h[i]
                for j in range(2):
                    w1[i][j] -= lr * d_h * x[j]
                b1[i] -= lr * d_h
            b2 -= lr * d_out

            total_loss += (out - target) ** 2
            if (out >= 0.5) == (target >= 0.5):
                correct += 1
            step += 1

        avg_loss = total_loss / len(data)
        epoch_losses.append(avg_loss)

    return epoch_losses


def compare_schedules(data):
    configs = [
        ("Constant", constant_schedule, {}),
        ("Step Decay", step_decay_schedule, {"step_size": 15000, "gamma": 0.1}),
        ("Cosine", cosine_schedule, {"lr_min": 1e-5}),
        ("Warmup+Cosine", warmup_cosine_schedule, {"warmup_steps": 3000, "lr_min": 1e-5}),
        ("1cycle", one_cycle_schedule, {}),
    ]

    print(f"\n{'Schedule':<20} {'Start Loss':>12} {'Mid Loss':>12} {'End Loss':>12} {'Best Loss':>12}")
    print("-" * 70)

    for name, schedule_fn, extra_kwargs in configs:
        losses = train_with_schedule(schedule_fn, name, data, epochs=300, base_lr=0.05, **extra_kwargs)
        mid_idx = len(losses) // 2
        best = min(losses)
        print(f"{name:<20} {losses[0]:>12.6f} {losses[mid_idx]:>12.6f} {losses[-1]:>12.6f} {best:>12.6f}")


def lr_sensitivity(data):
    learning_rates = [1.0, 0.1, 0.05, 0.01, 0.001, 0.0001]

    print(f"\n{'LR':>10} {'Start Loss':>12} {'End Loss':>12} {'Status':>15}")
    print("-" * 52)

    for lr in learning_rates:
        losses = train_with_schedule(constant_schedule, f"lr={lr}", data, epochs=100, base_lr=lr)
        start = losses[0]
        end = losses[-1]

        if math.isnan(end) or end > 1.0:
            status = "DIVERGED"
        elif end > start * 0.9:
            status = "BARELY MOVED"
        elif end < 0.15:
            status = "CONVERGED"
        else:
            status = "LEARNING"

        end_str = f"{end:.6f}" if not math.isnan(end) else "NaN"
        print(f"{lr:>10.4f} {start:>12.6f} {end_str:>12} {status:>15}")


def warmup_impact(data):
    warmup_fractions = [0.0, 0.01, 0.05, 0.10, 0.20]
    total_steps = 300 * len(data)

    print(f"\n{'Warmup %':>10} {'Warmup Steps':>14} {'End Loss':>12} {'Best Loss':>12}")
    print("-" * 52)

    for frac in warmup_fractions:
        warmup_steps = int(total_steps * frac)
        losses = train_with_schedule(
            warmup_cosine_schedule, f"warmup={frac}", data,
            epochs=300, base_lr=0.05,
            warmup_steps=warmup_steps, lr_min=1e-5
        )
        best = min(losses)
        print(f"{frac*100:>9.0f}% {warmup_steps:>14d} {losses[-1]:>12.6f} {best:>12.6f}")


def schedule_trajectory(data):
    total_steps = 100 * len(data)
    schedules = [
        ("Constant", constant_schedule, {"lr": 0.05}),
        ("Cosine", cosine_schedule, {"lr": 0.05, "lr_min": 1e-5}),
        ("Warmup+Cosine", warmup_cosine_schedule, {"lr": 0.05, "warmup_steps": int(total_steps * 0.05), "lr_min": 1e-5}),
        ("1cycle", one_cycle_schedule, {"lr": 0.05}),
    ]

    print("\nLR at key training points:")
    print(f"  {'Schedule':<20} {'Step 0':>10} {'Step T/4':>10} {'Step T/2':>10} {'Step 3T/4':>10} {'Step T':>10}")
    print("  " + "-" * 60)

    for name, fn, kw in schedules:
        vals = []
        for s in [0, total_steps // 4, total_steps // 2, 3 * total_steps // 4, total_steps - 1]:
            vals.append(fn(s, total_steps=total_steps, **kw))
        print(f"  {name:<20} {vals[0]:>10.6f} {vals[1]:>10.6f} {vals[2]:>10.6f} {vals[3]:>10.6f} {vals[4]:>10.6f}")


if __name__ == "__main__":
    print("=" * 70)
    print("STEP 1: Schedule Shapes")
    print("=" * 70)
    visualize_schedule("Constant", constant_schedule, lr=0.05)
    visualize_schedule("Step Decay", step_decay_schedule, lr=0.05, step_size=125, gamma=0.5)
    visualize_schedule("Cosine Annealing", cosine_schedule, lr=0.05, lr_min=1e-5)
    visualize_schedule("Warmup + Cosine", warmup_cosine_schedule, lr=0.05, warmup_steps=50, lr_min=1e-5)
    visualize_schedule("1cycle", one_cycle_schedule, lr=0.05)

    data = make_circle_data()

    print("\n" + "=" * 70)
    print("STEP 2: LR Sensitivity")
    print("=" * 70)
    lr_sensitivity(data)

    print("\n" + "=" * 70)
    print("STEP 3: Schedule Comparison")
    print("=" * 70)
    compare_schedules(data)

    print("\n" + "=" * 70)
    print("STEP 4: Warmup Impact")
    print("=" * 70)
    warmup_impact(data)

    print("\n" + "=" * 70)
    print("STEP 5: Schedule Trajectory")
    print("=" * 70)
    schedule_trajectory(data)
