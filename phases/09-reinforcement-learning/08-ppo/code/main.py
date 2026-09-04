import math
import random


GRID = 4
TERMINAL = (3, 3)
ACTIONS = ("up", "down", "left", "right")
DELTAS = {"up": (-1, 0), "down": (1, 0), "left": (0, -1), "right": (0, 1)}
N_ACTIONS = len(ACTIONS)
N_FEAT = GRID * GRID


def reset():
    return (0, 0)


def step(state, action_idx):
    if state == TERMINAL:
        return state, 0.0, True
    dr, dc = DELTAS[ACTIONS[action_idx]]
    r, c = state
    nr = min(max(r + dr, 0), GRID - 1)
    nc = min(max(c + dc, 0), GRID - 1)
    return (nr, nc), -1.0, (nr, nc) == TERMINAL


def features(state):
    x = [0.0] * N_FEAT
    r, c = state
    x[r * GRID + c] = 1.0
    return x


def softmax(z):
    m = max(z)
    exps = [math.exp(zi - m) for zi in z]
    Z = sum(exps)
    return [e / Z for e in exps]


def logits(theta, x):
    return [sum(w * xi for w, xi in zip(theta[a], x)) for a in range(N_ACTIONS)]


def value(w, x):
    return sum(wj * xj for wj, xj in zip(w, x))


def sample(probs, rng):
    x = rng.random()
    cum = 0.0
    for a, p in enumerate(probs):
        cum += p
        if x <= cum:
            return a
    return N_ACTIONS - 1


def init_theta(rng):
    return [[rng.gauss(0, 0.1) for _ in range(N_FEAT)] for _ in range(N_ACTIONS)]


def init_w(_rng):
    return [0.0] * N_FEAT


def collect_rollout(theta, w, rng, horizon=50, n_envs=8):
    buffer = []
    for _ in range(n_envs):
        s = reset()
        for _ in range(horizon):
            x = features(s)
            probs = softmax(logits(theta, x))
            a = sample(probs, rng)
            s_next, r, done = step(s, a)
            buffer.append({
                "x": x,
                "a": a,
                "r": r,
                "done": done,
                "v_old": value(w, x),
                "log_pi_old": math.log(max(probs[a], 1e-12)),
            })
            if done:
                break
            s = s_next
    return buffer


def gae(buffer, gamma=0.99, lam=0.95):
    T = len(buffer)
    advantages = [0.0] * T
    gae_val = 0.0
    for t in reversed(range(T)):
        next_v = 0.0 if buffer[t]["done"] else (buffer[t + 1]["v_old"] if t + 1 < T else 0.0)
        delta = buffer[t]["r"] + gamma * next_v - buffer[t]["v_old"]
        gae_val = delta + gamma * lam * gae_val
        advantages[t] = gae_val
    returns = [a + buffer[t]["v_old"] for t, a in enumerate(advantages)]
    return advantages, returns


def normalize(xs):
    if len(xs) < 2:
        return xs
    m = sum(xs) / len(xs)
    var = sum((x - m) ** 2 for x in xs) / len(xs)
    sd = math.sqrt(var) + 1e-8
    return [(x - m) / sd for x in xs]


def ppo_update(theta, w, buffer, advantages, returns, lr_a=0.05, lr_v=0.1, eps=0.2, epochs=4, batch=32, rng=None):
    rng = rng or random.Random(0)
    for rec, adv, ret in zip(buffer, advantages, returns):
        rec["adv"] = adv
        rec["ret"] = ret

    kl_total = 0.0
    kl_count = 0
    clip_hits = 0
    total = 0

    for _ in range(epochs):
        shuffled = buffer[:]
        rng.shuffle(shuffled)
        for i in range(0, len(shuffled), batch):
            mb = shuffled[i : i + batch]
            adv_norm = normalize([rec["adv"] for rec in mb])

            for rec, adv in zip(mb, adv_norm):
                x = rec["x"]
                probs = softmax(logits(theta, x))
                logp = math.log(max(probs[rec["a"]], 1e-12))
                ratio = math.exp(logp - rec["log_pi_old"])

                clipped = (adv > 0 and ratio > 1 + eps) or (adv < 0 and ratio < 1 - eps)
                if clipped:
                    clip_hits += 1
                total += 1
                kl_total += rec["log_pi_old"] - logp
                kl_count += 1

                if not clipped:
                    pg_scale = ratio * adv
                else:
                    pg_scale = 0.0

                for action in range(N_ACTIONS):
                    grad_logpi = (1.0 if action == rec["a"] else 0.0) - probs[action]
                    for j in range(N_FEAT):
                        theta[action][j] += lr_a * pg_scale * grad_logpi * x[j]

                err = rec["ret"] - value(w, x)
                for j in range(N_FEAT):
                    w[j] += lr_v * err * x[j]

    mean_kl = kl_total / max(1, kl_count)
    clip_frac = clip_hits / max(1, total)
    return mean_kl, clip_frac


def greedy_policy(theta):
    policy = {}
    for r in range(GRID):
        for c in range(GRID):
            if (r, c) == TERMINAL:
                continue
            z = logits(theta, features((r, c)))
            policy[(r, c)] = ACTIONS[max(range(N_ACTIONS), key=lambda i: z[i])]
    return policy


def print_policy(policy, title):
    arrows = {"up": "^", "down": "v", "left": "<", "right": ">"}
    print(f"  {title}")
    for r in range(GRID):
        row = []
        for c in range(GRID):
            if (r, c) == TERMINAL:
                row.append(".")
            elif (r, c) in policy:
                row.append(arrows[policy[(r, c)]])
            else:
                row.append("?")
        print("   " + " ".join(row))


def evaluate(theta, rng, episodes=50):
    total = 0.0
    for _ in range(episodes):
        s = reset()
        ep_total = 0.0
        for _ in range(50):
            probs = softmax(logits(theta, features(s)))
            a = sample(probs, rng)
            s, r, done = step(s, a)
            ep_total += r
            if done:
                break
        total += ep_total
    return total / episodes


def main():
    rng = random.Random(123)
    theta = init_theta(rng)
    w = init_w(rng)

    updates = 60
    print(f"=== PPO on 4x4 GridWorld ({updates} updates, 8 envs x 50 steps, eps=0.2, K=4) ===")
    print()

    for it in range(updates):
        buffer = collect_rollout(theta, w, rng)
        advantages, returns = gae(buffer)
        mean_kl, clip_frac = ppo_update(theta, w, buffer, advantages, returns, rng=rng)
        if (it + 1) % 10 == 0:
            mean_ret = evaluate(theta, random.Random(it))
            print(f"  update {it+1:3d}  mean_return={mean_ret:6.2f}  mean_KL={mean_kl:+.4f}  clip_frac={clip_frac:.3f}")

    print()
    print_policy(greedy_policy(theta), "greedy policy")
    final = evaluate(theta, random.Random(999), episodes=200)
    print()
    print(f"final evaluated return (200 episodes) = {final:.2f}  (optimal = -6.0)")


if __name__ == "__main__":
    main()
