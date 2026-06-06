import math
import random


def information_content(p, base=2):
    if p <= 0:
        return float('inf')
    if p >= 1:
        return 0.0
    return -math.log(p) / math.log(base)


def entropy(probs, base=2):
    return sum(
        p * information_content(p, base)
        for p in probs if p > 0
    )


def cross_entropy(p, q, base=2):
    total = 0.0
    for pi, qi in zip(p, q):
        if pi > 0:
            if qi <= 0:
                return float('inf')
            total += pi * (-math.log(qi) / math.log(base))
    return total


def kl_divergence(p, q, base=2):
    return cross_entropy(p, q, base) - entropy(p, base)


def mutual_information(joint_probs, base=2):
    rows = len(joint_probs)
    cols = len(joint_probs[0])

    margin_x = [sum(joint_probs[i][j] for j in range(cols)) for i in range(rows)]
    margin_y = [sum(joint_probs[i][j] for i in range(rows)) for j in range(cols)]

    mi = 0.0
    for i in range(rows):
        for j in range(cols):
            pxy = joint_probs[i][j]
            if pxy > 0 and margin_x[i] > 0 and margin_y[j] > 0:
                mi += pxy * math.log(pxy / (margin_x[i] * margin_y[j])) / math.log(base)
    return mi


def softmax(logits):
    max_logit = max(logits)
    exps = [math.exp(z - max_logit) for z in logits]
    total = sum(exps)
    return [e / total for e in exps]


def cross_entropy_loss(true_class, logits):
    probs = softmax(logits)
    return -math.log(probs[true_class])


def negative_log_likelihood(labels, all_logits):
    return sum(
        cross_entropy_loss(label, logits)
        for label, logits in zip(labels, all_logits)
    ) / len(labels)


def perplexity(avg_cross_entropy, base="e"):
    if base == "e":
        return math.exp(avg_cross_entropy)
    return 2 ** avg_cross_entropy


def conditional_entropy(joint_probs, base=2):
    rows = len(joint_probs)
    cols = len(joint_probs[0])

    margin_x = [sum(joint_probs[i][j] for j in range(cols)) for i in range(rows)]

    h_yx = 0.0
    for i in range(rows):
        for j in range(cols):
            pxy = joint_probs[i][j]
            if pxy > 0 and margin_x[i] > 0:
                p_y_given_x = pxy / margin_x[i]
                h_yx -= pxy * math.log(p_y_given_x) / math.log(base)
    return h_yx


def joint_entropy(joint_probs, base=2):
    total = 0.0
    for row in joint_probs:
        for pxy in row:
            if pxy > 0:
                total -= pxy * math.log(pxy) / math.log(base)
    return total


def label_smoothing_demo():
    print()
    print("=" * 60)
    print("LABEL SMOOTHING AND CROSS-ENTROPY")
    print("=" * 60)

    num_classes = 4
    true_class = 2
    logits = [1.0, 0.5, 3.0, 0.2]
    probs = softmax(logits)

    hard_target = [0.0] * num_classes
    hard_target[true_class] = 1.0

    epsilons = [0.0, 0.05, 0.1, 0.2]
    print(f"\n  Logits:  {logits}")
    print(f"  Softmax: [{', '.join(f'{p:.4f}' for p in probs)}]")
    print(f"  True class: {true_class}")
    print()

    for eps in epsilons:
        soft_target = [eps / num_classes] * num_classes
        soft_target[true_class] = (1 - eps) + eps / num_classes

        ce = cross_entropy(soft_target, probs, base=math.e)
        target_entropy = entropy(soft_target, base=math.e)
        label = "hard" if eps == 0.0 else f"eps={eps}"
        print(f"  {label:>8s}  target={[f'{t:.3f}' for t in soft_target]}  "
              f"H(target)={target_entropy:.4f}  CE={ce:.4f}")

    print()
    print("  Higher epsilon -> higher target entropy -> acts as regularization")


def feature_selection_mi_demo():
    print()
    print("=" * 60)
    print("FEATURE SELECTION VIA MUTUAL INFORMATION")
    print("=" * 60)

    random.seed(42)
    n = 200

    target = [random.choice([0, 1]) for _ in range(n)]

    features = {}
    features["strong_signal"] = [t ^ (1 if random.random() < 0.1 else 0) for t in target]
    features["weak_signal"] = [t ^ (1 if random.random() < 0.35 else 0) for t in target]
    features["noise"] = [random.choice([0, 1]) for _ in range(n)]
    features["constant"] = [0] * n

    print(f"\n  Samples: {n}")
    print(f"  Target balance: {sum(target)}/{n - sum(target)}")
    print()

    mi_scores = []
    for name, feat in features.items():
        joint = [[0, 0], [0, 0]]
        for f, t in zip(feat, target):
            joint[f][t] += 1
        joint_p = [[c / n for c in row] for row in joint]
        mi = mutual_information(joint_p, base=2)
        mi_scores.append((name, mi))

    mi_scores.sort(key=lambda x: x[1], reverse=True)
    print("  Feature MI ranking:")
    for name, mi in mi_scores:
        bar = "#" * int(mi * 200)
        print(f"    {name:>16s}  MI = {mi:.4f} bits  {bar}")

    print()
    print("  Strong signal has highest MI. Noise and constant have ~0.")


if __name__ == "__main__":

    print("=" * 60)
    print("INFORMATION CONTENT (SURPRISE)")
    print("=" * 60)

    events = [
        ("Fair coin heads", 0.5),
        ("Rolling a 6", 1 / 6),
        ("1-in-1000 event", 0.001),
        ("Certain event", 1.0),
    ]
    for name, p in events:
        print(f"  {name:20s}  p={p:<8.4f}  surprise={information_content(p):.4f} bits")

    print()
    print("=" * 60)
    print("ENTROPY")
    print("=" * 60)

    distributions = {
        "Fair coin": [0.5, 0.5],
        "Biased coin (99/1)": [0.99, 0.01],
        "Fair die (6 sides)": [1 / 6] * 6,
        "Loaded die": [0.5, 0.1, 0.1, 0.1, 0.1, 0.1],
    }
    for name, probs in distributions.items():
        print(f"  {name:25s}  H = {entropy(probs):.4f} bits")

    print()
    print("=" * 60)
    print("CROSS-ENTROPY AND KL DIVERGENCE")
    print("=" * 60)

    true_dist = [0.7, 0.2, 0.1]
    good_model = [0.6, 0.25, 0.15]
    bad_model = [0.1, 0.1, 0.8]

    h_true = entropy(true_dist)
    ce_good = cross_entropy(true_dist, good_model)
    ce_bad = cross_entropy(true_dist, bad_model)
    kl_good = kl_divergence(true_dist, good_model)
    kl_bad = kl_divergence(true_dist, bad_model)

    print(f"  True distribution:    {true_dist}")
    print(f"  Good model:           {good_model}")
    print(f"  Bad model:            {bad_model}")
    print()
    print(f"  H(true):              {h_true:.4f} bits")
    print(f"  H(true, good):        {ce_good:.4f} bits")
    print(f"  H(true, bad):         {ce_bad:.4f} bits")
    print(f"  KL(true || good):     {kl_good:.4f} bits")
    print(f"  KL(true || bad):      {kl_bad:.4f} bits")
    print()
    print(f"  Verify: H(P,Q) = H(P) + KL(P||Q)")
    print(f"  Good: {h_true:.4f} + {kl_good:.4f} = {h_true + kl_good:.4f}  (CE = {ce_good:.4f})")
    print(f"  Bad:  {h_true:.4f} + {kl_bad:.4f} = {h_true + kl_bad:.4f}  (CE = {ce_bad:.4f})")

    print()
    print("=" * 60)
    print("KL DIVERGENCE IS NOT SYMMETRIC")
    print("=" * 60)

    p = [0.9, 0.1]
    q = [0.5, 0.5]
    print(f"  P = {p},  Q = {q}")
    print(f"  KL(P || Q) = {kl_divergence(p, q):.4f} bits")
    print(f"  KL(Q || P) = {kl_divergence(q, p):.4f} bits")
    print(f"  They differ because KL is not a true distance metric.")

    print()
    print("=" * 60)
    print("CROSS-ENTROPY LOSS FOR CLASSIFICATION")
    print("=" * 60)

    logits = [2.0, 1.0, 0.1]
    true_class = 0
    probs = softmax(logits)
    loss = cross_entropy_loss(true_class, logits)

    print(f"  Logits:       {logits}")
    print(f"  Softmax:      [{', '.join(f'{p:.4f}' for p in probs)}]")
    print(f"  True class:   {true_class}")
    print(f"  CE loss:      {loss:.4f} nats")
    print(f"  Perplexity:   {perplexity(loss):.2f}")

    print()
    print("  Trying different true classes with same logits:")
    for c in range(3):
        l = cross_entropy_loss(c, logits)
        print(f"    Class {c}: loss={l:.4f}  prob={probs[c]:.4f}")

    print()
    print("=" * 60)
    print("CROSS-ENTROPY = NEGATIVE LOG-LIKELIHOOD")
    print("=" * 60)

    random.seed(42)
    n_samples = 1000
    n_classes = 3
    labels = [random.randint(0, n_classes - 1) for _ in range(n_samples)]
    all_logits = [[random.gauss(0, 1) for _ in range(n_classes)] for _ in range(n_samples)]

    ce_avg = negative_log_likelihood(labels, all_logits)
    nll_avg = -sum(
        math.log(softmax(lg)[lb])
        for lb, lg in zip(labels, all_logits)
    ) / n_samples

    print(f"  Samples:               {n_samples}")
    print(f"  Cross-entropy loss:    {ce_avg:.6f} nats")
    print(f"  Neg log-likelihood:    {nll_avg:.6f} nats")
    print(f"  Difference:            {abs(ce_avg - nll_avg):.2e}")
    print(f"  They are identical. Minimizing CE = maximizing likelihood.")

    print()
    print("=" * 60)
    print("MUTUAL INFORMATION")
    print("=" * 60)

    independent = [[0.25, 0.25], [0.25, 0.25]]
    dependent = [[0.45, 0.05], [0.05, 0.45]]
    partial = [[0.3, 0.2], [0.1, 0.4]]

    print(f"  Independent:   MI = {mutual_information(independent):.4f} bits")
    print(f"  Dependent:     MI = {mutual_information(dependent):.4f} bits")
    print(f"  Partial:       MI = {mutual_information(partial):.4f} bits")

    print()
    print("=" * 60)
    print("BITS VS NATS")
    print("=" * 60)

    fair_coin = [0.5, 0.5]
    print(f"  Fair coin entropy:")
    print(f"    In bits (log2): {entropy(fair_coin, base=2):.4f}")
    print(f"    In nats (ln):   {entropy(fair_coin, base=math.e):.4f}")
    print(f"    1 bit = {1 / math.log2(math.e):.4f} nats")
    print(f"    1 nat = {math.log2(math.e):.4f} bits")

    print()
    print("=" * 60)
    print("PERPLEXITY IN LANGUAGE MODELS")
    print("=" * 60)

    random.seed(123)
    vocab_size = 50
    sequence_length = 100
    true_tokens = [random.randint(0, vocab_size - 1) for _ in range(sequence_length)]
    token_logits = [[random.gauss(0, 1) for _ in range(vocab_size)] for _ in range(sequence_length)]

    avg_ce = negative_log_likelihood(true_tokens, token_logits)
    ppl = perplexity(avg_ce)

    print(f"  Vocab size:        {vocab_size}")
    print(f"  Sequence length:   {sequence_length}")
    print(f"  Avg CE loss:       {avg_ce:.4f} nats")
    print(f"  Perplexity:        {ppl:.2f}")
    print(f"  Random baseline:   {vocab_size:.2f} (uniform over vocab)")
    print(f"  The model is better than random if perplexity < vocab size.")

    print()
    print("=" * 60)
    print("CONDITIONAL AND JOINT ENTROPY")
    print("=" * 60)

    joint_dep = [[0.45, 0.05], [0.05, 0.45]]
    joint_indep = [[0.25, 0.25], [0.25, 0.25]]

    print(f"\n  Dependent joint distribution: {joint_dep}")
    print(f"    Joint entropy H(X,Y):     {joint_entropy(joint_dep):.4f} bits")
    print(f"    Conditional H(Y|X):       {conditional_entropy(joint_dep):.4f} bits")
    print(f"    Mutual information I(X;Y):{mutual_information(joint_dep):.4f} bits")

    hx_dep = entropy([sum(row) for row in joint_dep])
    print(f"    H(X):                     {hx_dep:.4f} bits")
    print(f"    Verify: H(X,Y) = H(X) + H(Y|X) = {hx_dep:.4f} + {conditional_entropy(joint_dep):.4f} = {hx_dep + conditional_entropy(joint_dep):.4f}")

    print(f"\n  Independent joint distribution: {joint_indep}")
    print(f"    Joint entropy H(X,Y):     {joint_entropy(joint_indep):.4f} bits")
    print(f"    Conditional H(Y|X):       {conditional_entropy(joint_indep):.4f} bits")
    print(f"    Mutual information I(X;Y):{mutual_information(joint_indep):.4f} bits")
    print("    When independent: H(Y|X) = H(Y) and I(X;Y) = 0")

    label_smoothing_demo()
    feature_selection_mi_demo()
