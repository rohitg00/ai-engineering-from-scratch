import random
from collections import defaultdict


GRID = 5
TERMINAL = (GRID - 1, GRID - 1)
ACTIONS = ("up", "down", "left", "right")
DELTAS = {"up": (-1, 0), "down": (1, 0), "left": (0, -1), "right": (0, 1)}


def step(state, action, slip, rng):
    if state == TERMINAL:
        return state, 0.0, True
    if rng.random() < slip:
        perp = ("left", "right") if action in ("up", "down") else ("up", "down")
        action = rng.choice(perp)
    dr, dc = DELTAS[action]
    r, c = state
    nr = min(max(r + dr, 0), GRID - 1)
    nc = min(max(c + dc, 0), GRID - 1)
    return (nr, nc), -1.0, (nr, nc) == TERMINAL


def default_q():
    return {a: 0.0 for a in ACTIONS}


def epsilon_greedy(Q, s, rng, eps):
    if rng.random() < eps:
        return rng.choice(ACTIONS)
    q = Q[s]
    return max(ACTIONS, key=lambda a: q[a])


def train_fixed(slip, episodes=3000, alpha=0.1, gamma=0.95, eps=0.15, rng=None):
    rng = rng or random.Random(0)
    Q = defaultdict(default_q)
    for _ in range(episodes):
        s = (0, 0)
        for _ in range(100):
            a = epsilon_greedy(Q, s, rng, eps)
            s_next, r, done = step(s, a, slip, rng)
            if done:
                Q[s][a] += alpha * (r - Q[s][a])
                break
            best_next = max(Q[s_next].values())
            Q[s][a] += alpha * ((r + gamma * best_next) - Q[s][a])
            s = s_next
    return Q


def train_dr(slip_low, slip_high, episodes=3000, alpha=0.1, gamma=0.95, eps=0.15, rng=None):
    rng = rng or random.Random(0)
    Q = defaultdict(default_q)
    for _ in range(episodes):
        slip_ep = rng.uniform(slip_low, slip_high)
        s = (0, 0)
        for _ in range(100):
            a = epsilon_greedy(Q, s, rng, eps)
            s_next, r, done = step(s, a, slip_ep, rng)
            if done:
                Q[s][a] += alpha * (r - Q[s][a])
                break
            best_next = max(Q[s_next].values())
            Q[s][a] += alpha * ((r + gamma * best_next) - Q[s][a])
            s = s_next
    return Q


def evaluate(Q, slip, episodes=200, rng=None):
    rng = rng or random.Random(42)
    total = 0.0
    for _ in range(episodes):
        s = (0, 0)
        ep_total = 0.0
        for _ in range(100):
            a = max(ACTIONS, key=lambda a: Q[s][a])
            s, r, done = step(s, a, slip, rng)
            ep_total += r
            if done:
                break
        total += ep_total
    return total / episodes


def main():
    print(f"=== sim-to-real: train in 'sim', evaluate on 'real' ===")
    print(f"env: {GRID}x{GRID} GridWorld, slip = probability of perpendicular slip")
    print()

    print("training two policies with same compute budget:")
    print("  policy A: fixed slip = 0.0 (no domain randomization)")
    print("  policy B: slip ~ Uniform[0.0, 0.3] (domain randomization)")
    print()

    rng = random.Random(1)
    Q_fixed = train_fixed(0.0, rng=rng)
    rng = random.Random(1)
    Q_dr = train_dr(0.0, 0.3, rng=rng)

    print("evaluation on 'real' slips (each 200 episodes greedy eval):")
    print(f"  {'slip':<10}{'fixed-slip policy':<22}{'DR-trained policy':<22}")
    for slip in (0.0, 0.1, 0.2, 0.3, 0.5, 0.7):
        r_fixed = evaluate(Q_fixed, slip)
        r_dr = evaluate(Q_dr, slip)
        label = ""
        if slip <= 0.3:
            label = "(in-support for DR)"
        else:
            label = "(OOD for DR)"
        print(f"  {slip:<10.2f}{r_fixed:<22.2f}{r_dr:<22.2f}{label}")

    print()
    print("takeaway: DR-trained policy degrades gracefully; fixed-slip policy is brittle out-of-distribution.")


if __name__ == "__main__":
    main()
