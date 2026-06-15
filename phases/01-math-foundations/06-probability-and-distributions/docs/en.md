# Probability and Distributions

> Probability is the language AI uses to express uncertainty.

**Type:** Learn
**Language:** Python
**Prerequisites:** Phase 1, Lessons 01-04
**Time:** ~75 minutes

## Learning Objectives

- Implement PMFs and PDFs from scratch for Bernoulli, categorical, Poisson, uniform, and normal distributions
- Compute expected value, variance, and use the Central Limit Theorem to explain why Gaussians dominate
- Build softmax and log-softmax functions with the numerical stability trick (subtract max logit)
- Calculate cross-entropy loss from logits and connect it to negative log-likelihood

## The Problem

A classifier outputs `[0.03, 0.91, 0.06]`. A language model picks the next word from 50,000 candidates. A diffusion model generates images by sampling from learned distributions. All of these are probability in action.

Every prediction a model makes is a probability distribution. Every loss function measures how far the predicted distribution is from the true one. Every training step adjusts parameters to make one distribution look more like another. Without probability, you cannot read a single ML paper, debug a single model, or understand why your training loss is NaN.

## The Concept

### Events, Sample Spaces, and Probability

The sample space $S$ is the set of all possible outcomes. An event is a subset of the sample space. Probability maps events to numbers between 0 and 1.

$$
\begin{aligned}
&\text{Coin flip:} \\
&\quad S = \{H, T\} \\
&\quad P(H) = 0.5, \quad P(T) = 0.5 \\
\\
&\text{Single die roll:} \\
&\quad S = \{1, 2, 3, 4, 5, 6\} \\
&\quad P(\text{even}) = P(\{2, 4, 6\}) = \tfrac{3}{6} = 0.5
\end{aligned}
$$

Three axioms define all of probability:
1. $P(A) \geq 0$ for any event $A$
2. $P(S) = 1$ (something always happens)
3. $P(A \text{ or } B) = P(A) + P(B)$ when $A$ and $B$ cannot both occur

Everything else (Bayes' theorem, expectations, distributions) follows from these three rules.

### Conditional Probability and Independence

$P(A \mid B)$ is the probability of A given that B happened.

$$
P(A \mid B) = \frac{P(A \text{ and } B)}{P(B)}
$$

$$
\begin{aligned}
\text{Example: deck of cards} \\
P(\text{King} \mid \text{Face card}) &= \frac{P(\text{King and Face card})}{P(\text{Face card})} \\
&= \frac{4/52}{12/52} \\
&= \frac{4}{12} = \frac{1}{3}
\end{aligned}
$$

Two events are independent when knowing one tells you nothing about the other:

$$
\begin{aligned}
\text{Independent:} &\quad P(A \mid B) = P(A) \\
\text{Equivalent to:} &\quad P(A \text{ and } B) = P(A) \cdot P(B)
\end{aligned}
$$

Coin flips are independent. Drawing cards without replacement is not.

### Probability Mass Functions vs Probability Density Functions

Discrete random variables have a probability mass function (PMF). Each outcome has a specific probability that you can read off directly.

$$
\begin{aligned}
&\text{PMF: } P(X = k) \\
\\
&\text{Fair die:} \\
&\quad P(X = 1) = \tfrac{1}{6} \\
&\quad P(X = 2) = \tfrac{1}{6} \\
&\quad \dots \\
&\quad P(X = 6) = \tfrac{1}{6} \\
\\
&\quad \text{Sum of all probabilities} = 1
\end{aligned}
$$

Continuous random variables have a probability density function (PDF). The density at a single point is not a probability. Probability comes from integrating the density over an interval.

$$
\begin{aligned}
&\text{PDF: } f(x) \\
\\
&P(a \leq X \leq b) = \int_a^b f(x)\,dx \\
\\
&f(x) \text{ can be greater than 1 (density, not probability)} \\
&\int_{-\infty}^{+\infty} f(x)\,dx = 1
\end{aligned}
$$

This distinction matters in ML. Classification outputs are PMFs (discrete choices). VAE latent spaces use PDFs (continuous).

### Common Distributions

**Bernoulli:** one trial, two outcomes. Models binary classification.

$$
\begin{aligned}
&P(X = 1) = p \\
&P(X = 0) = 1 - p \\
&\text{Mean} = p, \quad \text{Variance} = p(1-p)
\end{aligned}
$$

**Categorical:** one trial, k outcomes. Models multi-class classification (softmax output).

$$
\begin{aligned}
&P(X = i) = p_i, \quad \text{where } \sum_i p_i = 1 \\
&\text{Example: } P(\text{cat}) = 0.7, \quad P(\text{dog}) = 0.2, \quad P(\text{bird}) = 0.1
\end{aligned}
$$

**Uniform:** all outcomes equally likely. Used for random initialization.

$$
\begin{aligned}
&\text{Discrete: } P(X = k) = \tfrac{1}{n} \text{ for } k \in \{1, \dots, n\} \\
&\text{Continuous: } f(x) = \tfrac{1}{b-a} \text{ for } x \in [a, b]
\end{aligned}
$$

**Normal (Gaussian):** the bell curve. Parameterized by mean ($\mu$) and variance ($\sigma^2$).

$$
f(x) = \frac{1}{\sqrt{2\pi\sigma^2}} \cdot \exp\left(-\frac{(x - \mu)^2}{2\sigma^2}\right)
$$

$$
\begin{aligned}
&\text{Standard normal: } \mu = 0, \; \sigma = 1 \\
&\quad 68\% \text{ of data within } 1\sigma \\
&\quad 95\% \text{ within } 2\sigma \\
&\quad 99.7\% \text{ within } 3\sigma
\end{aligned}
$$

**Poisson:** counts of rare events in a fixed interval. Models event rates.

$$
\begin{aligned}
&P(X = k) = \frac{\lambda^k \cdot e^{-\lambda}}{k!} \\
&\text{Mean} = \lambda, \quad \text{Variance} = \lambda
\end{aligned}
$$

### Expected Value and Variance

Expected value is the weighted average outcome.

$$
\begin{aligned}
\text{Discrete:} &\quad E[X] = \sum_i x_i \cdot P(X = x_i) \\
\text{Continuous:} &\quad E[X] = \int x \cdot f(x)\,dx
\end{aligned}
$$

Variance measures spread around the mean.

$$
\begin{aligned}
&\text{Var}(X) = E[(X - E[X])^2] = E[X^2] - (E[X])^2 \\
&\text{Standard deviation} = \sqrt{\text{Var}(X)}
\end{aligned}
$$

In ML, expected value appears as the loss function (average loss over the data distribution). Variance tells you about model stability. High variance in gradients means noisy training.

### Joint and Marginal Distributions

A joint distribution $P(X, Y)$ describes two random variables together.

Joint PMF example ($X$ = weather, $Y$ = umbrella):

| | $Y=0$ (no umbrella) | $Y=1$ (umbrella) | Marginal $P(X)$ |
|---|---|---|---|
| $X=0$ (sun) | 0.40 | 0.10 | $P(X=0) = 0.50$ |
| $X=1$ (rain) | 0.05 | 0.45 | $P(X=1) = 0.50$ |
| **Marginal $P(Y)$** | $P(Y=0) = 0.45$ | $P(Y=1) = 0.55$ | 1.00 |

The marginal distribution sums out the other variable:

$$
P(X = x) = \sum_{y} P(X = x, Y = y)
$$

The row and column totals in the table above are the marginals.

### Why the Normal Distribution Shows Up Everywhere

The Central Limit Theorem: the sum (or average) of many independent random variables converges to a normal distribution, regardless of the original distribution.

```
Roll 1 die:  uniform distribution (flat)
Average of 2 dice:  triangular (peaked)
Average of 30 dice: nearly perfect bell curve

This works for ANY starting distribution.
```

This is why:
- Measurement errors are approximately normal (many small independent sources)
- Weight initializations in neural networks use normal distributions
- Gradient noise in SGD is approximately normal (sum of many sample gradients)
- The normal distribution is the maximum entropy distribution for a given mean and variance

### Log Probabilities

Raw probabilities cause numerical problems. Multiplying many small probabilities together quickly underflows to zero.

$$
\begin{aligned}
P(\text{sentence}) &= P(\text{word}_1) \cdot P(\text{word}_2) \cdot \dots \cdot P(\text{word}_n) \\
&= 0.01 \cdot 0.003 \cdot 0.02 \cdot \dots \\
&\to 0.0 \quad (\text{underflow after } \sim 30 \text{ terms})
\end{aligned}
$$

Log probabilities fix this. Multiplications become additions.

$$
\begin{aligned}
\log P(\text{sentence}) &= \log P(\text{word}_1) + \log P(\text{word}_2) + \dots + \log P(\text{word}_n) \\
&= -4.6 + -5.8 + -3.9 + \dots \\
&\to \text{finite number (no underflow)}
\end{aligned}
$$

Rules:
- $\log(a \cdot b) = \log(a) + \log(b)$
- log probabilities are always $\leq 0$ (since $0 < P \leq 1$)
- More negative = less likely
- Cross-entropy loss is the negative log probability of the correct class

### Softmax as a Probability Distribution

Neural networks output raw scores (logits). Softmax converts them into a valid probability distribution.

$$
\text{softmax}(z_i) = \frac{\exp(z_i)}{\sum_j \exp(z_j)}
$$

Properties:
- All outputs are in $(0, 1)$
- All outputs sum to 1
- Preserves relative ordering of inputs
- $\exp()$ amplifies differences between logits

The softmax trick: subtract the max logit before exponentiating to prevent overflow.

$$
\begin{aligned}
&z = [100, 101, 102] \\
&\exp(102) = \text{overflow} \\
\\
&z_{\text{shifted}} = z - \max(z) = [-2, -1, 0] \\
&\exp(0) = 1 \quad (\text{safe}) \\
\\
&\text{Same result, no overflow.}
\end{aligned}
$$

Log-softmax combines softmax and log for numerical stability. PyTorch uses this internally for cross-entropy loss.

### Sampling

Sampling means drawing random values from a distribution. In ML:
- Dropout randomly samples which neurons to zero out
- Data augmentation samples random transformations
- Language models sample the next token from the predicted distribution
- Diffusion models sample noise and progressively denoise

Sampling from arbitrary distributions requires techniques like inverse transform sampling, rejection sampling, or the reparameterization trick (used in VAEs).

```figure
gaussian-pdf
```

## Build It

### Step 1: Probability basics

```python
import math
import random

def factorial(n):
    result = 1
    for i in range(2, n + 1):
        result *= i
    return result

def combinations(n, k):
    return factorial(n) // (factorial(k) * factorial(n - k))

def conditional_probability(p_a_and_b, p_b):
    return p_a_and_b / p_b

p_king_given_face = conditional_probability(4/52, 12/52)
print(f"P(King | Face card) = {p_king_given_face:.4f}")
```

### Step 2: PMF and PDF from scratch

```python
def bernoulli_pmf(k, p):
    return p if k == 1 else (1 - p)

def categorical_pmf(k, probs):
    return probs[k]

def poisson_pmf(k, lam):
    return (lam ** k) * math.exp(-lam) / factorial(k)

def uniform_pdf(x, a, b):
    if a <= x <= b:
        return 1.0 / (b - a)
    return 0.0

def normal_pdf(x, mu, sigma):
    coeff = 1.0 / (sigma * math.sqrt(2 * math.pi))
    exponent = -0.5 * ((x - mu) / sigma) ** 2
    return coeff * math.exp(exponent)
```

### Step 3: Expected value and variance

```python
def expected_value(values, probabilities):
    return sum(v * p for v, p in zip(values, probabilities))

def variance(values, probabilities):
    mu = expected_value(values, probabilities)
    return sum(p * (v - mu) ** 2 for v, p in zip(values, probabilities))

die_values = [1, 2, 3, 4, 5, 6]
die_probs = [1/6] * 6
mu = expected_value(die_values, die_probs)
var = variance(die_values, die_probs)
print(f"Die: E[X] = {mu:.4f}, Var(X) = {var:.4f}, SD = {var**0.5:.4f}")
```

### Step 4: Sampling from distributions

```python
def sample_bernoulli(p, n=1):
    return [1 if random.random() < p else 0 for _ in range(n)]

def sample_categorical(probs, n=1):
    cumulative = []
    total = 0
    for p in probs:
        total += p
        cumulative.append(total)
    samples = []
    for _ in range(n):
        r = random.random()
        for i, c in enumerate(cumulative):
            if r <= c:
                samples.append(i)
                break
    return samples

def sample_normal_box_muller(mu, sigma, n=1):
    samples = []
    for _ in range(n):
        u1 = random.random()
        u2 = random.random()
        z = math.sqrt(-2 * math.log(u1)) * math.cos(2 * math.pi * u2)
        samples.append(mu + sigma * z)
    return samples
```

### Step 5: Softmax and log probabilities

```python
def softmax(logits):
    max_logit = max(logits)
    shifted = [z - max_logit for z in logits]
    exps = [math.exp(z) for z in shifted]
    total = sum(exps)
    return [e / total for e in exps]

def log_softmax(logits):
    max_logit = max(logits)
    shifted = [z - max_logit for z in logits]
    log_sum_exp = max_logit + math.log(sum(math.exp(z) for z in shifted))
    return [z - log_sum_exp for z in logits]

def cross_entropy_loss(logits, target_index):
    log_probs = log_softmax(logits)
    return -log_probs[target_index]
```

### Step 6: Central Limit Theorem demonstration

```python
def demonstrate_clt(dist_fn, n_samples, n_averages):
    averages = []
    for _ in range(n_averages):
        samples = [dist_fn() for _ in range(n_samples)]
        averages.append(sum(samples) / len(samples))
    return averages
```

### Step 7: Visualization

```python
import matplotlib.pyplot as plt

xs = [mu + sigma * (i - 500) / 100 for i in range(1001)]
ys = [normal_pdf(x, mu, sigma) for x, mu, sigma in ...]
plt.plot(xs, ys)
```

Full implementations with all visualizations are in `code/probability.py`.

## Use It

With NumPy and SciPy, everything above is one-liners:

```python
import numpy as np
from scipy import stats

normal = stats.norm(loc=0, scale=1)
samples = normal.rvs(size=10000)
print(f"Mean: {np.mean(samples):.4f}, Std: {np.std(samples):.4f}")
print(f"P(X < 1.96) = {normal.cdf(1.96):.4f}")

logits = np.array([2.0, 1.0, 0.1])
from scipy.special import softmax, log_softmax
probs = softmax(logits)
log_probs = log_softmax(logits)
print(f"Softmax: {probs}")
print(f"Log-softmax: {log_probs}")
```

You built these from scratch. Now you know what the library calls are doing.

## Exercises

1. Implement inverse transform sampling for the exponential distribution. Verify by sampling 10,000 values and comparing the histogram to the true PDF.

2. Build a joint distribution table for two loaded dice. Compute the marginal distributions and check whether the dice are independent.

3. Compute the cross-entropy loss for a 5-class classifier that outputs logits `[2.0, 0.5, -1.0, 3.0, 0.1]` when the correct class is index 3. Then verify your answer with PyTorch's `nn.CrossEntropyLoss`.

4. Write a function that takes a list of log probabilities and returns the most likely sequence, the total log probability, and the equivalent raw probability. Test it with a sentence of 50 words where each word has probability 0.01.

## Key Terms

| Term | What people say | What it actually means |
|------|----------------|----------------------|
| Sample space | "All the possibilities" | The set $S$ of every possible outcome of an experiment |
| PMF | "The probability function" | A function that gives the exact probability of each discrete outcome, summing to 1 |
| PDF | "The probability curve" | A density function for continuous variables. Integrate it over an interval to get probability |
| Conditional probability | "Probability given something" | $P(A \mid B) = P(A \text{ and } B) / P(B)$. The foundation of Bayesian thinking and Bayes' theorem |
| Independence | "They don't affect each other" | $P(A \text{ and } B) = P(A) \cdot P(B)$. Knowing one event tells you nothing about the other |
| Expected value | "The average" | The probability-weighted sum of all outcomes. The loss function is an expected value |
| Variance | "How spread out" | The expected squared deviation from the mean. High variance = noisy, unstable estimates |
| Normal distribution | "The bell curve" | $f(x) = (1/\sqrt{2\pi\sigma^2}) \cdot \exp(-(x-\mu)^2/(2\sigma^2))$. Appears everywhere due to the CLT |
| Central Limit Theorem | "Averages become normal" | The mean of many independent samples converges to a normal distribution regardless of the source |
| Joint distribution | "Two variables together" | $P(X, Y)$ describes the probability of every combination of $X$ and $Y$ outcomes |
| Marginal distribution | "Sum out the other variable" | $P(X) = \sum_y P(X, Y)$. Recovers one variable's distribution from the joint |
| Log probability | "Log of the probability" | $\log P(x)$. Turns products into sums, preventing numerical underflow in long sequences |
| Softmax | "Turn scores into probabilities" | $\text{softmax}(z_i) = \exp(z_i) / \sum_j \exp(z_j)$. Maps real-valued logits to a valid probability distribution |
| Cross-entropy | "The loss function" | $-\sum p_{\text{true}} \cdot \log(p_{\text{predicted}})$. Measures how different two distributions are. Lower is better |
| Logits | "Raw model outputs" | Unnormalized scores before softmax. Named after the logistic function |
| Sampling | "Drawing random values" | Generating values according to a probability distribution. How models generate output |

## Further Reading

- [3Blue1Brown: But what is the Central Limit Theorem?](https://www.youtube.com/watch?v=zeJD6dqJ5lo) - visual proof of why averages become normal
- [Stanford CS229 Probability Review](https://cs229.stanford.edu/section/cs229-prob.pdf) - concise reference covering everything here and more
- [The Log-Sum-Exp Trick](https://gregorygundersen.com/blog/2020/02/09/log-sum-exp/) - why numerical stability matters and how to achieve it
