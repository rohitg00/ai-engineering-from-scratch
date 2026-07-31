# Sampling Methods

> Sampling is how AI explores the space of possibilities.

**Type:** Build
**Language:** Python
**Prerequisites:** Phase 1, Lessons 06-07 (Probability, Bayes' Theorem)
**Time:** ~120 minutes

## Learning Objectives

- Implement inverse CDF, rejection, and importance sampling from scratch using only uniform random numbers
- Build temperature, top-k, and top-p (nucleus) sampling for language model token generation
- Explain the reparameterization trick and why it enables backpropagation through sampling in VAEs
- Run Metropolis-Hastings MCMC to sample from an unnormalized target distribution

## The Problem

A language model finishes processing your prompt and produces a vector of 50,000 logits. One for every token in its vocabulary. Now it has to pick one. How?

If it always picks the highest-probability token, every response is identical. Deterministic. Boring. If it picks uniformly at random, the output is gibberish. The answer lives somewhere between these extremes, and that somewhere is controlled by sampling.

Sampling is not limited to text generation. Reinforcement learning estimates policy gradients by sampling trajectories. VAEs learn latent representations by sampling from learned distributions and backpropagating through the randomness. Diffusion models generate images by sampling noise and iteratively denoising. Monte Carlo methods estimate integrals that have no closed-form solution. MCMC algorithms explore high-dimensional posterior distributions that are impossible to enumerate.

Every generative AI system is a sampling system. The sampling strategy determines the quality, diversity, and controllability of the output. This lesson builds every major sampling method from scratch, starting from uniform random numbers and ending with the techniques that power modern LLMs and generative models.

## The Concept

### Why Sampling Matters

Sampling appears in four fundamental roles across AI and machine learning:

**Generation.** Language models, diffusion models, and GANs all produce output by sampling. The sampling algorithm directly controls creativity, coherence, and diversity. Temperature, top-k, and nucleus sampling are the knobs that engineers turn daily.

**Training.** Stochastic gradient descent samples mini-batches. Dropout samples neurons to deactivate. Data augmentation samples random transformations. Importance sampling reweights samples to reduce gradient variance in reinforcement learning (PPO, TRPO).

**Estimation.** Many quantities in ML have no closed-form solution. The expected loss over a data distribution, the partition function of an energy-based model, the evidence in Bayesian inference. Monte Carlo estimation approximates all of these by averaging over samples.

**Exploration.** MCMC algorithms explore posterior distributions in Bayesian inference. Evolutionary strategies sample parameter perturbations. Thompson sampling balances exploration and exploitation in bandits.

The core challenge: you can only sample directly from simple distributions (uniform, normal). For everything else, you need a method to convert simple samples into samples from your target distribution.

### Uniform Random Sampling

Every sampling method starts here. A uniform random number generator produces values in [0, 1) where every sub-interval of equal length has equal probability.

$$
\begin{aligned}
&U \sim \text{Uniform}(0, 1) \\
&P(a \leq U \leq b) = b - a \quad \text{for } 0 \leq a \leq b \leq 1 \\
&\text{Properties:} \\
&\quad E[U] = 0.5 \\
&\quad \text{Var}(U) = \tfrac{1}{12}
\end{aligned}
$$

To sample uniformly from a discrete set of $n$ items, generate $U$ and return $\lfloor n U \rfloor$. To sample from a continuous range $[a, b]$, compute $a + (b - a) U$.

The key insight: a single uniform random number contains exactly the right amount of randomness to produce one sample from any distribution. The trick is finding the right transformation.

### Inverse CDF Method (Inverse Transform Sampling)

The cumulative distribution function (CDF) maps values to probabilities:

$$
\begin{aligned}
&F(x) = P(X \leq x) \\
&\text{Properties:} \\
&\quad F \text{ is non-decreasing} \\
&\quad F(-\infty) = 0 \\
&\quad F(+\infty) = 1 \\
&\quad F \text{ maps the real line to } [0, 1]
\end{aligned}
$$

The inverse CDF maps probabilities back to values. If $U \sim \text{Uniform}(0, 1)$, then $X = F^{-1}(U)$ follows the target distribution.

$$
\begin{aligned}
&\text{Algorithm:} \\
&\quad 1.\ \text{Generate } u \sim \text{Uniform}(0, 1) \\
&\quad 2.\ \text{Return } F^{-1}(u) \\
&\text{Why it works:} \\
&\quad P(X \leq x) = P(F^{-1}(U) \leq x) = P(U \leq F(x)) = F(x)
\end{aligned}
$$

**Exponential distribution example:**

$$
\begin{aligned}
&\text{PDF: } f(x) = \lambda \, e^{-\lambda x}, \quad x \geq 0 \\
&\text{CDF: } F(x) = 1 - e^{-\lambda x} \\
&\text{Solve } F(x) = u \text{ for } x: \\
&\quad u = 1 - e^{-\lambda x} \\
&\quad e^{-\lambda x} = 1 - u \\
&\quad x = -\ln(1 - u) / \lambda \\
&\text{Since } (1 - U) \text{ and } U \text{ have the same distribution:} \\
&\quad x = -\ln(u) / \lambda
\end{aligned}
$$

This works perfectly when you can write down $F^{-1}$ in closed form. For the normal distribution, there is no closed-form inverse CDF, so we use other methods (Box-Muller, or numerical approximation).

**Discrete version:** For discrete distributions, build the CDF as a cumulative sum, generate U, and find the first index where the cumulative sum exceeds U. This is how `sample_categorical` works in Lesson 06.

### Rejection Sampling

When you cannot invert the CDF but can evaluate the target PDF up to a constant, rejection sampling works.

$$
\begin{aligned}
&\text{Target distribution: } p(x) \quad (\text{can evaluate, possibly unnormalized}) \\
&\text{Proposal distribution: } q(x) \quad (\text{can sample from}) \\
&\text{Bound: } M \text{ such that } p(x) \leq M \, q(x) \text{ for all } x \\
&\text{Algorithm:} \\
&\quad 1.\ \text{Sample } x \sim q(x) \\
&\quad 2.\ \text{Sample } u \sim \text{Uniform}(0, 1) \\
&\quad 3.\ \text{If } u < p(x) / (M \, q(x)), \text{ accept } x \\
&\quad 4.\ \text{Otherwise, reject and go to step 1} \\
&\text{Acceptance rate} = 1/M \quad \text{(when } p \text{ is normalized)}
\end{aligned}
$$

The tighter the bound M, the higher the acceptance rate. In low dimensions (1-3), rejection sampling works well. In high dimensions, the acceptance rate drops exponentially because most of the proposal volume gets rejected. This is the curse of dimensionality for rejection sampling.

**Example: sampling from a truncated normal.** Use a uniform proposal over the truncated range. The envelope M is the maximum of the normal PDF in that range.

**Example: sampling from a semicircle.** Propose uniformly in the bounding rectangle. Accept if the point falls inside the semicircle. This is how Monte Carlo computes $\pi$: the acceptance rate equals the area ratio $\pi/4$.

### Importance Sampling

Sometimes you do not need samples from the target distribution $p(x)$. You need to estimate an expectation under $p(x)$, and you have samples from a different distribution $q(x)$.

$$
\begin{aligned}
&\text{Goal: estimate } E_p[f(x)] = \int f(x) \, p(x) \, dx \\
&\text{Rewrite:} \\
&\quad E_p[f(x)] = \int f(x) \, \frac{p(x)}{q(x)} \, q(x) \, dx \\
&\quad\phantom{E_p[f(x)]} = E_q[f(x) \, w(x)] \\
&\text{where } w(x) = p(x) / q(x) \text{ are the importance weights.} \\
&\text{Estimator:} \\
&\quad E_p[f(x)] \approx \frac{1}{N} \sum_i f(x_i) \, w(x_i) \quad \text{where } x_i \sim q(x)
\end{aligned}
$$

This is critical in reinforcement learning. In PPO (Proximal Policy Optimization), you collect trajectories under an old policy $\pi_\text{old}$ but want to optimize a new policy $\pi_\text{new}$. The importance weight is $\pi_\text{new}(a \mid s) / \pi_\text{old}(a \mid s)$. PPO clips these weights to prevent the new policy from diverging too far from the old one.

The variance of the importance sampling estimator depends on how similar q is to p. If q is very different from p, a few samples get enormous weights and dominate the estimate. Self-normalized importance sampling divides by the sum of weights to reduce this problem:

$$
E_p[f(x)] \approx \frac{\sum_i w_i \, f(x_i)}{\sum_i w_i}
$$

### Monte Carlo Estimation

Monte Carlo estimation approximates integrals by averaging random samples. The law of large numbers guarantees convergence.

$$
\begin{aligned}
&\text{Goal: estimate } I = \int_D g(x) \, dx \text{ over domain } D \\
&\text{Method:} \\
&\quad 1.\ \text{Sample } x_1, \ldots, x_N \text{ uniformly from } D \\
&\quad 2.\ I \approx \frac{\text{Volume of } D}{N} \sum_i g(x_i) \\
&\text{Error: } O(1 / \sqrt{N}) \quad \text{regardless of dimension}
\end{aligned}
$$

The error rate is dimension-independent. This is why Monte Carlo methods dominate in high dimensions where grid-based integration is impossible.

**Estimating pi:**

$$
\begin{aligned}
&\text{Sample } (x, y) \text{ uniformly from } [-1, 1] \times [-1, 1] \\
&\text{Count how many fall inside the unit circle: } x^2 + y^2 \leq 1 \\
&\pi \approx 4 \cdot \frac{\text{count inside}}{\text{total count}}
\end{aligned}
$$

**Estimating expectations:**

$$
\begin{aligned}
&E[f(X)] \approx \frac{1}{N} \sum_i f(x_i) \quad \text{where } x_i \sim p(x) \\
&\text{The sample mean converges to the true expectation.} \\
&\text{Variance of the estimator} = \text{Var}(f(X)) / N
\end{aligned}
$$

### Markov Chain Monte Carlo (MCMC): Metropolis-Hastings

MCMC constructs a Markov chain whose stationary distribution is the target distribution $p(x)$. After enough steps, samples from the chain are (approximately) samples from $p(x)$.

$$
\begin{aligned}
&\text{Target: } p(x) \quad (\text{known up to a normalizing constant}) \\
&\text{Proposal: } q(x' \mid x) \quad (\text{how to propose the next state given the current state}) \\
&\text{Metropolis-Hastings algorithm:} \\
&\quad 1.\ \text{Start at some } x_0 \\
&\quad 2.\ \text{For } t = 1, 2, \ldots, T: \\
&\qquad \text{a. Propose } x' \sim q(x' \mid x_t) \\
&\qquad \text{b. Compute acceptance ratio:} \\
&\qquad\quad \alpha = \frac{p(x') \, q(x_t \mid x')}{p(x_t) \, q(x' \mid x_t)} \\
&\qquad \text{c. Accept with probability } \min(1, \alpha): \\
&\qquad\quad \text{- If } u < \alpha \ (u \sim \text{Uniform}(0,1)): x_{t+1} = x' \\
&\qquad\quad \text{- Otherwise: } x_{t+1} = x_t \\
&\quad 3.\ \text{Discard first } B \text{ samples (burn-in)} \\
&\quad 4.\ \text{Return remaining samples}
\end{aligned}
$$

For symmetric proposals ($q(x' \mid x) = q(x \mid x')$), the ratio simplifies to $p(x')/p(x)$. This is the original Metropolis algorithm.

**Why it works.** The acceptance rule ensures detailed balance: the probability of being at $x$ and moving to $x'$ equals the probability of being at $x'$ and moving to $x$. Detailed balance implies that $p(x)$ is the stationary distribution of the chain.

**Practical considerations:**
- Burn-in: discard early samples before the chain reaches equilibrium
- Thinning: keep every k-th sample to reduce autocorrelation
- Proposal scale: too small and the chain moves slowly (high acceptance, slow exploration); too large and most proposals are rejected (low acceptance, stuck in place)
- The optimal acceptance rate for a Gaussian proposal in high dimensions is approximately 0.234

### Gibbs Sampling

Gibbs sampling is a special case of MCMC for multivariate distributions. Instead of proposing a move in all dimensions at once, it updates one variable at a time from its conditional distribution.

$$
\begin{aligned}
&\text{Target: } p(x_1, x_2, \ldots, x_d) \\
&\text{Algorithm:} \\
&\quad \text{For each iteration } t: \\
&\qquad \text{Sample } x_1^{t+1} \sim p(x_1 \mid x_2^t, x_3^t, \ldots, x_d^t) \\
&\qquad \text{Sample } x_2^{t+1} \sim p(x_2 \mid x_1^{t+1}, x_3^t, \ldots, x_d^t) \\
&\qquad \ldots \\
&\qquad \text{Sample } x_d^{t+1} \sim p(x_d \mid x_1^{t+1}, x_2^{t+1}, \ldots, x_{d-1}^{t+1})
\end{aligned}
$$

Gibbs sampling requires that you can sample from each conditional distribution $p(x_i \mid x_{-i})$. This is straightforward for many models:
- Bayesian networks: conditionals follow from the graph structure
- Gaussian mixtures: conditionals are Gaussian
- Ising models: each spin's conditional depends only on its neighbors

The acceptance rate is always 1 (every proposal is accepted) because sampling from the exact conditional automatically satisfies detailed balance.

**Limitation.** When variables are highly correlated, Gibbs sampling mixes slowly because updating one variable at a time cannot make large diagonal moves through the distribution.

### Temperature Sampling (Used in LLMs)

Language models output logits $z_1, \ldots, z_V$ for each token in the vocabulary. Softmax converts these to probabilities. Temperature rescales the logits before softmax:

$$
\begin{aligned}
&p_i = \frac{\exp(z_i / T)}{\sum_j \exp(z_j / T)} \\
&T = 1.0: \text{ standard softmax (original distribution)} \\
&T \to 0: \text{ argmax (deterministic, always picks highest logit)} \\
&T \to \infty: \text{ uniform (all tokens equally likely)} \\
&T < 1.0: \text{ sharpens the distribution (more confident, less diverse)} \\
&T > 1.0: \text{ flattens the distribution (less confident, more diverse)}
\end{aligned}
$$

**Why it works.** Dividing logits by $T < 1$ amplifies differences between logits. If $z_1 = 2$ and $z_2 = 1$, dividing by $T = 0.5$ gives $z_1/T = 4$ and $z_2/T = 2$, making the gap larger. After softmax, the highest-logit token gets a much larger share.

**In practice:**
- T = 0.0: greedy decoding, best for factual Q&A
- T = 0.3-0.7: slightly creative, good for code generation
- T = 0.7-1.0: balanced, good for general conversation
- T = 1.0-1.5: creative writing, brainstorming
- T > 1.5: increasingly random, rarely useful

Temperature does not change which tokens are possible. It changes the probability mass allocated to each token.

### Top-k Sampling

Top-k sampling restricts the candidate set to the k tokens with the highest probabilities, then renormalizes and samples from that restricted set.

$$
\begin{aligned}
&\text{Algorithm:} \\
&\quad 1.\ \text{Compute softmax probabilities for all } V \text{ tokens} \\
&\quad 2.\ \text{Sort tokens by probability (descending)} \\
&\quad 3.\ \text{Keep only the top } k \text{ tokens} \\
&\quad 4.\ \text{Renormalize: } p_i' = p_i / \textstyle\sum_{j \in \text{top-}k} p_j \\
&\quad 5.\ \text{Sample from the renormalized distribution} \\
&k = 1: \text{ greedy decoding} \\
&k = V: \text{ no filtering (standard sampling)} \\
&k = 40: \text{ typical setting, removes long tail of unlikely tokens}
\end{aligned}
$$

Top-k prevents the model from selecting extremely unlikely tokens (typos, nonsense) that exist in the long tail of the vocabulary distribution. The problem: k is fixed regardless of context. When the model is confident (one token has 95% probability), k = 40 still allows 39 alternatives. When the model is uncertain (probability is spread across 1000 tokens), k = 40 cuts off plausible options.

### Top-p (Nucleus) Sampling

Top-p sampling dynamically adjusts the candidate set size. Instead of keeping a fixed number of tokens, it keeps the smallest set of tokens whose cumulative probability exceeds p.

$$
\begin{aligned}
&\text{Algorithm:} \\
&\quad 1.\ \text{Compute softmax probabilities for all } V \text{ tokens} \\
&\quad 2.\ \text{Sort tokens by probability (descending)} \\
&\quad 3.\ \text{Find smallest } k \text{ such that sum of top-}k \text{ probabilities} \geq p \\
&\quad 4.\ \text{Keep only those } k \text{ tokens} \\
&\quad 5.\ \text{Renormalize and sample} \\
&p = 0.9: \text{ keeps tokens covering 90\% of probability mass} \\
&p = 1.0: \text{ no filtering} \\
&p = 0.1: \text{ very restrictive, nearly greedy}
\end{aligned}
$$

When the model is confident, nucleus sampling keeps few tokens (maybe 2-3). When the model is uncertain, it keeps many (maybe 200). This adaptive behavior is why nucleus sampling generally produces better text than top-k.

**Common combinations:**
- Temperature 0.7 + top-p 0.9: good general-purpose setting
- Temperature 0.0 (greedy): best for deterministic tasks
- Temperature 1.0 + top-k 50: Fan et al. (2018) original paper setting

Top-k and top-p can be combined. Apply top-k first, then top-p on the remaining set.

### Reparameterization Trick (Used in VAEs)

Variational autoencoders (VAEs) learn by encoding inputs into a distribution in latent space, sampling from that distribution, and decoding the sample back. The problem: you cannot backpropagate through a sampling operation.

$$
\begin{aligned}
&\text{Standard sampling (not differentiable):} \\
&\quad z \sim N(\mu, \sigma^2) \\
&\quad \text{The randomness blocks gradient flow.} \\
&\quad \frac{d}{d\mu}\left[\text{sample from } N(\mu, \sigma^2)\right] = \text{???}
\end{aligned}
$$

The reparameterization trick separates the randomness from the parameters:

$$
\begin{aligned}
&\text{Reparameterized sampling:} \\
&\quad \epsilon \sim N(0, 1) \qquad (\text{fixed random noise, no parameters}) \\
&\quad z = \mu + \sigma \epsilon \quad (\text{deterministic function of parameters}) \\
&\quad \text{Now } z \text{ is a deterministic, differentiable function of } \mu \text{ and } \sigma. \\
&\quad dz/d\mu = 1 \\
&\quad dz/d\sigma = \epsilon \\
&\quad \text{Gradients flow through } \mu \text{ and } \sigma.
\end{aligned}
$$

This works because $N(\mu, \sigma^2)$ has the same distribution as $\mu + \sigma N(0, 1)$. The key insight: move the randomness to a parameter-free source ($\epsilon$), then express the sample as a differentiable transformation of the parameters.

**In the VAE training loop:**
1. Encoder outputs $\mu$ and $\log(\sigma^2)$ for each input
2. Sample $\epsilon \sim N(0, 1)$
3. Compute $z = \mu + \sigma \epsilon$
4. Decode $z$ to reconstruct the input
5. Backpropagate through steps 4, 3, 2, 1 (possible because step 3 is differentiable)

Without the reparameterization trick, VAEs cannot be trained with standard backpropagation. This single insight made VAEs practical.

### Gumbel-Softmax (Differentiable Categorical Sampling)

The reparameterization trick works for continuous distributions (Gaussian). For discrete categorical distributions, we need a different approach. Gumbel-Softmax provides a differentiable approximation to categorical sampling.

**The Gumbel-Max trick (non-differentiable):**

$$
\begin{aligned}
&\text{To sample from a categorical distribution with log-probabilities } \log(p_1), \ldots, \log(p_k): \\
&\quad 1.\ \text{Sample } g_i \sim \text{Gumbel}(0, 1) \text{ for each category} \\
&\qquad (g = -\log(-\log(u)), \text{ where } u \sim \text{Uniform}(0, 1)) \\
&\quad 2.\ \text{Return } \arg\max(\log(p_i) + g_i) \\
&\text{This produces exact categorical samples.}
\end{aligned}
$$

**Gumbel-Softmax (differentiable approximation):**

$$
\begin{aligned}
&\text{Replace the hard argmax with a soft softmax:} \\
&\quad y_i = \frac{\exp((\log(p_i) + g_i) / \tau)}{\sum_j \exp((\log(p_j) + g_j) / \tau)} \\
&\tau \text{ (temperature) controls the approximation:} \\
&\quad \tau \to 0: \text{ approaches a one-hot vector (hard categorical)} \\
&\quad \tau \to \infty: \text{ approaches uniform } (1/k, 1/k, \ldots, 1/k) \\
&\quad \tau = 1.0: \text{ soft approximation}
\end{aligned}
$$

Gumbel-Softmax produces a continuous relaxation of a discrete sample. The output is a probability vector (soft one-hot) instead of a hard one-hot. Gradients flow through the softmax. During the forward pass in training, you can use the "straight-through" estimator: use the hard argmax for the forward pass but the soft Gumbel-Softmax gradients for the backward pass.

**Applications:**
- Discrete latent variables in VAEs
- Neural architecture search (choosing discrete operations)
- Hard attention mechanisms
- Reinforcement learning with discrete actions

### Stratified Sampling

Standard Monte Carlo sampling can leave gaps in the sample space by chance. Stratified sampling forces even coverage by dividing the space into strata and sampling from each.

$$
\begin{aligned}
&\text{Standard Monte Carlo:} \\
&\quad \text{Sample } N \text{ points uniformly from } [0, 1] \\
&\quad \text{Some regions may have clusters, others gaps} \\
&\text{Stratified sampling:} \\
&\quad \text{Divide } [0, 1] \text{ into } N \text{ equal strata: } [0, 1/N), [1/N, 2/N), \ldots, [(N-1)/N, 1) \\
&\quad \text{Sample one point uniformly within each stratum} \\
&\quad x_i = (i + u_i) / N \quad \text{where } u_i \sim \text{Uniform}(0, 1), \ i = 0, \ldots, N-1
\end{aligned}
$$

Stratified sampling always has lower or equal variance compared to standard Monte Carlo:

$$
\begin{aligned}
&\text{Var(stratified)} \leq \text{Var(standard Monte Carlo)} \\
&\text{The improvement is largest when } f(x) \text{ varies smoothly.} \\
&\text{For piecewise-constant functions, stratified sampling is exact.}
\end{aligned}
$$

**Applications:**
- Numerical integration (quasi-Monte Carlo)
- Training data splits (ensuring class balance in each fold)
- Importance sampling with stratification (combining both techniques)
- NeRF (Neural Radiance Fields) uses stratified sampling along camera rays

### Connection to Diffusion Models

Diffusion models generate images through a sampling process. The forward process adds Gaussian noise to an image over T steps until it becomes pure noise. The reverse process learns to denoise, recovering the original image step by step.

$$
\begin{aligned}
&\text{Forward process (known):} \\
&\quad x_t = \sqrt{\alpha_t} \, x_{t-1} + \sqrt{1 - \alpha_t} \, \epsilon \\
&\quad \text{where } \epsilon \sim N(0, I) \\
&\quad \text{After } T \text{ steps: } x_T \sim N(0, I) \quad (\text{pure noise}) \\
&\text{Reverse process (learned):} \\
&\quad x_{t-1} = \frac{1}{\sqrt{\alpha_t}} \left( x_t - \frac{1 - \alpha_t}{\sqrt{1 - \bar{\alpha}_t}} \, \epsilon_\theta(x_t, t) \right) + \sigma_t \, z \\
&\quad \text{where } z \sim N(0, I) \\
&\quad \text{Each denoising step is a sampling step.}
\end{aligned}
$$

The connection to the methods in this lesson:
- Each denoising step uses the reparameterization trick (sample noise, apply deterministic transform)
- The noise schedule {alpha_t} controls a form of temperature annealing
- Training uses Monte Carlo estimation to approximate the ELBO (evidence lower bound)
- Ancestral sampling in diffusion models is a Markov chain (each step depends only on the current state)

The entire image generation process is iterative sampling: start from noise, and at each step, sample a slightly less noisy version conditioned on the learned denoising model.

```figure
monte-carlo-pi
```

## Build It

### Step 1: Uniform and inverse CDF sampling

```python
import math
import random

def sample_uniform(a, b):
    return a + (b - a) * random.random()

def sample_exponential_inverse_cdf(lam):
    u = random.random()
    return -math.log1p(-u) / lam
```

Generate 10,000 exponential samples and verify the mean is $1/\lambda$.

### Step 2: Rejection sampling

```python
def rejection_sample(target_pdf, proposal_sample, proposal_pdf, M):
    while True:
        x = proposal_sample()
        u = random.random()
        if u < target_pdf(x) / (M * proposal_pdf(x)):
            return x
```

Use rejection sampling to draw from a truncated normal distribution. Verify the shape by histogramming the samples.

### Step 3: Importance sampling

```python
def importance_sampling_estimate(f, target_pdf, proposal_pdf, proposal_sample, n):
    total = 0
    for _ in range(n):
        x = proposal_sample()
        w = target_pdf(x) / proposal_pdf(x)
        total += f(x) * w
    return total / n
```

Estimate $E[X^2]$ under a normal distribution using a uniform proposal. Compare to the known answer ($\mu^2 + \sigma^2$).

### Step 4: Monte Carlo estimation of pi

```python
def monte_carlo_pi(n):
    inside = 0
    for _ in range(n):
        x = random.uniform(-1, 1)
        y = random.uniform(-1, 1)
        if x*x + y*y <= 1:
            inside += 1
    return 4 * inside / n
```

### Step 5: Metropolis-Hastings MCMC

```python
def metropolis_hastings(target_log_pdf, proposal_sample, proposal_log_pdf, x0, n_samples, burn_in):
    samples = []
    x = x0
    for i in range(n_samples + burn_in):
        x_new = proposal_sample(x)
        log_alpha = (target_log_pdf(x_new) + proposal_log_pdf(x, x_new)
                     - target_log_pdf(x) - proposal_log_pdf(x_new, x))
        if math.log(random.random()) < log_alpha:
            x = x_new
        if i >= burn_in:
            samples.append(x)
    return samples
```

Sample from a bimodal distribution (mixture of two Gaussians). Visualize the chain's trajectory.

### Step 6: Gibbs sampling

```python
def gibbs_sampling_2d(conditional_x_given_y, conditional_y_given_x, x0, y0, n_samples, burn_in):
    x, y = x0, y0
    samples = []
    for i in range(n_samples + burn_in):
        x = conditional_x_given_y(y)
        y = conditional_y_given_x(x)
        if i >= burn_in:
            samples.append((x, y))
    return samples
```

### Step 7: Temperature sampling

```python
def softmax(logits):
    max_l = max(logits)
    exps = [math.exp(z - max_l) for z in logits]
    total = sum(exps)
    return [e / total for e in exps]

def temperature_sample(logits, temperature):
    if temperature == 0:
        return max(range(len(logits)), key=lambda i: logits[i])
    scaled = [z / temperature for z in logits]
    probs = softmax(scaled)
    return sample_from_probs(probs)
```

Show how temperature changes the output distribution for a set of token logits.

### Step 8: Top-k and top-p sampling

```python
def top_k_sample(logits, k):
    indexed = sorted(enumerate(logits), key=lambda x: -x[1])
    top = indexed[:k]
    top_logits = [l for _, l in top]
    probs = softmax(top_logits)
    idx = sample_from_probs(probs)
    return top[idx][0]

def top_p_sample(logits, p):
    probs = softmax(logits)
    indexed = sorted(enumerate(probs), key=lambda x: -x[1])
    cumsum = 0
    selected = []
    for token_idx, prob in indexed:
        cumsum += prob
        selected.append((token_idx, prob))
        if cumsum >= p:
            break
    sel_probs = [pr for _, pr in selected]
    total = sum(sel_probs)
    sel_probs = [pr / total for pr in sel_probs]
    idx = sample_from_probs(sel_probs)
    return selected[idx][0]
```

### Step 9: Reparameterization trick

```python
def reparam_sample(mu, sigma):
    epsilon = random.gauss(0, 1)
    return mu + sigma * epsilon

def reparam_gradient(mu, sigma, epsilon):
    dz_dmu = 1.0
    dz_dsigma = epsilon
    return dz_dmu, dz_dsigma
```

Demonstrate that gradients flow through the reparameterized sample but not through direct sampling.

### Step 10: Gumbel-Softmax

```python
def gumbel_sample():
    u = random.random()
    return -math.log(-math.log(u))

def gumbel_softmax(logits, temperature):
    gumbels = [z + gumbel_sample() for z in logits]
    return softmax([g / temperature for g in gumbels])
```

Show how decreasing temperature makes the output approach a one-hot vector.

Full implementations with all visualizations are in `code/sampling.py`.

## Use It

With NumPy and SciPy, the production versions:

```python
import numpy as np

rng = np.random.default_rng(42)

exponential_samples = rng.exponential(scale=2.0, size=10000)
print(f"Exponential mean: {exponential_samples.mean():.4f} (expected 2.0)")

from scipy import stats
normal = stats.norm(loc=0, scale=1)
print(f"CDF at 1.96: {normal.cdf(1.96):.4f}")
print(f"Inverse CDF at 0.975: {normal.ppf(0.975):.4f}")

logits = np.array([2.0, 1.0, 0.5, 0.1, -1.0])
temperature = 0.7
scaled = logits / temperature
probs = np.exp(scaled - scaled.max()) / np.exp(scaled - scaled.max()).sum()
token = rng.choice(len(logits), p=probs)
print(f"Sampled token index: {token}")
```

For MCMC at scale, use dedicated libraries:
- PyMC: full Bayesian modeling with NUTS (adaptive HMC)
- emcee: ensemble MCMC sampler
- NumPyro/JAX: GPU-accelerated MCMC

You built these from scratch. Now you know what the library calls are doing.

## Exercises

1. Implement inverse CDF sampling for the Cauchy distribution. The CDF is $F(x) = 0.5 + \arctan(x)/\pi$. Generate 10,000 samples and plot the histogram against the true PDF. Notice the heavy tails (extreme values far from center).

2. Use rejection sampling to generate samples from a Beta(2, 5) distribution using a Uniform(0, 1) proposal. Plot the accepted samples against the true Beta PDF. What is the theoretical acceptance rate?

3. Estimate the integral of $\sin(x)$ from $0$ to $\pi$ using Monte Carlo with 1,000, 10,000, and 100,000 samples. Compare the error at each level. Verify that the error scales as $O(1/\sqrt{N})$.

4. Implement Metropolis-Hastings to sample from a 2D distribution $p(x, y)$ proportional to $\exp(-(x^2 y^2 + x^2 + y^2 - 8x - 8y) / 2)$. Plot the samples and the chain trajectory. Experiment with different proposal standard deviations.

5. Build a complete text generation demo: given a vocabulary of 10 words with logits, generate sequences of 20 tokens using (a) greedy, (b) temperature=0.7, (c) top-k=3, (d) top-p=0.9. Compare the diversity of outputs across 5 runs.

## Key Terms

| Term | What people say | What it actually means |
|------|----------------|----------------------|
| Sampling | "Drawing random values" | Generating values according to a probability distribution. The mechanism behind all generative AI |
| Uniform distribution | "All equally likely" | Every value in $[a, b]$ has equal probability density $1/(b-a)$. The starting point for all sampling methods |
| Inverse CDF | "Probability transform" | $F^{-1}(U)$ converts a uniform sample into a sample from any distribution with known CDF. Exact and efficient |
| Rejection sampling | "Propose and accept/reject" | Generate from a simple proposal, accept with probability proportional to target/proposal ratio. Exact but wastes samples |
| Importance sampling | "Reweight samples" | Estimate expectations under $p(x)$ using samples from $q(x)$ by weighting each sample by $p(x)/q(x)$. Core to PPO in RL |
| Monte Carlo | "Average random samples" | Approximate integrals as sample averages. Error $O(1/\sqrt{N})$ regardless of dimension |
| MCMC | "Random walk that converges" | Construct a Markov chain whose stationary distribution is the target. Metropolis-Hastings is the foundational algorithm |
| Metropolis-Hastings | "Accept uphill, sometimes downhill" | Propose moves, accept based on density ratio. Detailed balance ensures convergence to target distribution |
| Gibbs sampling | "One variable at a time" | Update each variable from its conditional distribution holding others fixed. 100% acceptance rate |
| Temperature | "Confidence knob" | Divides logits by $T$ before softmax. $T<1$ sharpens (more confident), $T>1$ flattens (more diverse) |
| Top-k sampling | "Keep the k best" | Zero out all but the k highest-probability tokens, renormalize, sample. Fixed candidate set size |
| Nucleus sampling (top-p) | "Keep the probable ones" | Keep the smallest set of tokens whose cumulative probability exceeds p. Adaptive candidate set size |
| Reparameterization trick | "Move randomness outside" | Write $z = \mu + \sigma \epsilon$ where $\epsilon \sim N(0,1)$. Makes sampling differentiable. Essential for VAE training |
| Gumbel-Softmax | "Soft categorical sampling" | Differentiable approximation to categorical sampling using Gumbel noise + softmax with temperature |
| Stratified sampling | "Forced coverage" | Divide sample space into strata, sample from each. Always lower variance than naive Monte Carlo |
| Burn-in | "Warm-up period" | Initial MCMC samples discarded before the chain reaches its stationary distribution |
| Detailed balance | "Reversibility condition" | $p(x) \, T(x \to y) = p(y) \, T(y \to x)$. Sufficient condition for $p$ to be the stationary distribution of a Markov chain |
| Diffusion sampling | "Iterative denoising" | Generate data by starting from noise and applying learned denoising steps. Each step is a conditional sampling operation |

## Further Reading

- [Holbrook (2023): The Metropolis-Hastings Algorithm](https://arxiv.org/abs/2304.07010) - detailed tutorial on MCMC foundations
- [Jang, Gu, Poole (2017): Categorical Reparameterization with Gumbel-Softmax](https://arxiv.org/abs/1611.01144) - original Gumbel-Softmax paper
- [Holtzman et al. (2020): The Curious Case of Neural Text Degeneration](https://arxiv.org/abs/1904.09751) - nucleus (top-p) sampling paper
- [Kingma & Welling (2014): Auto-Encoding Variational Bayes](https://arxiv.org/abs/1312.6114) - VAE paper introducing the reparameterization trick
- [Ho, Jain, Abbeel (2020): Denoising Diffusion Probabilistic Models](https://arxiv.org/abs/2006.11239) - DDPM connects sampling to image generation
