import random
from collections import defaultdict


GRID = 4
TERMINAL = (3, 3)
ACTIONS = ("up", "down", "left", "right")
DELTAS = {"up": (-1, 0), "down": (1, 0), "left": (0, -1), "right": (0, 1)}


def reset():
    return (0, 0)


def step(state, action):
    if state == TERMINAL:
        return state, 0.0, True
    dr, dc = DELTAS[action]
    r, c = state
    nr = min(max(r + dr, 0), GRID - 1)
    nc = min(max(c + dc, 0), GRID - 1)
    return (nr, nc), -1.0, (nr, nc) == TERMINAL


def epsilon_greedy(Q, state, rng, epsilon):
    if rng.random() < epsilon:
        return rng.choice(ACTIONS)
    q = Q[state]
    return max(ACTIONS, key=lambda a: q[a])


def sarsa(episodes, alpha=0.1, gamma=0.99, epsilon=0.1, rng=None):
    rng = rng or random.Random(0)
    Q = defaultdict(lambda: {a: 0.0 for a in ACTIONS})
    returns = []
    for _ in range(episodes):
        s = reset()
        a = epsilon_greedy(Q, s, rng, epsilon)
        total = 0.0
        for _ in range(200):
            s_next, r, done = step(s, a)
            total += r
            if done:
                Q[s][a] += alpha * (r - Q[s][a])
                break
            a_next = epsilon_greedy(Q, s_next, rng, epsilon)
            target = r + gamma * Q[s_next][a_next]
            Q[s][a] += alpha * (target - Q[s][a])
            s, a = s_next, a_next
        returns.append(total)
    return Q, returns


def q_learning(episodes, alpha=0.1, gamma=0.99, epsilon=0.1, rng=None):
    rng = rng or random.Random(0)
    Q = defaultdict(lambda: {a: 0.0 for a in ACTIONS})
    returns = []
    for _ in range(episodes):
        s = reset()
        total = 0.0
        for _ in range(200):
            a = epsilon_greedy(Q, s, rng, epsilon)
            s_next, r, done = step(s, a)
            total += r
            if done:
                Q[s][a] += alpha * (r - Q[s][a])
                break
            best_next = max(Q[s_next].values())
            target = r + gamma * best_next
            Q[s][a] += alpha * (target - Q[s][a])
            s = s_next
        returns.append(total)
    return Q, returns


def greedy_policy(Q):
    return {s: max(ACTIONS, key=lambda a: q[a]) for s, q in Q.items()}


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


def block_means(xs, block):
    return [sum(xs[i : i + block]) / block for i in range(0, len(xs) - block + 1, block)]


def main():
    episodes = 3000
    rng = random.Random(42)
    Q_sarsa, ret_sarsa = sarsa(episodes, rng=rng)
    rng = random.Random(42)
    Q_ql, ret_ql = q_learning(episodes, rng=rng)

    print(f"=== 4x4 GridWorld, {episodes} episodes, alpha=0.1, eps=0.1, gamma=0.99 ===")
    print()
    print("learning curves (mean return per block of 500 episodes):")
    for i, (a, b) in enumerate(zip(block_means(ret_sarsa, 500), block_means(ret_ql, 500))):
        print(f"  block {i+1}: sarsa={a:7.2f}   q-learning={b:7.2f}")

    print()
    print_policy(greedy_policy(Q_sarsa), "SARSA greedy policy")
    print()
    print_policy(greedy_policy(Q_ql), "Q-learning greedy policy")

    print()
    print(f"final mean return (last 500 eps):  sarsa={sum(ret_sarsa[-500:])/500:.2f}   q-learning={sum(ret_ql[-500:])/500:.2f}")
    print("(optimal return on this 4x4 GridWorld = -6.0)")


if __name__ == "__main__":
    main()
