import math
import struct
import random


def softmax_naive(logits):
    exps = [math.exp(z) for z in logits]
    total = sum(exps)
    return [e / total for e in exps]


def softmax_stable(logits):
    max_logit = max(logits)
    exps = [math.exp(z - max_logit) for z in logits]
    total = sum(exps)
    return [e / total for e in exps]


def logsumexp_naive(values):
    return math.log(sum(math.exp(v) for v in values))


def logsumexp_stable(values):
    c = max(values)
    return c + math.log(sum(math.exp(v - c) for v in values))


def log_softmax_stable(logits):
    c = max(logits)
    lse = c + math.log(sum(math.exp(z - c) for z in logits))
    return [z - lse for z in logits]


def cross_entropy_naive(true_class, logits):
    probs = softmax_naive(logits)
    return -math.log(probs[true_class])


def cross_entropy_stable(true_class, logits):
    log_probs = log_softmax_stable(logits)
    return -log_probs[true_class]


def sigmoid_naive(x):
    return 1.0 / (1.0 + math.exp(-x))


def sigmoid_stable(x):
    if x >= 0:
        z = math.exp(-x)
        return 1.0 / (1.0 + z)
    else:
        z = math.exp(x)
        return z / (1.0 + z)


def binary_cross_entropy_naive(y_true, y_pred):
    return -(y_true * math.log(y_pred) + (1 - y_true) * math.log(1 - y_pred))


def binary_cross_entropy_stable(y_true, logit):
    max_val = max(0.0, -logit)
    return max_val + math.log(math.exp(-max_val) + math.exp(-logit - max_val)) - y_true * logit


def numerical_gradient(f, x, h=1e-5):
    grad = []
    for i in range(len(x)):
        x_plus = x[:]
        x_minus = x[:]
        x_plus[i] += h
        x_minus[i] -= h
        grad.append((f(x_plus) - f(x_minus)) / (2 * h))
    return grad


def check_gradient(analytical, numerical, tolerance=1e-5):
    all_ok = True
    for i, (a, n) in enumerate(zip(analytical, numerical)):
        denom = max(abs(a), abs(n), 1e-8)
        rel_error = abs(a - n) / denom
        status = "OK" if rel_error < tolerance else "FAIL"
        if status == "FAIL":
            all_ok = False
        print(f"  param {i}: analytical={a:.8f} numerical={n:.8f} "
              f"rel_error={rel_error:.2e} [{status}]")
    return all_ok


def clip_by_value(gradients, max_val):
    return [max(-max_val, min(max_val, g)) for g in gradients]


def clip_by_norm(gradients, max_norm):
    total_norm = math.sqrt(sum(g ** 2 for g in gradients))
    if total_norm > max_norm:
        scale = max_norm / total_norm
        return [g * scale for g in gradients]
    return list(gradients)


def check_tensor(name, values):
    has_nan = any(math.isnan(v) for v in values)
    has_inf = any(math.isinf(v) for v in values)
    n_nan = sum(1 for v in values if math.isnan(v))
    n_inf = sum(1 for v in values if math.isinf(v))
    if has_nan or has_inf:
        print(f"  WARNING {name}: {n_nan} NaN, {n_inf} Inf out of {len(values)} values")
        return False
    print(f"  OK {name}: all {len(values)} values finite")
    return True


def simulate_bfloat16(x):
    packed = struct.pack('f', x)
    as_int = int.from_bytes(packed, 'little')
    truncated = as_int & 0xFFFF0000
    repacked = truncated.to_bytes(4, 'little')
    return struct.unpack('f', repacked)[0]


def simulate_float16(x):
    try:
        packed = struct.pack('e', x)
        return struct.unpack('e', packed)[0]
    except (OverflowError, struct.error):
        return float('inf') if x > 0 else float('-inf')


def kahan_sum(values):
    total = 0.0
    compensation = 0.0
    for v in values:
        y = v - compensation
        t = total + y
        compensation = (t - total) - y
        total = t
    return total


def welford_variance(values):
    n = 0
    mean = 0.0
    m2 = 0.0
    for x in values:
        n += 1
        delta = x - mean
        mean += delta / n
        delta2 = x - mean
        m2 += delta * delta2
    if n < 2:
        return 0.0
    return m2 / n


def variance_naive(values):
    n = len(values)
    mean_x = sum(values) / n
    mean_x2 = sum(v ** 2 for v in values) / n
    return mean_x2 - mean_x ** 2


def layer_norm(values, epsilon=1e-5, gamma=1.0, beta=0.0):
    n = len(values)
    mean = sum(values) / n
    var = sum((v - mean) ** 2 for v in values) / n
    std = math.sqrt(var + epsilon)
    return [(v - mean) / std * gamma + beta for v in values]


def demo_float_precision():
    print("=" * 60)
    print("DEMO 1: Floating Point Precision Limits")
    print("=" * 60)

    print(f"\n  0.1 + 0.2 = {0.1 + 0.2}")
    print(f"  0.1 + 0.2 == 0.3? {0.1 + 0.2 == 0.3}")
    print(f"  Difference from 0.3: {(0.1 + 0.2) - 0.3:.2e}")
    print(f"  math.isclose(0.1 + 0.2, 0.3): {math.isclose(0.1 + 0.2, 0.3)}")

    print(f"\n  Float32 max: ~{3.4028235e+38:.2e}")
    print(f"  Float32 min positive (normal): ~{1.175e-38:.2e}")
    print(f"  Float32 epsilon: ~{1.1920929e-07:.2e}")

    print(f"\n  1.0 + 1e-7 == 1.0?  {1.0 + 1e-7 == 1.0}")
    print(f"  1.0 + 1e-8 == 1.0?  {1.0 + 1e-8 == 1.0}")
    print(f"  (These are float64 in Python. In float32, epsilon is ~1.19e-7)")

    total_naive = 0.0
    for _ in range(1_000_000):
        total_naive += 1e-7
    total_kahan = kahan_sum([1e-7] * 1_000_000)
    true_value = 1e-7 * 1_000_000

    print(f"\n  Summing 1e-7 one million times:")
    print(f"  True value:  {true_value}")
    print(f"  Naive sum:   {total_naive:.10f}  (error: {abs(total_naive - true_value):.2e})")
    print(f"  Kahan sum:   {total_kahan:.10f}  (error: {abs(total_kahan - true_value):.2e})")
    print()


def demo_catastrophic_cancellation():
    print("=" * 60)
    print("DEMO 2: Catastrophic Cancellation")
    print("=" * 60)

    data = [1_000_000.0, 1_000_001.0, 1_000_002.0]
    true_var = 2.0 / 3.0

    var_naive = variance_naive(data)
    var_welford = welford_variance(data)

    print(f"\n  Data: {data}")
    print(f"  True variance: {true_var:.10f}")
    print(f"  Naive (E[x^2] - E[x]^2): {var_naive:.10f}")
    print(f"  Welford (online):         {var_welford:.10f}")
    print(f"  Naive error:   {abs(var_naive - true_var):.2e}")
    print(f"  Welford error: {abs(var_welford - true_var):.2e}")

    a = 1.0000001
    b = 1.0000000
    true_diff = 1e-7
    computed_diff = a - b
    rel_error = abs(computed_diff - true_diff) / true_diff * 100

    print(f"\n  Subtracting nearly equal numbers:")
    print(f"  a = {a}")
    print(f"  b = {b}")
    print(f"  True a - b = {true_diff}")
    print(f"  Computed:    {computed_diff}")
    print(f"  Relative error: {rel_error:.1f}%")
    print()


def demo_overflow_underflow():
    print("=" * 60)
    print("DEMO 3: Overflow and Underflow in exp() and log()")
    print("=" * 60)

    print("\n  exp() overflow boundary (float64 in Python):")
    for x in [700, 709, 709.78, 710]:
        try:
            result = math.exp(x)
            print(f"  exp({x}) = {result:.4e}")
        except OverflowError:
            print(f"  exp({x}) = OVERFLOW")

    print("\n  exp() underflow (results become 0.0):")
    for x in [-700, -745, -746]:
        result = math.exp(x)
        print(f"  exp({x}) = {result}")

    print("\n  log() edge cases:")
    for x in [1.0, 1e-300, 1e-323, 0.0]:
        try:
            if x == 0.0:
                print(f"  log(0.0) = -inf  (mathematically)")
                result = math.log(1e-323)
                print(f"  log(1e-323) = {result:.2f}  (closest we can get)")
            else:
                result = math.log(x)
                print(f"  log({x}) = {result:.4f}")
        except ValueError:
            print(f"  log({x}) = DOMAIN ERROR")

    print("\n  Float16 overflow boundary:")
    for val in [65000.0, 65504.0, 65520.0, 70000.0]:
        f16 = simulate_float16(val)
        print(f"  float16({val}) = {f16}")
    print()


def demo_softmax_stability():
    print("=" * 60)
    print("DEMO 4: Naive vs Stable Softmax")
    print("=" * 60)

    safe_logits = [2.0, 1.0, 0.1]
    print(f"\n  Safe logits: {safe_logits}")
    naive_result = softmax_naive(safe_logits)
    stable_result = softmax_stable(safe_logits)
    print(f"  Naive:  {[f'{p:.6f}' for p in naive_result]}")
    print(f"  Stable: {[f'{p:.6f}' for p in stable_result]}")
    print(f"  Match: {all(abs(a - b) < 1e-10 for a, b in zip(naive_result, stable_result))}")

    moderate_logits = [100.0, 101.0, 102.0]
    print(f"\n  Moderate logits: {moderate_logits}")
    stable_result = softmax_stable(moderate_logits)
    print(f"  Stable: {[f'{p:.6f}' for p in stable_result]}")
    try:
        naive_result = softmax_naive(moderate_logits)
        print(f"  Naive:  {[f'{p:.6f}' for p in naive_result]}")
    except OverflowError:
        print("  Naive:  OVERFLOW (exp(100) too large)")

    extreme_logits = [1000.0, 1001.0, 1002.0]
    print(f"\n  Extreme logits: {extreme_logits}")
    stable_result = softmax_stable(extreme_logits)
    print(f"  Stable: {[f'{p:.6f}' for p in stable_result]}")
    print("  Naive:  would be [nan, nan, nan] or OVERFLOW")

    negative_logits = [-1000.0, -999.0, -998.0]
    print(f"\n  Very negative logits: {negative_logits}")
    stable_result = softmax_stable(negative_logits)
    print(f"  Stable: {[f'{p:.6f}' for p in stable_result]}")
    print("  Naive:  would be [0/0 = nan] (all exp() underflow to 0)")
    print()


def demo_logsumexp():
    print("=" * 60)
    print("DEMO 5: Log-Sum-Exp Trick")
    print("=" * 60)

    safe = [1.0, 2.0, 3.0]
    print(f"\n  Safe values: {safe}")
    print(f"  Naive:  {logsumexp_naive(safe):.10f}")
    print(f"  Stable: {logsumexp_stable(safe):.10f}")

    large = [500.0, 501.0, 502.0]
    print(f"\n  Large values: {large}")
    print(f"  Stable: {logsumexp_stable(large):.10f}")
    try:
        naive = logsumexp_naive(large)
        print(f"  Naive:  {naive}")
    except OverflowError:
        print("  Naive:  OVERFLOW")

    very_negative = [-1000.0, -999.0, -998.0]
    print(f"\n  Very negative values: {very_negative}")
    print(f"  Stable: {logsumexp_stable(very_negative):.10f}")

    equal = [5.0, 5.0, 5.0]
    print(f"\n  Equal values: {equal}")
    expected = 5.0 + math.log(3.0)
    print(f"  Stable:   {logsumexp_stable(equal):.10f}")
    print(f"  Expected: {expected:.10f} (= 5.0 + ln(3))")

    one_dominant = [100.0, 1.0, 1.0]
    print(f"\n  One dominant value: {one_dominant}")
    print(f"  Stable: {logsumexp_stable(one_dominant):.10f}")
    print(f"  ~100.0 (dominated by exp(100))")
    print()


def demo_cross_entropy():
    print("=" * 60)
    print("DEMO 6: Stable Cross-Entropy Loss")
    print("=" * 60)

    logits = [2.0, 5.0, 1.0]
    true_class = 1

    print(f"\n  Logits: {logits}, true class: {true_class}")
    ce_naive = cross_entropy_naive(true_class, logits)
    ce_stable = cross_entropy_stable(true_class, logits)
    print(f"  Naive:  {ce_naive:.10f}")
    print(f"  Stable: {ce_stable:.10f}")
    print(f"  Match:  {abs(ce_naive - ce_stable) < 1e-10}")

    large_logits = [100.0, 105.0, 99.0]
    true_class = 1
    print(f"\n  Large logits: {large_logits}, true class: {true_class}")
    ce_stable = cross_entropy_stable(true_class, large_logits)
    print(f"  Stable: {ce_stable:.10f}")
    try:
        ce_naive = cross_entropy_naive(true_class, large_logits)
        print(f"  Naive:  {ce_naive:.10f}")
    except (OverflowError, ValueError):
        print("  Naive:  OVERFLOW or NaN")

    confident_logits = [0.0, 0.0, 50.0]
    true_class = 2
    ce = cross_entropy_stable(true_class, confident_logits)
    print(f"\n  Very confident prediction:")
    print(f"  Logits: {confident_logits}, true class: {true_class}")
    print(f"  Loss: {ce:.10f}  (near zero, model is correct and confident)")

    wrong_logits = [0.0, 0.0, 50.0]
    true_class = 0
    ce = cross_entropy_stable(true_class, wrong_logits)
    print(f"\n  Very wrong prediction:")
    print(f"  Logits: {wrong_logits}, true class: {true_class}")
    print(f"  Loss: {ce:.4f}  (very large, model is confident but wrong)")
    print()


def demo_sigmoid_stability():
    print("=" * 60)
    print("DEMO 7: Stable Sigmoid")
    print("=" * 60)

    test_values = [0.0, 1.0, -1.0, 10.0, -10.0, 100.0, -100.0, 500.0, -500.0, 710.0, -710.0]
    print(f"\n  {'x':>8s}  {'naive':>14s}  {'stable':>14s}")
    print(f"  {'-'*8}  {'-'*14}  {'-'*14}")
    for x in test_values:
        try:
            naive = sigmoid_naive(x)
            naive_str = f"{naive:.10f}"
        except OverflowError:
            naive_str = "OVERFLOW"
        stable = sigmoid_stable(x)
        print(f"  {x:>8.1f}  {naive_str:>14s}  {stable:.10f}")
    print()


def demo_gradient_checking():
    print("=" * 60)
    print("DEMO 8: Gradient Checking")
    print("=" * 60)

    print("\n  Test 1: f(x,y) = x^2 + 3xy + y^3")

    def f1(params):
        x, y = params
        return x ** 2 + 3 * x * y + y ** 3

    def f1_grad(params):
        x, y = params
        return [2 * x + 3 * y, 3 * x + 3 * y ** 2]

    point = [2.0, 1.0]
    analytical = f1_grad(point)
    numerical = numerical_gradient(f1, point)
    print(f"  Point: {point}")
    check_gradient(analytical, numerical)

    print("\n  Test 2: f(x) = softmax cross-entropy")

    def f2(logits):
        return cross_entropy_stable(0, logits)

    logits = [2.0, 1.0, 0.5]
    probs = softmax_stable(logits)
    analytical_ce = [probs[i] - (1.0 if i == 0 else 0.0) for i in range(len(logits))]
    numerical_ce = numerical_gradient(f2, logits)
    print(f"  Logits: {logits}")
    check_gradient(analytical_ce, numerical_ce)

    print("\n  Test 3: Deliberately wrong gradient (should FAIL)")

    def f3(params):
        x, y = params
        return x ** 2 + y ** 2

    wrong_grad = [1.0, 1.0]
    numerical_f3 = numerical_gradient(f3, [3.0, 4.0])
    print(f"  Wrong analytical: {wrong_grad}")
    print(f"  Correct numerical: {[f'{g:.4f}' for g in numerical_f3]}")
    check_gradient(wrong_grad, numerical_f3)
    print()


def demo_nan_inf():
    print("=" * 60)
    print("DEMO 9: NaN and Inf Detection and Propagation")
    print("=" * 60)

    print("\n  How inf appears:")
    print(f"  1.0 / 0.0    = {float('inf')}")
    print(f"  exp(710)     = overflow -> inf")
    print(f"  1e308 * 10   = {1e308 * 10}")

    print("\n  How nan appears:")
    print(f"  0.0 / 0.0        = {float('nan')}")
    print(f"  inf - inf        = {float('inf') - float('inf')}")
    print(f"  inf * 0          = {float('inf') * 0}")
    print(f"  nan + 1          = {float('nan') + 1}")
    print(f"  nan == nan       = {float('nan') == float('nan')}")
    print(f"  nan < 0          = {float('nan') < 0}")
    print(f"  nan > 0          = {float('nan') > 0}")

    print("\n  NaN propagation (one nan ruins everything):")
    values = [1.0, 2.0, float('nan'), 4.0, 5.0]
    print(f"  values = {values}")
    print(f"  sum    = {sum(values)}")
    print(f"  max    = nan (comparison with nan is always False)")
    print(f"  mean   = {sum(values) / len(values)}")

    print("\n  Tensor health checks:")
    check_tensor("weights", [0.1, -0.3, 0.5, 0.2])
    check_tensor("logits_bad", [1.0, float('inf'), -2.0])
    check_tensor("grads_bad", [0.01, float('nan'), -0.03])
    check_tensor("activations", [0.0, 0.5, 1.0, 0.3])
    print()


def demo_gradient_clipping():
    print("=" * 60)
    print("DEMO 10: Gradient Clipping")
    print("=" * 60)

    grads = [10.0, 20.0, 30.0]
    norm = math.sqrt(sum(g ** 2 for g in grads))

    print(f"\n  Gradients: {grads}")
    print(f"  Norm: {norm:.4f}")

    clipped_val = clip_by_value(grads, max_val=15.0)
    clipped_norm = clip_by_norm(grads, max_norm=5.0)

    print(f"\n  Clip by value (max=15.0): {clipped_val}")
    print(f"  Clip by value changes direction: "
          f"{[g/grads[0] for g in grads]} vs {[g/clipped_val[0] for g in clipped_val]}")

    print(f"\n  Clip by norm (max=5.0): {[f'{g:.4f}' for g in clipped_norm]}")
    clipped_norm_val = math.sqrt(sum(g ** 2 for g in clipped_norm))
    print(f"  Clipped norm: {clipped_norm_val:.4f}")
    print(f"  Direction preserved: "
          f"{[round(g/grads[0], 4) for g in grads]} == "
          f"{[round(g/clipped_norm[0], 4) for g in clipped_norm]}")

    print("\n  Gradient explosion simulation:")
    grad_val = 1.0
    max_norm = 1.0
    for step in range(8):
        grad_val *= 3.5
        clipped = clip_by_norm([grad_val], max_norm)[0]
        print(f"  Step {step}: raw_grad={grad_val:>12.2f}  clipped={clipped:>8.4f}")
    print()


def demo_mixed_precision():
    print("=" * 60)
    print("DEMO 11: Mixed Precision and Loss Scaling")
    print("=" * 60)

    print("\n  bfloat16 vs float16 precision:")
    test_values = [1.0, 0.1, 3.14159, 100.0, 65504.0, 65536.0, 100000.0]
    print(f"  {'value':>12s}  {'float16':>12s}  {'bfloat16':>12s}")
    print(f"  {'-'*12}  {'-'*12}  {'-'*12}")
    for v in test_values:
        f16 = simulate_float16(v)
        bf16 = simulate_bfloat16(v)
        f16_str = f"{f16:.4f}" if not math.isinf(f16) else "inf"
        bf16_str = f"{bf16:.4f}" if not math.isinf(bf16) else "inf"
        print(f"  {v:>12.4f}  {f16_str:>12s}  {bf16_str:>12s}")

    print("\n  Loss scaling simulation:")
    random.seed(42)
    n_grads = 1000
    tiny_grads = [random.uniform(1e-9, 1e-5) for _ in range(n_grads)]

    zeros_without_scaling = sum(1 for g in tiny_grads if simulate_float16(g) == 0.0)

    scale = 1024.0
    scaled_grads = [g * scale for g in tiny_grads]
    zeros_with_scaling = sum(1 for g in scaled_grads if simulate_float16(g) == 0.0)

    scaled_back = [simulate_float16(g * scale) / scale for g in tiny_grads]
    zeros_after_roundtrip = sum(1 for g in scaled_back if g == 0.0)

    print(f"  {n_grads} gradients in range [1e-9, 1e-5]")
    print(f"  Zeros without scaling: {zeros_without_scaling}/{n_grads} "
          f"({zeros_without_scaling/n_grads*100:.1f}%)")
    print(f"  Zeros with scaling (x{scale:.0f}): {zeros_with_scaling}/{n_grads} "
          f"({zeros_with_scaling/n_grads*100:.1f}%)")
    print(f"  Zeros after scale+convert+unscale: {zeros_after_roundtrip}/{n_grads} "
          f"({zeros_after_roundtrip/n_grads*100:.1f}%)")

    print("\n  Dynamic loss scaling simulation:")
    scale_factor = 65536.0
    no_overflow_steps = 0
    growth_interval = 100

    print(f"  {'step':>6s}  {'scale':>12s}  {'event':s}")
    for step in range(500):
        grad = random.gauss(0, 1)
        scaled = grad * scale_factor
        if math.isinf(simulate_float16(scaled)):
            scale_factor /= 2
            no_overflow_steps = 0
            if step < 20 or step % 100 == 0:
                print(f"  {step:>6d}  {scale_factor:>12.0f}  overflow -> halved")
        else:
            no_overflow_steps += 1
            if no_overflow_steps >= growth_interval:
                scale_factor *= 2
                no_overflow_steps = 0
                if step < 100 or step % 100 == 0:
                    print(f"  {step:>6d}  {scale_factor:>12.0f}  stable -> doubled")
    print(f"  Final scale factor: {scale_factor:.0f}")
    print()


def demo_layer_norm():
    print("=" * 60)
    print("DEMO 12: Normalization as Numerical Stabilizer")
    print("=" * 60)

    print("\n  Without normalization (values grow through layers):")
    values = [1.0, 0.5, -0.3, 0.8, -0.1]
    for layer in range(10):
        values = [max(0, v * 2.5 + 0.1) for v in values]
        max_val = max(abs(v) for v in values)
        if layer % 2 == 0:
            print(f"  Layer {layer:>2d}: max={max_val:>12.2f}  values={[f'{v:.2f}' for v in values[:3]]}...")

    print("\n  With layer normalization (values stay bounded):")
    values = [1.0, 0.5, -0.3, 0.8, -0.1]
    for layer in range(10):
        values = [max(0, v * 2.5 + 0.1) for v in values]
        values = layer_norm(values)
        max_val = max(abs(v) for v in values)
        if layer % 2 == 0:
            print(f"  Layer {layer:>2d}: max={max_val:>6.4f}  values={[f'{v:.4f}' for v in values[:3]]}...")
    print()


def demo_common_bugs():
    print("=" * 60)
    print("DEMO 13: Common ML Numerical Bugs")
    print("=" * 60)

    print("\n  Bug 1: log(0) from confident wrong prediction")
    logits = [100.0, -100.0, -100.0]
    probs = softmax_stable(logits)
    print(f"  Softmax: {[f'{p:.2e}' for p in probs]}")
    print(f"  If true class is 1: log({probs[1]:.2e}) = ", end="")
    if probs[1] == 0.0:
        print("log(0) = -inf (CRASH)")
    else:
        print(f"{math.log(probs[1]):.2f}")
    print(f"  Stable cross-entropy handles this: {cross_entropy_stable(1, logits):.4f}")

    print("\n  Bug 2: exp() overflow in naive softmax")
    logits = [800.0, 801.0, 802.0]
    try:
        naive = softmax_naive(logits)
        print(f"  Naive softmax: {naive}")
    except OverflowError:
        print("  Naive softmax: OverflowError (exp(800) is too large)")
    stable = softmax_stable(logits)
    print(f"  Stable softmax: {[f'{p:.6f}' for p in stable]}")

    print("\n  Bug 3: Variance underflow with large-mean data")
    data = [1e8 + 1, 1e8 + 2, 1e8 + 3, 1e8 + 4, 1e8 + 5]
    var_naive = variance_naive(data)
    var_welford = welford_variance(data)
    true_var = 2.0
    print(f"  Data: [{data[0]:.0f}, ..., {data[-1]:.0f}]")
    print(f"  True variance: {true_var}")
    print(f"  Naive:   {var_naive:.6f}  (error: {abs(var_naive - true_var):.2e})")
    print(f"  Welford: {var_welford:.6f}  (error: {abs(var_welford - true_var):.2e})")

    print("\n  Bug 4: Float comparison in training loop")
    loss = 0.0
    for _ in range(10):
        loss += 0.1
    print(f"  After 10 steps of loss += 0.1: loss = {loss}")
    print(f"  loss == 1.0? {loss == 1.0} (WRONG)")
    print(f"  math.isclose(loss, 1.0)? {math.isclose(loss, 1.0)} (CORRECT)")

    print("\n  Bug 5: NaN from 0/0 in normalization")
    values = [5.0, 5.0, 5.0, 5.0]
    mean = sum(values) / len(values)
    var = sum((v - mean) ** 2 for v in values) / len(values)
    print(f"  Constant input: {values}")
    print(f"  Variance: {var}")
    print(f"  1/sqrt(var) = 1/sqrt(0) = ", end="")
    try:
        result = 1.0 / math.sqrt(var)
        print(f"{result}")
    except ZeroDivisionError:
        print("ZeroDivisionError")
    safe = 1.0 / math.sqrt(var + 1e-5)
    print(f"  1/sqrt(var + 1e-5) = {safe:.2f} (safe with epsilon)")
    print()


def demo_format_comparison():
    print("=" * 60)
    print("DEMO 14: Float Format Comparison Summary")
    print("=" * 60)

    print(f"""
  Format     Bits  Exp  Mantissa  ~Digits  Max Value       Best For
  -------    ----  ---  --------  -------  ----------      --------
  float64    64    11   52        15-16    1.8e308         CPU training, accumulation
  float32    32    8    23        7-8      3.4e38          Default training
  float16    16    5    10        3-4      65,504          Inference
  bfloat16   16    8    7         2-3      3.4e38          GPU/TPU training
  float8     8     4    3         1-2      240             Forward pass only (H100+)
""")

    print("  Precision test (representing pi):")
    pi = math.pi
    f16_pi = simulate_float16(pi)
    bf16_pi = simulate_bfloat16(pi)
    print(f"  float64:  {pi}")
    print(f"  float16:  {f16_pi}  (error: {abs(f16_pi - pi):.6f})")
    print(f"  bfloat16: {bf16_pi}  (error: {abs(bf16_pi - pi):.6f})")

    print("\n  Range test (large values):")
    for val in [100.0, 1000.0, 10000.0, 65504.0, 100000.0]:
        f16 = simulate_float16(val)
        bf16 = simulate_bfloat16(val)
        f16_ok = "ok" if not math.isinf(f16) else "INF"
        bf16_ok = "ok" if not math.isinf(bf16) else "INF"
        print(f"  {val:>10.0f}  float16={f16_ok:>4s}  bfloat16={bf16_ok:>4s}")
    print()


if __name__ == "__main__":
    demo_float_precision()
    demo_catastrophic_cancellation()
    demo_overflow_underflow()
    demo_softmax_stability()
    demo_logsumexp()
    demo_cross_entropy()
    demo_sigmoid_stability()
    demo_gradient_checking()
    demo_nan_inf()
    demo_gradient_clipping()
    demo_mixed_precision()
    demo_layer_norm()
    demo_common_bugs()
    demo_format_comparison()
    print("All demos complete.")
