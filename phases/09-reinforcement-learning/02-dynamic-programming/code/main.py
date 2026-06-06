GRID = 4
TERMINAL = (3, 3)
ACTIONS = ("up", "down", "left", "right")
DELTAS = {"up": (-1, 0), "down": (1, 0), "left": (0, -1), "right": (0, 1)}
SLIP = 0.1


def states():
    return [(r, c) for r in range(GRID) for c in range(GRID)]


def apply_move(state, direction):
    dr, dc = DELTAS[direction]
    r, c = state
    nr = min(max(r + dr, 0), GRID - 1)
    nc = min(max(c + dc, 0), GRID - 1)
    return (nr, nc)


def perpendiculars(action):
    if action in ("up", "down"):
        return ("left", "right")
    return ("up", "down")


def transitions(state, action):
    if state == TERMINAL:
        return [(state, 0.0, 1.0)]
    outcomes = []
    p_intended = 1.0 - SLIP
    outcomes.append((apply_move(state, action), -1.0, p_intended))
    for perp in perpendiculars(action):
        outcomes.append((apply_move(state, perp), -1.0, SLIP / 2.0))
    return outcomes


def q_value(state, action, V, gamma):
    return sum(p * (r + gamma * V[s_next]) for s_next, r, p in transitions(state, action))


def policy_evaluation(policy, gamma=0.99, tol=1e-6, max_iter=5000):
    V = {s: 0.0 for s in states()}
    for _ in range(max_iter):
        delta = 0.0
        for state in states():
            if state == TERMINAL:
                continue
            dist = policy(state)
            v = sum(pi_a * q_value(state, action, V, gamma) for action, pi_a in dist.items())
            delta = max(delta, abs(v - V[state]))
            V[state] = v
        if delta < tol:
            return V
    return V


def greedy_from_V(V, gamma=0.99):
    policy = {}
    for state in states():
        if state == TERMINAL:
            policy[state] = "up"
            continue
        best = max(ACTIONS, key=lambda a: q_value(state, a, V, gamma))
        policy[state] = best
    return policy


def policy_iteration(gamma=0.99, tol=1e-6):
    policy = {s: "up" for s in states()}
    sweeps = 0
    for it in range(100):
        V = policy_evaluation(lambda s: {policy[s]: 1.0}, gamma=gamma, tol=tol)
        sweeps += 1
        new_policy = greedy_from_V(V, gamma)
        if new_policy == policy:
            return V, policy, it + 1
        policy = new_policy
    return V, policy, 100


def value_iteration(gamma=0.99, tol=1e-6, max_iter=5000):
    V = {s: 0.0 for s in states()}
    for it in range(max_iter):
        delta = 0.0
        for state in states():
            if state == TERMINAL:
                continue
            v = max(q_value(state, action, V, gamma) for action in ACTIONS)
            delta = max(delta, abs(v - V[state]))
            V[state] = v
        if delta < tol:
            return V, greedy_from_V(V, gamma), it + 1
    return V, greedy_from_V(V, gamma), max_iter


def print_V(V, title):
    print(f"  {title}")
    for r in range(GRID):
        row = " ".join(f"{V[(r, c)]:7.2f}" for c in range(GRID))
        print("   " + row)


def print_policy(policy, title):
    arrows = {"up": "^", "down": "v", "left": "<", "right": ">"}
    print(f"  {title}")
    for r in range(GRID):
        row = " ".join(arrows[policy[(r, c)]] if (r, c) != TERMINAL else "." for c in range(GRID))
        print("   " + row)


def main():
    print("=== 4x4 stochastic GridWorld (slip=0.1), value iteration ===")
    V_vi, pi_vi, n_vi = value_iteration(gamma=0.99)
    print_V(V_vi, f"V* (converged in {n_vi} sweeps)")
    print()
    print_policy(pi_vi, "optimal policy")

    print()
    print("=== Same MDP, policy iteration ===")
    V_pi, pi_pi, n_pi = policy_iteration(gamma=0.99)
    print_V(V_pi, f"V* (converged in {n_pi} outer iters)")
    print()
    print_policy(pi_pi, "optimal policy")

    print()
    V_match = max(abs(V_vi[s] - V_pi[s]) for s in states())
    print(f"sup-norm |V_vi - V_pi| = {V_match:.2e}  (should be ~0)")
    print(f"policies identical?     {pi_vi == pi_pi}")


if __name__ == "__main__":
    main()
