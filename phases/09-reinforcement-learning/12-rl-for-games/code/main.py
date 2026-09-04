import math
import random


QUESTIONS = (
    {"prompt": "what is 1+2",      "correct": 2, "n_answers": 4},
    {"prompt": "what is 3*3",      "correct": 0, "n_answers": 4},
    {"prompt": "capital of France", "correct": 3, "n_answers": 4},
)
N_PROMPTS = len(QUESTIONS)
N_ANSWERS = 4


def softmax(z):
    m = max(z)
    exps = [math.exp(zi - m) for zi in z]
    Z = sum(exps)
    return [e / Z for e in exps]


def policy_probs(theta, p_idx):
    return softmax(theta[p_idx])


def sample(probs, rng):
    x = rng.random()
    cum = 0.0
    for i, p in enumerate(probs):
        cum += p
        if x <= cum:
            return i
    return len(probs) - 1


def verify(p_idx, answer):
    return 1.0 if answer == QUESTIONS[p_idx]["correct"] else 0.0


def grpo_step(theta, reference, rng, G=8, beta=0.01, lr=0.1):
    p_idx = rng.randrange(N_PROMPTS)
    probs = policy_probs(theta, p_idx)
    samples = [sample(probs, rng) for _ in range(G)]
    rewards = [verify(p_idx, s) for s in samples]
    mean_r = sum(rewards) / G
    var_r = sum((r - mean_r) ** 2 for r in rewards) / G
    std_r = math.sqrt(var_r) + 1e-8
    advs = [(r - mean_r) / std_r for r in rewards]

    probs_ref = policy_probs(reference, p_idx)
    kl = sum(p * (math.log(max(p, 1e-12)) - math.log(max(q, 1e-12))) for p, q in zip(probs, probs_ref))

    for a, A in zip(samples, advs):
        for i in range(N_ANSWERS):
            grad_logpi = (1.0 if i == a else 0.0) - probs[i]
            theta[p_idx][i] += (lr / G) * A * grad_logpi

    for i in range(N_ANSWERS):
        theta[p_idx][i] -= beta * (probs[i] - probs_ref[i])

    return mean_r, kl


def reinforce_step(theta, rng, lr=0.1):
    p_idx = rng.randrange(N_PROMPTS)
    probs = policy_probs(theta, p_idx)
    a = sample(probs, rng)
    r = verify(p_idx, a)
    for i in range(N_ANSWERS):
        grad_logpi = (1.0 if i == a else 0.0) - probs[i]
        theta[p_idx][i] += lr * r * grad_logpi
    return r


def train_grpo(updates=500, rng=None):
    rng = rng or random.Random(0)
    theta = [[0.0] * N_ANSWERS for _ in range(N_PROMPTS)]
    reference = [row[:] for row in theta]
    history = []
    for t in range(updates):
        mean_r, kl = grpo_step(theta, reference, rng)
        history.append((mean_r, kl))
    return theta, history


def train_reinforce(updates=500, rng=None):
    rng = rng or random.Random(0)
    theta = [[0.0] * N_ANSWERS for _ in range(N_PROMPTS)]
    history = []
    for t in range(updates):
        r = reinforce_step(theta, rng)
        history.append(r)
    return theta, history


def evaluate(theta, episodes=200, rng=None):
    rng = rng or random.Random(42)
    total = 0.0
    for _ in range(episodes):
        p_idx = rng.randrange(N_PROMPTS)
        probs = policy_probs(theta, p_idx)
        a = max(range(N_ANSWERS), key=lambda i: probs[i])
        total += verify(p_idx, a)
    return total / episodes


def main():
    print("=== GRPO in miniature: tiny verifier bandit ===")
    print(f"prompts: {[q['prompt'] for q in QUESTIONS]}")
    print(f"correct answers: {[q['correct'] for q in QUESTIONS]}")
    print()

    theta_grpo, hist_grpo = train_grpo(updates=400, rng=random.Random(3))
    theta_rf, hist_rf = train_reinforce(updates=400, rng=random.Random(3))

    def block_mean(xs, block):
        return [sum(xs[i : i + block]) / block for i in range(0, len(xs) - block + 1, block)]

    rf_curve = block_mean(hist_rf, 50)
    grpo_rewards = [m for m, _kl in hist_grpo]
    grpo_curve = block_mean(grpo_rewards, 50)
    kl_curve = block_mean([kl for _m, kl in hist_grpo], 50)

    print(f"{'block':<8}{'GRPO mean_r':<16}{'GRPO mean_KL':<18}{'REINFORCE mean_r':<18}")
    for i, (g, k, rf) in enumerate(zip(grpo_curve, kl_curve, rf_curve)):
        print(f"{i+1:<8}{g:<16.3f}{k:<18.4f}{rf:<18.3f}")

    print()
    grpo_acc = evaluate(theta_grpo)
    rf_acc = evaluate(theta_rf)
    print(f"greedy evaluation accuracy:")
    print(f"  GRPO       = {grpo_acc*100:.1f}%")
    print(f"  REINFORCE  = {rf_acc*100:.1f}%")

    print()
    print("GRPO uses the group-mean as baseline and group-std for normalization —")
    print("no critic, no reward model. This is the DeepSeek-R1 recipe in one page.")


if __name__ == "__main__":
    main()
