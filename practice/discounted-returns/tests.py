import numpy as np

from practice_check import check, close, fixture, fixtures, shape, true


@check("examples", "returns of a three-step episode", "The return at step t is the reward at t plus gamma times the return at step t + 1. The last step has no next return.")
def example_returns(sub):
    close(sub.returns_to_go(np.array([1.0, 0.0, 2.0]), 0.9), [2.62, 1.8, 2.0], what="the returns")


@check("examples", "returns of two episodes in one batch", "When dones[t] is True, step t is the last step of its episode. The return at step t then uses no reward from step t + 1.")
def example_batch(sub):
    rewards = np.array([1.0, 1.0, 1.0, 1.0, 1.0])
    dones = np.array([False, True, False, False, True])
    close(sub.batch_returns(rewards, dones, 0.5), [1.5, 1.0, 1.75, 1.5, 1.0], what="the batch returns")


@check("examples", "normalize four returns", "Subtract the mean and divide by the population standard deviation plus 1e-8.")
def example_normalize(sub):
    close(sub.normalize(np.array([1.0, 2.0, 3.0, 4.0])), [-1.34164077, -0.44721359, 0.44721359, 1.34164077], what="the normalized returns")


@check("properties", "each return follows the recursion", "For every step t before the last, G[t] equals rewards[t] plus gamma times G[t + 1].")
def recursion(sub):
    rng = np.random.default_rng(0)
    rewards = rng.normal(size=12)
    gamma = 0.93
    G = sub.returns_to_go(rewards, gamma)
    shape(G, (12,), what="the returns")
    close(G[:-1], rewards[:-1] + gamma * np.asarray(G)[1:], what="rewards[t] + gamma * G[t + 1]")
    close(G[-1], rewards[-1], what="the return of the last step")


@check("properties", "gamma 0 and gamma 1", "With gamma = 0 each return is its own reward. With gamma = 1 each return is the plain sum of the rewards from t to the end.")
def gamma_limits(sub):
    rewards = np.array([0.5, -1.0, 2.0, 3.0, -0.25])
    close(sub.returns_to_go(rewards, 0.0), rewards, what="the returns with gamma = 0")
    close(sub.returns_to_go(rewards, 1.0), np.cumsum(rewards[::-1])[::-1], what="the returns with gamma = 1")


@check("properties", "a batch equals its episodes one at a time", "The returns of a batch are the returns of each episode, computed alone and joined in order.")
def batch_is_concatenation(sub):
    rng = np.random.default_rng(1)
    lengths = [3, 1, 5, 2]
    rewards = rng.normal(size=sum(lengths))
    dones = np.zeros(sum(lengths), dtype=bool)
    dones[np.cumsum(lengths) - 1] = True
    gamma = 0.8
    parts = []
    start = 0
    for n in lengths:
        parts.append(np.asarray(sub.returns_to_go(rewards[start:start + n], gamma)))
        start += n
    close(sub.batch_returns(rewards, dones, gamma), np.concatenate(parts), what="the batch returns")


@check("properties", "normalized returns have mean 0 and standard deviation 1", "Normalization removes the mean and scales by the population standard deviation.")
def normalize_moments(sub):
    rng = np.random.default_rng(2)
    out = np.asarray(sub.normalize(rng.normal(3.0, 5.0, size=40)), dtype=float)
    shape(out, (40,), what="the normalized returns")
    close(np.mean(out), 0.0, atol=1e-9, what="the mean")
    close(np.std(out), 1.0, atol=1e-6, what="the population standard deviation")


@check("properties", "the inputs are not changed", "A function that writes into its input array breaks the code that calls it.")
def inputs_unchanged(sub):
    rewards = np.array([1.0, -2.0, 0.5, 3.0])
    dones = np.array([False, True, False, False])
    saved_r, saved_d = rewards.copy(), dones.copy()
    sub.returns_to_go(rewards, 0.9)
    sub.batch_returns(rewards, dones, 0.9)
    sub.normalize(rewards)
    close(rewards, saved_r, atol=0, rtol=0, what="the rewards after the calls")
    true(np.array_equal(dones, saved_d), "the dones array changed", saved_d, dones)


@check("edge", "an episode of length 1", "One step has a return equal to its reward.")
def length_one(sub):
    close(sub.returns_to_go(np.array([4.0]), 0.99), [4.0], what="the returns")
    close(sub.batch_returns(np.array([4.0]), np.array([True]), 0.99), [4.0], what="the batch returns")


@check("edge", "done at every step", "When every step ends an episode, no reward passes to an earlier step. Each return equals its reward.")
def done_every_step(sub):
    rewards = np.array([1.0, 2.0, 3.0, 4.0])
    close(sub.batch_returns(rewards, np.ones(4, dtype=bool), 0.9), rewards, what="the batch returns")


@check("edge", "an unfinished episode at the end of the batch", "The steps after the last done have no done flag. Treat the end of the batch as the end of their sum, with no bootstrap value.")
def trailing_partial(sub):
    rewards = np.array([1.0, 2.0, 1.0, 1.0, 1.0])
    dones = np.array([False, True, False, False, False])
    expected = np.concatenate([np.asarray(sub.returns_to_go(rewards[:2], 0.7)), np.asarray(sub.returns_to_go(rewards[2:], 0.7))])
    close(sub.batch_returns(rewards, dones, 0.7), expected, what="the batch returns")
    close(sub.batch_returns(rewards, np.zeros(5, dtype=bool), 0.7), sub.returns_to_go(rewards, 0.7), what="the batch returns with no done flag")


@check("edge", "normalize equal returns", "When all returns are equal, the standard deviation is 0. The 1e-8 term keeps the division finite, so the output is all zeros.")
def normalize_constant(sub):
    close(sub.normalize(np.array([2.0, 2.0, 2.0])), [0.0, 0.0, 0.0], atol=1e-12, what="the normalized returns")


@check("edge", "normalize one return", "With fewer than 2 values there is no spread to measure. Return the values unchanged.")
def normalize_single(sub):
    close(sub.normalize(np.array([5.0])), [5.0], what="the normalized returns")


@fixture("batches")
def batches(ref):
    rng = np.random.default_rng(42)
    for n, gamma, p_done in [(1, 0.99, 0.5), (6, 0.9, 0.3), (15, 0.99, 0.2), (20, 0.5, 0.5), (9, 1.0, 0.1)]:
        rewards = np.round(rng.normal(size=n) * 2.0, 3)
        dones = rng.random(n) < p_done
        yield {"rewards": rewards, "dones": dones, "gamma": gamma}, {
            "returns": ref.returns_to_go(rewards, gamma),
            "batch": ref.batch_returns(rewards, dones, gamma),
            "normalized": ref.normalize(ref.batch_returns(rewards, dones, gamma)),
        }


@check("reference", "returns match the reference on 5 random batches", "Your returns agree with the reference solution on batches of many lengths, gammas and done patterns.")
def reference_returns(sub):
    for case, expected in fixtures("batches"):
        n = case["rewards"].shape[0]
        close(sub.returns_to_go(case["rewards"], case["gamma"]), expected["returns"], what=f"returns_to_go for length {n}")
        close(sub.batch_returns(case["rewards"], case["dones"], case["gamma"]), expected["batch"], what=f"batch_returns for length {n}")


@check("reference", "normalized batch returns match the reference", "Your normalize agrees with the reference solution on the same batches.")
def reference_normalize(sub):
    for case, expected in fixtures("batches"):
        close(sub.normalize(expected["batch"]), expected["normalized"], what=f"normalize for length {case['rewards'].shape[0]}")
