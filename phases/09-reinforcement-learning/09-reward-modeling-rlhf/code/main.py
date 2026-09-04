import math
import random
from collections import Counter, defaultdict


PROMPTS = ("help me", "answer me", "explain this")
GOOD = ("clear", "specific", "kind", "thorough", "precise", "helpful")
BAD = ("vague", "rude", "wrong", "short", "cold", "careless")
VOCAB = tuple(sorted(set(GOOD + BAD)))


def bag(tokens):
    return Counter(tokens)


def sigmoid(x):
    if x > 0:
        return 1.0 / (1.0 + math.exp(-x))
    ex = math.exp(x)
    return ex / (1.0 + ex)


def score(w, tokens):
    return sum(w.get(t, 0.0) * c for t, c in bag(tokens).items())


def sample_pair(rng):
    x = rng.choice(PROMPTS)
    y_pos = (rng.choice(GOOD), rng.choice(GOOD))
    y_neg = (rng.choice(BAD), rng.choice(BAD))
    return x, y_pos, y_neg


def train_rm(n_pairs=500, lr=0.1, rng=None):
    rng = rng or random.Random(0)
    w = defaultdict(float)
    for _ in range(n_pairs):
        _, y_pos, y_neg = sample_pair(rng)
        r_pos = score(w, y_pos)
        r_neg = score(w, y_neg)
        p = sigmoid(r_pos - r_neg)
        grad_scale = 1 - p
        for t, c in bag(y_pos).items():
            w[t] += lr * grad_scale * c
        for t, c in bag(y_neg).items():
            w[t] -= lr * grad_scale * c
    return w


def rm_accuracy(w, n_pairs=200, rng=None):
    rng = rng or random.Random(1)
    correct = 0
    for _ in range(n_pairs):
        _, y_pos, y_neg = sample_pair(rng)
        if score(w, y_pos) > score(w, y_neg):
            correct += 1
    return correct / n_pairs


def softmax(z):
    m = max(z)
    exps = [math.exp(zi - m) for zi in z]
    Z = sum(exps)
    return [e / Z for e in exps]


def policy_probs(theta, prompt_idx):
    return softmax(theta[prompt_idx])


def sample_token(probs, rng):
    x = rng.random()
    cum = 0.0
    for i, p in enumerate(probs):
        cum += p
        if x <= cum:
            return i
    return len(probs) - 1


def kl(p, q):
    total = 0.0
    for pi, qi in zip(p, q):
        if pi <= 0:
            continue
        total += pi * (math.log(pi) - math.log(max(qi, 1e-12)))
    return total


def rlhf_loop(w, updates=300, beta=0.1, lr=0.05, eps=0.2, rng=None):
    rng = rng or random.Random(7)
    theta = [[0.0 for _ in VOCAB] for _ in PROMPTS]
    reference = [row[:] for row in theta]

    history = []
    for it in range(updates):
        rollouts = []
        for _ in range(16):
            p_idx = rng.randrange(len(PROMPTS))
            probs_new = policy_probs(theta, p_idx)
            token = sample_token(probs_new, rng)
            probs_ref = policy_probs(reference, p_idx)
            rm_score = w.get(VOCAB[token], 0.0)
            kl_term = kl(probs_new, probs_ref)
            reward = rm_score - beta * kl_term
            log_pi_old = math.log(max(probs_new[token], 1e-12))
            rollouts.append((p_idx, token, probs_new, reward, log_pi_old, kl_term))

        rewards = [rec[3] for rec in rollouts]
        mean_r = sum(rewards) / len(rewards)
        var_r = sum((r - mean_r) ** 2 for r in rewards) / len(rewards)
        sd_r = math.sqrt(var_r) + 1e-8
        advs = [(r - mean_r) / sd_r for r in rewards]

        for (p_idx, token, probs_new_at_rollout, _r, log_pi_old, _kl), adv in zip(rollouts, advs):
            probs = policy_probs(theta, p_idx)
            logp = math.log(max(probs[token], 1e-12))
            ratio = math.exp(logp - log_pi_old)
            clipped = (adv > 0 and ratio > 1 + eps) or (adv < 0 and ratio < 1 - eps)
            if clipped:
                continue
            for i in range(len(VOCAB)):
                grad = (1.0 if i == token else 0.0) - probs[i]
                theta[p_idx][i] += lr * ratio * adv * grad

        mean_kl = sum(rec[5] for rec in rollouts) / len(rollouts)
        mean_rm = sum(rec[3] + beta * rec[5] for rec in rollouts) / len(rollouts)
        history.append((it + 1, mean_rm, mean_kl))
    return theta, history


def main():
    rng = random.Random(42)
    w = train_rm(n_pairs=600, rng=rng)

    print("=== Stage 1: reward model (Bradley-Terry pairwise logistic) ===")
    print()
    print("top positive-weight tokens:")
    for tok in sorted(w, key=lambda t: -w[t])[:6]:
        print(f"  {tok:<10} w = {w[tok]:+.3f}")
    print()
    print("top negative-weight tokens:")
    for tok in sorted(w, key=lambda t: w[t])[:6]:
        print(f"  {tok:<10} w = {w[tok]:+.3f}")
    print()
    print(f"RM pairwise accuracy on holdout (200 pairs) = {rm_accuracy(w):.3f}")
    print()

    print("=== Stage 2: PPO-RLHF against RM with KL penalty ===")
    print()
    for beta in (0.01, 0.1, 1.0):
        _, hist = rlhf_loop(w, updates=150, beta=beta, rng=random.Random(0))
        first = hist[0]
        last = hist[-1]
        print(f"beta={beta:<5}  initial: RM={first[1]:+.3f} KL={first[2]:.3f}   final: RM={last[1]:+.3f} KL={last[2]:.3f}")


if __name__ == "__main__":
    main()
