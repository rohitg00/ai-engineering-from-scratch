import numpy as np

from practice_check import check, close, fixture, fixtures, shape, true

R1 = np.array([1.0, 0.0, 1.0])
V1 = np.array([0.5, 0.4, 0.3, 0.2])
D1 = np.array([False, False, True])
R2 = np.array([1.0, 1.0, 1.0, 1.0])
V2 = np.array([1.0, 2.0, 1.0, 2.0, 3.0])
D2 = np.array([False, True, False, False])


def discounted_minus_values(rewards, values, dones, gamma):
    T = rewards.shape[0]
    G = values[T]
    out = np.zeros(T)
    for t in reversed(range(T)):
        G = rewards[t] + gamma * (0.0 if dones[t] else G)
        out[t] = G
    return out - values[:T]


@check("examples", "TD errors of a three-step episode", "delta[t] is rewards[t] + gamma * values[t + 1] - values[t]. At a done step, the next value is 0.")
def example_td(sub):
    close(sub.td_errors(R1, V1, D1, 0.9), [0.86, -0.13, 0.7], what="the TD errors")


@check("examples", "GAE of a three-step episode", "A[t] is delta[t] + gamma * lam * A[t + 1]. The return is the advantage plus values[t].")
def example_gae(sub):
    adv, ret = sub.gae(R1, V1, D1, 0.9, 0.8)
    close(adv, [1.12928, 0.374, 0.7], what="the advantages")
    close(ret, [1.62928, 0.774, 1.0], what="the returns")


@check("examples", "GAE over two episodes with a bootstrap value", "The done flag at step 1 cuts the sum. The last step has no done flag, so it uses values[T] as the bootstrap value.")
def example_two_episodes(sub):
    adv, ret = sub.gae(R2, V2, D2, 0.5, 0.5)
    close(adv, [0.75, -1.0, 1.125, 0.5], what="the advantages")
    close(ret, [1.75, 1.0, 2.125, 2.5], what="the returns")


@check("properties", "lam = 0 gives the TD errors", "With lam = 0, no later delta enters the sum. Each advantage is the one-step TD error.")
def lam_zero(sub):
    rng = np.random.default_rng(0)
    rewards, values = rng.normal(size=10), rng.normal(size=11)
    dones = rng.random(10) < 0.3
    adv, _ = sub.gae(rewards, values, dones, 0.95, 0.0)
    close(adv, sub.td_errors(rewards, values, dones, 0.95), what="the advantages with lam = 0")


@check("properties", "lam = 1 gives the discounted return minus the value", "With lam = 1, the deltas sum to the discounted return from t, bootstrapped with values[T], minus values[t].")
def lam_one(sub):
    rng = np.random.default_rng(1)
    rewards, values = rng.normal(size=10), rng.normal(size=11)
    dones = np.array([False, False, True, False, False, False, True, False, False, False])
    adv, _ = sub.gae(rewards, values, dones, 0.9, 1.0)
    close(adv, discounted_minus_values(rewards, values, dones, 0.9), what="the advantages with lam = 1")


@check("properties", "advantages follow the recursion", "For each step before the last, A[t] equals delta[t] + gamma * lam * A[t + 1], and the term after a done step is 0.")
def recursion(sub):
    rng = np.random.default_rng(2)
    rewards, values = rng.normal(size=12), rng.normal(size=13)
    dones = rng.random(12) < 0.25
    gamma, lam = 0.97, 0.9
    adv, ret = sub.gae(rewards, values, dones, gamma, lam)
    shape(adv, (12,), what="the advantages")
    shape(ret, (12,), what="the returns")
    delta = rewards + gamma * values[1:] * (1.0 - dones) - values[:-1]
    adv = np.asarray(adv, dtype=float)
    close(adv[:-1], delta[:-1] + gamma * lam * (1.0 - dones[:-1]) * adv[1:], what="delta[t] + gamma * lam * A[t + 1]")
    close(ret, adv + values[:12], what="advantages + values[:T]")


@check("properties", "a batch equals its episodes one at a time", "When each episode ends with a done flag, GAE of the batch is GAE of each episode alone, joined in order.")
def batch_is_concatenation(sub):
    rng = np.random.default_rng(3)
    lengths = [4, 1, 3]
    T = sum(lengths)
    rewards, values = rng.normal(size=T), rng.normal(size=T + 1)
    dones = np.zeros(T, dtype=bool)
    dones[np.cumsum(lengths) - 1] = True
    parts = []
    start = 0
    for n in lengths:
        ep_values = np.append(values[start:start + n], 0.0)
        parts.append(np.asarray(sub.gae(rewards[start:start + n], ep_values, dones[start:start + n], 0.9, 0.95)[0]))
        start += n
    close(sub.gae(rewards, values, dones, 0.9, 0.95)[0], np.concatenate(parts), what="the advantages of the batch")


@check("properties", "the inputs are not changed", "A function that writes into its input array breaks the code that calls it.")
def inputs_unchanged(sub):
    rewards, values, dones = R2.copy(), V2.copy(), D2.copy()
    sub.td_errors(rewards, values, dones, 0.5)
    sub.gae(rewards, values, dones, 0.5, 0.5)
    close(rewards, R2, atol=0, rtol=0, what="the rewards after the calls")
    close(values, V2, atol=0, rtol=0, what="the values after the calls")
    true(np.array_equal(dones, D2), "the dones array changed", D2, dones)


@check("edge", "one step with no done flag", "A single step that does not end uses the bootstrap value: A = r + gamma * values[1] - values[0].")
def single_step(sub):
    adv, ret = sub.gae(np.array([2.0]), np.array([1.0, 3.0]), np.array([False]), 0.5, 0.9)
    close(adv, [2.5], what="the advantage")
    close(ret, [3.5], what="the return")


@check("edge", "done at every step", "When every step ends an episode, no value after a step enters. Each advantage is rewards[t] - values[t].")
def done_every_step(sub):
    rewards = np.array([1.0, -1.0, 0.5])
    values = np.array([0.2, 0.4, -0.3, 9.0])
    adv, _ = sub.gae(rewards, values, np.ones(3, dtype=bool), 0.99, 0.95)
    close(adv, rewards - values[:3], what="the advantages")


@check("edge", "the bootstrap value only reaches the unfinished episode", "values[T] enters only through the steps after the last done flag. A finished batch does not use it.")
def bootstrap_reach(sub):
    rewards = np.array([1.0, 0.0, 1.0, 0.0])
    dones = np.array([False, True, False, False])
    low = np.array([0.1, 0.2, 0.3, 0.4, 0.0])
    high = low.copy()
    high[4] = 10.0
    a_low = np.asarray(sub.gae(rewards, low, dones, 0.9, 0.95)[0])
    a_high = np.asarray(sub.gae(rewards, high, dones, 0.9, 0.95)[0])
    close(a_high[:2], a_low[:2], what="the advantages of the finished episode")
    close(a_high[2:] - a_low[2:], [0.9 * 0.95 * 0.9 * 10.0, 0.9 * 10.0], what="the change of the last two advantages when values[T] grows by 10")
    done_all = np.array([False, True, False, True])
    close(sub.gae(rewards, high, done_all, 0.9, 0.95)[0], sub.gae(rewards, low, done_all, 0.9, 0.95)[0], what="the advantages when the last step is done")


@check("edge", "gamma = 0", "With gamma = 0, only the reward of the step counts. Each advantage is rewards[t] - values[t] for any lam.")
def gamma_zero(sub):
    rewards = np.array([1.0, 2.0, 3.0])
    values = np.array([0.5, 0.5, 0.5, 0.5])
    adv, _ = sub.gae(rewards, values, np.zeros(3, dtype=bool), 0.0, 0.95)
    close(adv, rewards - values[:3], what="the advantages")


@fixture("rollouts")
def rollouts(ref):
    rng = np.random.default_rng(42)
    for T, gamma, lam, p_done in [(1, 0.99, 0.95, 0.5), (5, 0.9, 0.8, 0.3), (16, 0.99, 0.95, 0.15), (12, 0.8, 0.5, 0.4), (20, 0.97, 1.0, 0.1)]:
        rewards = np.round(rng.normal(size=T), 3)
        values = np.round(rng.normal(size=T + 1), 3)
        dones = rng.random(T) < p_done
        adv, ret = ref.gae(rewards, values, dones, gamma, lam)
        yield {"rewards": rewards, "values": values, "dones": dones, "gamma": gamma, "lam": lam}, {
            "td": ref.td_errors(rewards, values, dones, gamma),
            "advantages": adv,
            "returns": ret,
        }


@check("reference", "TD errors match the reference on 5 random rollouts", "Your TD errors agree with the reference solution on rollouts of many lengths and done patterns.")
def reference_td(sub):
    for case, expected in fixtures("rollouts"):
        close(sub.td_errors(case["rewards"], case["values"], case["dones"], case["gamma"]), expected["td"], what=f"the TD errors for T = {case['rewards'].shape[0]}")


@check("reference", "advantages and returns match the reference", "Your GAE agrees with the reference solution on the same rollouts.")
def reference_gae(sub):
    for case, expected in fixtures("rollouts"):
        adv, ret = sub.gae(case["rewards"], case["values"], case["dones"], case["gamma"], case["lam"])
        T = case["rewards"].shape[0]
        close(adv, expected["advantages"], what=f"the advantages for T = {T}")
        close(ret, expected["returns"], what=f"the returns for T = {T}")
