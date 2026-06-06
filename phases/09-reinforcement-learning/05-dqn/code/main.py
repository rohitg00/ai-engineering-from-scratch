import math
import random


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


def state_features(state):
    feat = [0.0] * (GRID * GRID)
    r, c = state
    feat[r * GRID + c] = 1.0
    return feat


def init_net(n_in, n_hidden, n_out, rng):
    return {
        "W1": [[rng.gauss(0, 0.2) for _ in range(n_in)] for _ in range(n_hidden)],
        "b1": [0.0] * n_hidden,
        "W2": [[rng.gauss(0, 0.2) for _ in range(n_hidden)] for _ in range(n_out)],
        "b2": [0.0] * n_out,
    }


def forward(net, x):
    h = []
    for row, b in zip(net["W1"], net["b1"]):
        z = b + sum(w * xi for w, xi in zip(row, x))
        h.append(max(0.0, z))
    q = []
    for row, b in zip(net["W2"], net["b2"]):
        z = b + sum(w * hi for w, hi in zip(row, h))
        q.append(z)
    return q, h


def clone(net):
    return {
        "W1": [row[:] for row in net["W1"]],
        "b1": net["b1"][:],
        "W2": [row[:] for row in net["W2"]],
        "b2": net["b2"][:],
    }


def epsilon_greedy(net, state, rng, epsilon):
    if rng.random() < epsilon:
        return rng.randrange(len(ACTIONS))
    q, _ = forward(net, state_features(state))
    return max(range(len(ACTIONS)), key=lambda i: q[i])


def train_step(online, target, batch, gamma, lr):
    n_hidden = len(online["b1"])
    n_out = len(online["b2"])
    n_in = len(online["W1"][0])
    dW1 = [[0.0] * n_in for _ in range(n_hidden)]
    db1 = [0.0] * n_hidden
    dW2 = [[0.0] * n_hidden for _ in range(n_out)]
    db2 = [0.0] * n_out
    total_loss = 0.0

    for s, a, r, s_next, done in batch:
        x = state_features(s)
        q, h = forward(online, x)
        if done:
            y = r
        else:
            q_next, _ = forward(target, state_features(s_next))
            y = r + gamma * max(q_next)
        td_error = q[a] - y
        total_loss += 0.5 * td_error * td_error

        db2[a] += td_error
        for j in range(n_hidden):
            dW2[a][j] += td_error * h[j]

        grad_h = [0.0] * n_hidden
        for j in range(n_hidden):
            if h[j] > 0:
                grad_h[j] = td_error * online["W2"][a][j]

        for j in range(n_hidden):
            db1[j] += grad_h[j]
            for k in range(n_in):
                dW1[j][k] += grad_h[j] * x[k]

    scale = lr / len(batch)
    for j in range(n_hidden):
        online["b1"][j] -= scale * db1[j]
        for k in range(n_in):
            online["W1"][j][k] -= scale * dW1[j][k]
    for a in range(n_out):
        online["b2"][a] -= scale * db2[a]
        for j in range(n_hidden):
            online["W2"][a][j] -= scale * dW2[a][j]
    return total_loss / len(batch)


def main():
    rng = random.Random(0)
    n_in = GRID * GRID
    online = init_net(n_in, 32, len(ACTIONS), rng)
    target = clone(online)

    buffer = []
    capacity = 2000
    batch = 32
    gamma = 0.99
    lr = 0.05
    sync_every = 200
    episodes = 400
    step_count = 0

    returns_log = []
    for ep in range(episodes):
        s = reset()
        total = 0.0
        epsilon = max(0.05, 1.0 - ep / 200)
        for _ in range(50):
            a = epsilon_greedy(online, s, rng, epsilon)
            s_next, r, done = step(s, ACTIONS[a])
            total += r
            buffer.append((s, a, r, s_next, done))
            if len(buffer) > capacity:
                buffer.pop(0)
            if len(buffer) >= batch:
                mb = rng.sample(buffer, batch)
                train_step(online, target, mb, gamma, lr)
            step_count += 1
            if step_count % sync_every == 0:
                target = clone(online)
            if done:
                break
            s = s_next
        returns_log.append(total)

    print(f"=== DQN on 4x4 GridWorld ({episodes} episodes, batch={batch}, target sync every {sync_every} steps) ===")
    print()
    print("learning curve (mean return per block of 50 episodes):")
    for i in range(0, episodes, 50):
        chunk = returns_log[i : i + 50]
        print(f"  episodes {i:3d}-{i+49:3d}: mean = {sum(chunk) / len(chunk):6.2f}")

    print()
    q0, _ = forward(online, state_features((0, 0)))
    print("Q(0,0) per action:")
    for a, v in zip(ACTIONS, q0):
        print(f"  {a:<6} = {v:6.2f}")
    print()
    print("greedy policy from trained net:")
    arrows = {"up": "^", "down": "v", "left": "<", "right": ">"}
    for r in range(GRID):
        row = []
        for c in range(GRID):
            if (r, c) == TERMINAL:
                row.append(".")
                continue
            q, _ = forward(online, state_features((r, c)))
            best = ACTIONS[max(range(len(ACTIONS)), key=lambda i: q[i])]
            row.append(arrows[best])
        print("   " + " ".join(row))


if __name__ == "__main__":
    main()
