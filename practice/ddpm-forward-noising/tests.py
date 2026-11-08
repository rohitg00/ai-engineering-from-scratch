import numpy as np

from practice_check import check, close, fixture, fixtures, shape, true

B5 = np.array([0.1, 0.2, 0.3, 0.4, 0.5])
AB5 = np.array([0.9, 0.72, 0.504, 0.3024, 0.1512])
X0 = np.array([1.0, -2.0])
EPS = np.array([0.5, 0.5])
XT = np.array([1.06206591, -1.06772281])


def ref_schedule(T):
    betas = 1e-4 + (0.02 - 1e-4) * np.arange(T) / (T - 1)
    return betas, np.cumprod(1.0 - betas)


@check("examples", "a schedule of 5 steps from 0.1 to 0.5", "The betas go in equal steps from beta_start at t = 0 to beta_end at t = T - 1. alpha is 1 - beta, and alpha_bar is the running product of the alphas.")
def example_schedule(sub):
    betas, alphas, alpha_bars = sub.make_schedule(5, 0.1, 0.5)
    close(betas, B5, rtol=1e-12, what="the betas")
    close(alphas, 1.0 - B5, rtol=1e-12, what="the alphas")
    close(alpha_bars, AB5, rtol=1e-12, what="the alpha bars")


@check("examples", "one closed form sample at t = 2", "x_t is sqrt(alpha_bar_t) times x0 plus sqrt(1 - alpha_bar_t) times the noise.")
def example_q_sample(sub):
    close(sub.q_sample(X0, 2, AB5, EPS), XT, rtol=1e-7, what="x_t")


@check("examples", "the posterior mean and variance at t = 2", "The posterior mean mixes x0 and x_t with the two coefficients of the paper. The variance is (1 - alpha_bar_{t-1}) / (1 - alpha_bar_t) times beta_t.")
def example_posterior(sub):
    mean, variance = sub.posterior_mean_variance(X0, XT, 2, B5, AB5)
    close(mean, [1.01484497, -1.53073944], rtol=1e-7, what="the posterior mean")
    close(variance, 0.1693548387096774, rtol=1e-9, what="the posterior variance")


@check("properties", "the default schedule of 1000 steps", "With the defaults the betas start at 1e-4 and end at 0.02. alpha_bar falls from 0.9999 toward 0 and never goes up.")
def default_schedule(sub):
    betas, alphas, alpha_bars = sub.make_schedule(1000)
    shape(betas, (1000,), what="the betas")
    exp_b, exp_ab = ref_schedule(1000)
    close(betas, exp_b, rtol=1e-12, what="the betas")
    close(alpha_bars, exp_ab, rtol=1e-10, what="the alpha bars")
    ab = np.asarray(alpha_bars)
    true(np.all(np.diff(ab) < 0) and ab[-1] > 0, "alpha_bar must fall at each step and stay above 0", "a strictly falling sequence above 0", ab)


@check("properties", "signal and noise variances sum to 1", "The coefficients are sqrt(alpha_bar) and sqrt(1 - alpha_bar). Their squares sum to 1, so unit variance data keeps unit variance at every step.")
def variance_preserving(sub):
    _, _, alpha_bars = sub.make_schedule(50)
    for t in [0, 10, 49]:
        signal = sub.q_sample(np.array([1.0]), t, alpha_bars, np.array([0.0]))
        noise = sub.q_sample(np.array([0.0]), t, alpha_bars, np.array([1.0]))
        close(np.asarray(signal) ** 2 + np.asarray(noise) ** 2, [1.0], rtol=1e-12, what=f"the sum of squared coefficients at t = {t}")


@check("properties", "the posterior mean equals the noise form of the paper", "When x_t comes from x0 and noise eps, the posterior mean is (x_t - beta_t / sqrt(1 - alpha_bar_t) times eps) / sqrt(alpha_t). The sampler of the lesson uses this form.")
def eps_form(sub):
    rng = np.random.default_rng(0)
    betas, _ = ref_schedule(40)
    _, _, alpha_bars = sub.make_schedule(40)
    alpha_bars = np.asarray(alpha_bars)
    x0 = rng.normal(size=(3, 4))
    for t in [1, 7, 39]:
        eps = rng.normal(size=(3, 4))
        x_t = sub.q_sample(x0, t, alpha_bars, eps)
        mean, _ = sub.posterior_mean_variance(x0, x_t, t, betas, alpha_bars)
        expected = (np.asarray(x_t) - betas[t] / np.sqrt(1.0 - alpha_bars[t]) * eps) / np.sqrt(1.0 - betas[t])
        close(mean, expected, rtol=1e-9, atol=1e-12, what=f"the posterior mean at t = {t}")


@check("properties", "a batch of timesteps matches one sample at a time", "When t is an array of shape (B,), row b of x0 uses timestep t[b]. Reshape the coefficients to (B, 1, ...) so that they broadcast over the other axes.")
def batched_t(sub):
    rng = np.random.default_rng(1)
    betas, alpha_bars = ref_schedule(20)
    x0 = rng.normal(size=(4, 3, 2))
    eps = rng.normal(size=(4, 3, 2))
    t = np.array([0, 5, 19, 5])
    x_t = sub.q_sample(x0, t, alpha_bars, eps)
    shape(x_t, (4, 3, 2), what="the batched x_t")
    mean, variance = sub.posterior_mean_variance(x0, x_t, t, betas, alpha_bars)
    shape(mean, (4, 3, 2), what="the batched posterior mean")
    for b in range(4):
        one = sub.q_sample(x0[b], int(t[b]), alpha_bars, eps[b])
        close(np.asarray(x_t)[b], one, atol=1e-12, what=f"x_t of item {b}")
        one_mean, one_var = sub.posterior_mean_variance(x0[b], one, int(t[b]), betas, alpha_bars)
        close(np.asarray(mean)[b], one_mean, atol=1e-12, what=f"the posterior mean of item {b}")
        close(np.asarray(variance).reshape(-1)[b], one_var, atol=1e-15, what=f"the posterior variance of item {b}")


@check("properties", "the inputs are not changed", "The functions must not write into x0, x_t, the noise or the schedule arrays.")
def inputs_unchanged(sub):
    rng = np.random.default_rng(2)
    betas, alpha_bars = ref_schedule(10)
    x0 = rng.normal(size=(3,))
    eps = rng.normal(size=(3,))
    saved = [x0.copy(), eps.copy(), betas.copy(), alpha_bars.copy()]
    x_t = sub.q_sample(x0, 4, alpha_bars, eps)
    sub.posterior_mean_variance(x0, np.asarray(x_t), 4, betas, alpha_bars)
    for name, before, after in zip(["x0", "noise", "betas", "alpha_bars"], saved, [x0, eps, betas, alpha_bars]):
        true(np.array_equal(before, after), f"The function changed {name}", before, after)


@check("edge", "the posterior at t = 0 is x0 with variance 0", "Before step 0 there is no noise, so alpha_bar_{-1} is 1. Then the posterior mean is exactly x0 and the variance is 0. Do not read alpha_bars[-1], which is the last step.")
def t_zero(sub):
    mean, variance = sub.posterior_mean_variance(X0, XT, 0, B5, AB5)
    close(mean, X0, rtol=1e-12, atol=1e-12, what="the posterior mean at t = 0")
    close(variance, 0.0, atol=1e-15, what="the posterior variance at t = 0")


@check("edge", "the last step is almost pure noise", "At t = T - 1 of the default 1000 step schedule, alpha_bar is about 4e-5. x_t is then very close to the noise.")
def last_step(sub):
    _, _, alpha_bars = sub.make_schedule(1000)
    close(np.asarray(alpha_bars)[-1], 4.0358297653756754e-05, rtol=1e-8, what="the last alpha bar")
    x_t = sub.q_sample(np.array([3.0]), 999, alpha_bars, np.array([-1.0]))
    close(x_t, [-0.98092137], rtol=1e-7, what="x_t at the last step")


@check("edge", "a schedule of 2 steps", "With T = 2 the betas are exactly beta_start and beta_end.")
def two_steps(sub):
    betas, alphas, alpha_bars = sub.make_schedule(2, 0.1, 0.5)
    close(betas, [0.1, 0.5], rtol=1e-12, what="the betas")
    close(alpha_bars, [0.9, 0.45], rtol=1e-12, what="the alpha bars")


@fixture("cases")
def cases(ref):
    rng = np.random.default_rng(42)
    for T, shape_, t in [(10, (4,), 3), (50, (2, 3), 0), (50, (2, 3), 49), (100, (5, 2), np.array([0, 10, 50, 99, 1]))]:
        betas, _, alpha_bars = ref.make_schedule(T)
        x0 = rng.normal(size=shape_)
        eps = rng.normal(size=shape_)
        x_t = ref.q_sample(x0, t, alpha_bars, eps)
        mean, variance = ref.posterior_mean_variance(x0, x_t, t, betas, alpha_bars)
        yield {"T": T, "x0": x0, "noise": eps, "t": t}, {"betas": betas, "alpha_bars": alpha_bars, "x_t": x_t, "mean": mean, "variance": np.asarray(variance)}


@check("reference", "schedule, sample and posterior match the reference on 4 cases", "Your schedule, x_t, posterior mean and variance agree with the reference solution.")
def reference_cases(sub):
    for case, expected in fixtures("cases"):
        label = f"T = {case['T']} and t = {case['t']}"
        betas, _, alpha_bars = sub.make_schedule(case["T"])
        close(betas, expected["betas"], rtol=1e-12, what=f"the betas for {label}")
        close(alpha_bars, expected["alpha_bars"], rtol=1e-10, what=f"the alpha bars for {label}")
        x_t = sub.q_sample(case["x0"], case["t"], expected["alpha_bars"], case["noise"])
        close(x_t, expected["x_t"], rtol=1e-10, atol=1e-12, what=f"x_t for {label}")
        mean, variance = sub.posterior_mean_variance(case["x0"], expected["x_t"], case["t"], expected["betas"], expected["alpha_bars"])
        close(mean, expected["mean"], rtol=1e-10, atol=1e-12, what=f"the posterior mean for {label}")
        close(variance, expected["variance"], rtol=1e-10, atol=1e-15, what=f"the posterior variance for {label}")
