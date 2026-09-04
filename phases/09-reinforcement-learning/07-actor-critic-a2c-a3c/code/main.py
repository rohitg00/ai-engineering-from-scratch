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


def rollout(theta, w, rng, max_steps=100):
    traj = []
    s = reset()
    for _ in range(max_steps):
        x = features(s)
        probs = softmax(logits(theta, x))
        a = sample(probs, rng)
        s_next, r, done = step(s, a)
        traj.append({"x": x, "a": a, "r": r, "probs": probs, "v": value(w, x), "done": done})
        if done:
            break
        s = s_next
    return traj


def gae_advantages(traj, gamma=0.99, lam=0.95):
    T = len(traj)
    advantages = [0.0] * T
    gae = 0.0
    for t in reversed(range(T)):
        next_v = 0.0 if traj[t]["done"] else (traj[t + 1]["v"] if t + 1 < T else 0.0)
        delta = traj[t]["r"] + gamma * next_v - traj[t]["v"]
        gae = delta + gamma * lam * gae
        advantages[t] = gae
    returns = [a + traj[t]["v"] for t, a in enumerate(advantages)]
    return advantages, returns


def normalize(xs):
    if len(xs) < 2:
        return xs
    m = sum(xs) / len(xs)
    var = sum((x - m) ** 2 for x in xs) / len(xs)
    sd = math.sqrt(var) + 1e-8
    return [(x - m) / sd for x in xs]


def actor_critic(episodes, lr_a=0.05, lr_v=0.1, gamma=0.99, lam=0.95, ent_coef=0.01, rng=None):
    rng = rng or random.Random(0)
    theta = init_theta(rng)
    w = init_w(rng)
    returns_log = []

    for ep in range(episodes):
        traj = rollout(theta, w, rng)
        advs, returns = gae_advantages(traj, gamma=gamma, lam=lam)
        advs_norm = normalize(advs)

        for t, node in enumerate(traj):
            target = returns[t]
            err = target - value(w, node["x"])
            for j in range(N_FEAT):
                w[j] += lr_v * err * node["x"][j]

            adv = advs_norm[t]
            probs = node["probs"]
            for i in range(N_ACTIONS):
                grad_logpi = (1.0 if i == node["a"] else 0.0) - probs[i]
                entropy_grad = -math.log(max(probs[i], 1e-12)) - 1.0
                for j in range(N_FEAT):
                    theta[i][j] += lr_a * (adv * grad_logpi + ent_coef * entropy_grad * probs[i]) * node["x"][j]

        if traj:
            mc_return = 0.0
            for r in reversed([n["r"] for n in traj]):
                mc_return = r + gamma * mc_return
            returns_log.append(mc_return)

    return theta, w, returns_log


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


def block_mean(xs, block):
    return [sum(xs[i : i + block]) / block for i in range(0, len(xs) - block + 1, block)]


def main():
    episodes = 1500
    rng = random.Random(7)
    theta, w, log = actor_critic(episodes, lam=0.95, rng=rng)

    print(f"=== A2C-style actor-critic with GAE(lam=0.95) on 4x4 GridWorld ===")
    print()
    print(f"learning curve (mean return per 150 episodes):")
    for i, m in enumerate(block_mean(log, 150)):
        print(f"  block {i+1}: mean return = {m:6.2f}")

    print()
    print_policy(greedy_policy(theta), "greedy policy from actor")
    print()
    print("critic values V_phi(s):")
    for r in range(GRID):
        row = " ".join(f"{value(w, features((r, c))):7.2f}" for c in range(GRID))
        print("   " + row)

    print()
    print(f"final mean return (last 150 eps) = {sum(log[-150:]) / 150:.2f}  (optimal = -6.0)")


if __name__ == "__main__":
    main()
