import numpy as np

from practice_check import check, close, equal, fixture, fixtures, true

Q3 = np.array([[0.0, 1.0], [2.0, -1.0], [0.5, 0.5]])
TIES = np.array([[1.0, 3.0, 3.0, 0.0]])


def manual_policy(q_row, epsilon, rng, n):
    actions = []
    for _ in range(n):
        if rng.random() < epsilon:
            actions.append(int(rng.integers(len(q_row))))
        else:
            actions.append(int(np.flatnonzero(q_row == np.max(q_row))[0]))
    return actions


@check("examples", "one Q-learning update", "The target is r + gamma * max over a' of Q[s', a']. Q[s, a] moves by alpha times the difference between the target and Q[s, a].")
def example_q(sub):
    close(sub.q_learning_update(Q3.copy(), 0, 1, -1.0, 1, False, alpha=0.5, gamma=0.9), [[0.0, 0.9], [2.0, -1.0], [0.5, 0.5]], what="the new Q table")


@check("examples", "one SARSA update", "SARSA uses the next action that the agent takes, so the target is r + gamma * Q[s', a'] with the given a'.")
def example_sarsa(sub):
    close(sub.sarsa_update(Q3.copy(), 0, 1, -1.0, 1, 1, False, alpha=0.5, gamma=0.9), [[0.0, -0.45], [2.0, -1.0], [0.5, 0.5]], what="the new Q table")


@check("examples", "a terminal transition does not bootstrap", "When done is True, the next state has no future. The target is the reward r only.")
def example_terminal(sub):
    close(sub.q_learning_update(Q3.copy(), 0, 1, -1.0, 1, True, alpha=0.5, gamma=0.9), [[0.0, 0.0], [2.0, -1.0], [0.5, 0.5]], what="the new Q table after a terminal step")


@check("examples", "epsilon-greedy with a fixed seed", "Draw u = rng.random(). When u < epsilon, return rng.integers(n_actions). Else return the greedy action, with the lowest index on a tie.")
def example_policy(sub):
    rng = np.random.default_rng(7)
    actions = [sub.epsilon_greedy(TIES, 0, 0.5, rng) for _ in range(12)]
    equal(actions, [1, 1, 1, 0, 1, 1, 1, 1, 3, 1, 3, 1], what="the 12 actions")


@check("properties", "only Q[s, a] changes and the input is not changed", "One transition updates one entry. The function returns a new table and keeps the caller's table as it was.")
def one_entry(sub):
    rng = np.random.default_rng(0)
    Q = rng.normal(size=(5, 3))
    saved = Q.copy()
    for fn, args in [(sub.q_learning_update, (Q, 2, 1, 0.7, 4, False, 0.3, 0.95)), (sub.sarsa_update, (Q, 2, 1, 0.7, 4, 0, False, 0.3, 0.95))]:
        new = np.asarray(fn(*args))
        true(np.array_equal(Q, saved), f"{fn.__name__} changed the input table", saved, Q)
        mask = np.ones_like(Q, dtype=bool)
        mask[2, 1] = False
        true(np.array_equal(new[mask], saved[mask]), f"{fn.__name__} changed an entry other than Q[s, a]", saved, new)


@check("properties", "alpha sets the step toward the target", "With alpha = 1 the new Q[s, a] equals the target. With alpha = 0 nothing changes. When Q[s, a] already equals the target, the update keeps it.")
def alpha_limits(sub):
    rng = np.random.default_rng(1)
    Q = rng.normal(size=(4, 3))
    target = 0.4 + 0.8 * np.max(Q[3])
    close(np.asarray(sub.q_learning_update(Q, 0, 2, 0.4, 3, False, alpha=1.0, gamma=0.8))[0, 2], target, atol=1e-12, what="Q[0, 2] with alpha = 1")
    close(sub.q_learning_update(Q, 0, 2, 0.4, 3, False, alpha=0.0, gamma=0.8), Q, atol=1e-15, what="the table with alpha = 0")
    fixed = Q.copy()
    fixed[1, 0] = 0.4 + 0.8 * fixed[3, 1]
    close(sub.sarsa_update(fixed, 1, 0, 0.4, 3, 1, False, alpha=0.5, gamma=0.8), fixed, atol=1e-12, what="the table when Q[s, a] equals the SARSA target")


@check("properties", "Q-learning and SARSA agree when a' is greedy", "Q-learning uses the max over the next actions. SARSA with the greedy next action gives the same target, so the two updates are equal.")
def greedy_agreement(sub):
    rng = np.random.default_rng(2)
    Q = rng.normal(size=(6, 4))
    for s, a, r, s_next in [(0, 1, 1.0, 3), (5, 0, -2.0, 2), (3, 3, 0.5, 3)]:
        greedy = int(np.argmax(Q[s_next]))
        close(sub.sarsa_update(Q, s, a, r, s_next, greedy, False, 0.2, 0.9), sub.q_learning_update(Q, s, a, r, s_next, False, 0.2, 0.9), atol=1e-12, what=f"SARSA with the greedy a' for s' = {s_next}")


@check("properties", "epsilon-greedy draws the random numbers in the given order", "Each call draws one rng.random(). Only when it is below epsilon does the call draw rng.integers(n_actions). The same seed gives the same actions.")
def draw_order(sub):
    rng_q = np.random.default_rng(3)
    Q = rng_q.normal(size=(3, 5))
    for epsilon in [0.1, 0.3, 0.9]:
        got = [sub.epsilon_greedy(Q, 1, epsilon, rng) for rng in [np.random.default_rng(11)] for _ in range(30)]
        expected = manual_policy(Q[1], epsilon, np.random.default_rng(11), 30)
        equal(got, expected, what=f"the 30 actions for epsilon = {epsilon}")


@check("edge", "epsilon 0 and epsilon 1", "With epsilon = 0 every action is greedy. With epsilon = 1 every action is a random draw from rng.integers.")
def epsilon_limits(sub):
    rng = np.random.default_rng(4)
    equal([sub.epsilon_greedy(TIES, 0, 0.0, rng) for _ in range(5)], [1, 1, 1, 1, 1], what="the actions with epsilon = 0")
    got = [sub.epsilon_greedy(TIES, 0, 1.0, rng) for rng in [np.random.default_rng(5)] for _ in range(10)]
    equal(got, manual_policy(TIES[0], 1.0, np.random.default_rng(5), 10), what="the actions with epsilon = 1")
    true(all(isinstance(a, int) for a in got), "epsilon_greedy must return a Python int", "int", [type(a).__name__ for a in got])


@check("edge", "ties go to the lowest index", "When several actions share the largest Q value, the greedy action is the one with the lowest index.")
def ties(sub):
    rng = np.random.default_rng(6)
    Q = np.array([[0.0, 0.0, 0.0], [-1.0, 2.0, 2.0], [5.0, 1.0, 5.0]])
    equal([sub.epsilon_greedy(Q, s, 0.0, rng) for s in range(3)], [0, 1, 0], what="the greedy actions of the three states")


@check("edge", "SARSA at a terminal step and a self loop", "When done is True, SARSA also ignores Q[s', a']. When s' equals s, the target reads the old value of the same row.")
def sarsa_terminal_and_loop(sub):
    Q = np.array([[4.0, -2.0], [10.0, 7.0]])
    close(sub.sarsa_update(Q, 0, 0, 1.0, 1, 0, True, alpha=0.5, gamma=0.9), [[2.5, -2.0], [10.0, 7.0]], what="SARSA after a terminal step")
    close(sub.q_learning_update(Q, 0, 1, 1.0, 0, False, alpha=0.5, gamma=0.9), [[4.0, 1.3], [10.0, 7.0]], what="Q-learning with s' = s")


@fixture("transitions")
def transitions(ref):
    rng = np.random.default_rng(42)
    for n_states, n_actions, alpha, gamma in [(4, 2, 0.1, 0.99), (6, 3, 0.5, 0.9), (3, 4, 0.25, 0.5)]:
        Q = rng.normal(size=(n_states, n_actions))
        steps = []
        q_tab = Q.copy()
        s_tab = Q.copy()
        for _ in range(6):
            s = int(rng.integers(n_states))
            a = int(rng.integers(n_actions))
            r = float(rng.normal())
            s_next = int(rng.integers(n_states))
            a_next = int(rng.integers(n_actions))
            done = bool(rng.random() < 0.3)
            q_tab = ref.q_learning_update(q_tab, s, a, r, s_next, done, alpha, gamma)
            s_tab = ref.sarsa_update(s_tab, s, a, r, s_next, a_next, done, alpha, gamma)
            steps.append({"s": s, "a": a, "r": r, "s_next": s_next, "a_next": a_next, "done": done})
        yield {"Q": Q, "alpha": alpha, "gamma": gamma, "steps": steps}, {"q": q_tab, "sarsa": s_tab}


@fixture("policies")
def policies(ref):
    rng = np.random.default_rng(43)
    for n_actions, epsilon, seed in [(3, 0.2, 100), (5, 0.6, 101), (2, 0.05, 102)]:
        Q = np.round(rng.normal(size=(2, n_actions)), 1)
        Q[1, -1] = Q[1, 0]
        draw = np.random.default_rng(seed)
        actions = [ref.epsilon_greedy(Q, i % 2, epsilon, draw) for i in range(20)]
        yield {"Q": Q, "epsilon": epsilon, "seed": seed}, actions


@check("reference", "runs of updates match the reference", "Your Q-learning and SARSA tables agree with the reference after 6 random transitions, some of them terminal.")
def reference_updates(sub):
    for case, expected in fixtures("transitions"):
        q_tab = case["Q"].copy()
        s_tab = case["Q"].copy()
        for t in case["steps"]:
            q_tab = sub.q_learning_update(q_tab, t["s"], t["a"], t["r"], t["s_next"], t["done"], case["alpha"], case["gamma"])
            s_tab = sub.sarsa_update(s_tab, t["s"], t["a"], t["r"], t["s_next"], t["a_next"], t["done"], case["alpha"], case["gamma"])
        label = f"the table of shape {case['Q'].shape}"
        close(q_tab, expected["q"], rtol=1e-10, atol=1e-12, what=f"Q-learning for {label}")
        close(s_tab, expected["sarsa"], rtol=1e-10, atol=1e-12, what=f"SARSA for {label}")


@check("reference", "epsilon-greedy runs match the reference", "Your actions agree with the reference for 20 calls with a seeded rng, with ties in the table.")
def reference_policies(sub):
    for case, expected in fixtures("policies"):
        draw = np.random.default_rng(case["seed"])
        got = [sub.epsilon_greedy(case["Q"], i % 2, case["epsilon"], draw) for i in range(20)]
        equal(got, expected, what=f"the 20 actions for epsilon = {case['epsilon']}")
