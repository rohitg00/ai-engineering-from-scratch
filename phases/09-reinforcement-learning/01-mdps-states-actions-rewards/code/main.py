import random


GRID = 4
TERMINAL = (3, 3)
ACTIONS = {"up": (-1, 0), "down": (1, 0), "left": (0, -1), "right": (0, 1)}


def all_states():
    return [(r, c) for r in range(GRID) for c in range(GRID)]


def step(state, action):
    if state == TERMINAL:
        return state, 0.0, True
    dr, dc = ACTIONS[action]
    r, c = state
    nr = min(max(r + dr, 0), GRID - 1)
    nc = min(max(c + dc, 0), GRID - 1)
    return (nr, nc), -1.0, (nr, nc) == TERMINAL


def uniform_policy(_state):
    return {a: 1.0 / len(ACTIONS) for a in ACTIONS}


def greedy_policy(_state):
    return {"down": 0.5, "right": 0.5, "up": 0.0, "left": 0.0}


def sample_action(dist, rng):
    x = rng.random()
    total = 0.0
    for a, p in dist.items():
        total += p
        if x <= total:
            return a
    return next(iter(dist))


def rollout(policy, rng, max_steps=200):
    state = (0, 0)
    total = 0.0
    steps = 0
    for _ in range(max_steps):
        action = sample_action(policy(state), rng)
        state, reward, done = step(state, action)
        total += reward
        steps += 1
        if done:
            break
    return total, steps


def policy_evaluation(policy, gamma=0.99, tol=1e-6, max_iter=2000):
    values = {s: 0.0 for s in all_states()}
    for _ in range(max_iter):
        delta = 0.0
        new_values = dict(values)
        for state in all_states():
            if state == TERMINAL:
                continue
            v = 0.0
            for action, pi_a in policy(state).items():
                s_next, reward, _ = step(state, action)
                v += pi_a * (reward + gamma * values[s_next])
            delta = max(delta, abs(v - values[state]))
            new_values[state] = v
        values = new_values
        if delta < tol:
            break
    return values


def print_value_grid(values, title):
    print(f"  {title}")
    for r in range(GRID):
        row = []
        for c in range(GRID):
            row.append(f"{values[(r, c)]:7.2f}")
        print("   " + " ".join(row))


def main():
    rng = random.Random(42)

    returns_random = [rollout(uniform_policy, rng)[0] for _ in range(5000)]
    mean_random = sum(returns_random) / len(returns_random)

    rng2 = random.Random(42)
    returns_greedy = [rollout(greedy_policy, rng2)[0] for _ in range(5000)]
    mean_greedy = sum(returns_greedy) / len(returns_greedy)

    print("=== 4x4 GridWorld, 5000 rollouts ===")
    print(f"random policy:  mean return = {mean_random:.2f}   (optimal = -6.00)")
    print(f"greedy  policy: mean return = {mean_greedy:.2f}")

    print()
    print("=== Policy evaluation V^pi(s) for uniform-random policy ===")
    for gamma in (0.5, 0.9, 0.99):
        values = policy_evaluation(uniform_policy, gamma=gamma)
        print_value_grid(values, f"gamma = {gamma}")
        print()

    print("=== Policy evaluation V^pi(s) for greedy down+right policy (gamma=0.99) ===")
    values = policy_evaluation(greedy_policy, gamma=0.99)
    print_value_grid(values, "greedy policy")
    print()
    print("note: greedy values at (0,0) track the true optimal return far closer than random.")


if __name__ == "__main__":
    main()
