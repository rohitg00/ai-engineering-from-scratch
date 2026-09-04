import math
from collections import defaultdict


def bayes(prior, likelihood, false_positive_rate):
    evidence = likelihood * prior + false_positive_rate * (1 - prior)
    posterior = likelihood * prior / evidence
    return posterior


def sequential_bayes(prior, likelihood, false_positive_rate, num_tests):
    current = prior
    for i in range(num_tests):
        current = bayes(current, likelihood, false_positive_rate)
        print(f"  After test {i + 1}: P(sick|positive) = {current:.6f}")
    return current


class NaiveBayes:
    def __init__(self, smoothing=1.0):
        self.smoothing = smoothing
        self.class_counts = defaultdict(int)
        self.word_counts = defaultdict(lambda: defaultdict(int))
        self.class_word_totals = defaultdict(int)
        self.vocab = set()

    def train(self, documents, labels):
        for doc, label in zip(documents, labels):
            self.class_counts[label] += 1
            words = doc.lower().split()
            for word in words:
                self.word_counts[label][word] += 1
                self.class_word_totals[label] += 1
                self.vocab.add(word)

    def _log_prior(self, cls):
        total_docs = sum(self.class_counts.values())
        return math.log(self.class_counts[cls] / total_docs)

    def _log_likelihood(self, word, cls):
        count = self.word_counts[cls].get(word, 0)
        total = self.class_word_totals[cls]
        vocab_size = len(self.vocab)
        return math.log(
            (count + self.smoothing) / (total + self.smoothing * vocab_size)
        )

    def predict(self, document):
        words = document.lower().split()
        best_class = None
        best_score = float("-inf")

        for cls in self.class_counts:
            score = self._log_prior(cls)
            for word in words:
                score += self._log_likelihood(word, cls)
            if score > best_score:
                best_score = score
                best_class = cls

        return best_class

    def predict_proba(self, document):
        words = document.lower().split()
        scores = {}

        for cls in self.class_counts:
            score = self._log_prior(cls)
            for word in words:
                score += self._log_likelihood(word, cls)
            scores[cls] = score

        max_score = max(scores.values())
        exp_scores = {cls: math.exp(s - max_score) for cls, s in scores.items()}
        total = sum(exp_scores.values())
        return {cls: exp_scores[cls] / total for cls in exp_scores}

    def top_words(self, cls, n=10):
        vocab_size = len(self.vocab)
        total = self.class_word_totals[cls]
        probs = {}
        for word in self.vocab:
            count = self.word_counts[cls].get(word, 0)
            probs[word] = (count + self.smoothing) / (
                total + self.smoothing * vocab_size
            )
        return sorted(probs.items(), key=lambda x: x[1], reverse=True)[:n]


def demo_bayes_theorem():
    print("=" * 60)
    print("BAYES' THEOREM: MEDICAL TEST")
    print("=" * 60)

    prior = 0.0001
    likelihood = 0.99
    fpr = 0.01

    posterior = bayes(prior, likelihood, fpr)
    print(f"\n  Disease prevalence (prior):   {prior}")
    print(f"  Test sensitivity (likelihood): {likelihood}")
    print(f"  False positive rate:           {fpr}")
    print(f"  P(sick | positive):            {posterior:.4f} ({posterior*100:.2f}%)")
    print(f"\n  Despite 99% test accuracy, only {posterior*100:.2f}% of positives are truly sick.")

    print(f"\n  Sequential testing (2 positive tests):")
    sequential_bayes(prior, likelihood, fpr, 2)


def demo_spam_filter():
    print("\n" + "=" * 60)
    print("BAYES' THEOREM: SPAM FILTER")
    print("=" * 60)

    p_spam = 0.3
    p_lottery_given_spam = 0.05
    p_lottery_given_ham = 0.001

    p_lottery = p_lottery_given_spam * p_spam + p_lottery_given_ham * (1 - p_spam)
    p_spam_given_lottery = p_lottery_given_spam * p_spam / p_lottery

    print(f"\n  P(spam):                 {p_spam}")
    print(f"  P('lottery' | spam):     {p_lottery_given_spam}")
    print(f"  P('lottery' | not spam): {p_lottery_given_ham}")
    print(f"  P(spam | 'lottery'):     {p_spam_given_lottery:.4f} ({p_spam_given_lottery*100:.1f}%)")


def demo_naive_bayes():
    print("\n" + "=" * 60)
    print("NAIVE BAYES SPAM CLASSIFIER")
    print("=" * 60)

    train_docs = [
        "win free money now",
        "free lottery ticket winner",
        "claim your prize today free",
        "urgent offer free cash",
        "congratulations you won free",
        "meeting tomorrow at noon",
        "project update attached",
        "can we schedule a call",
        "quarterly report review",
        "lunch on thursday sounds good",
        "team standup notes attached",
        "please review the pull request",
    ]

    train_labels = [
        "spam", "spam", "spam", "spam", "spam",
        "ham", "ham", "ham", "ham", "ham", "ham", "ham",
    ]

    classifier = NaiveBayes(smoothing=1.0)
    classifier.train(train_docs, train_labels)

    print(f"\n  Training: {len(train_docs)} documents ({sum(1 for l in train_labels if l == 'spam')} spam, {sum(1 for l in train_labels if l == 'ham')} ham)")
    print(f"  Vocabulary size: {len(classifier.vocab)}")

    test_messages = [
        "free money waiting for you",
        "meeting rescheduled to friday",
        "you won a free prize",
        "please review the attached report",
        "urgent free offer claim now",
        "can we discuss the project update",
    ]

    print("\n  Predictions:")
    for msg in test_messages:
        prediction = classifier.predict(msg)
        proba = classifier.predict_proba(msg)
        confidence = proba[prediction]
        print(f"    '{msg}'")
        print(f"      -> {prediction} (confidence: {confidence:.3f})")

    print("\n  Top 5 spam indicator words:")
    for word, prob in classifier.top_words("spam", 5):
        print(f"    {word}: {prob:.4f}")

    print("\n  Top 5 ham indicator words:")
    for word, prob in classifier.top_words("ham", 5):
        print(f"    {word}: {prob:.4f}")


def demo_mle_vs_map():
    print("\n" + "=" * 60)
    print("MLE vs MAP ESTIMATION")
    print("=" * 60)

    heads = 7
    total = 10

    mle = heads / total
    print(f"\n  Observed: {heads} heads in {total} flips")
    print(f"  MLE estimate: {mle:.4f}")

    alpha = 2
    beta = 2
    map_estimate = (heads + alpha - 1) / (total + alpha + beta - 2)
    print(f"\n  Beta({alpha},{beta}) prior (mild bias toward 0.5)")
    print(f"  MAP estimate: {map_estimate:.4f}")

    alpha = 10
    beta = 10
    map_strong = (heads + alpha - 1) / (total + alpha + beta - 2)
    print(f"\n  Beta({alpha},{beta}) prior (strong bias toward 0.5)")
    print(f"  MAP estimate: {map_strong:.4f}")

    print("\n  Stronger prior pulls the estimate toward 0.5 (prior mean).")
    print("  This is the same effect as L2 regularization pulling weights toward zero.")


def beta_update(alpha, beta_param, successes, failures):
    return alpha + successes, beta_param + failures


def sequential_update_demo():
    print("\n" + "=" * 60)
    print("SEQUENTIAL BAYESIAN UPDATING")
    print("=" * 60)

    alpha, beta_param = 1, 1
    print(f"\n  Starting prior: Beta({alpha}, {beta_param})")
    print(f"  Prior mean: {alpha / (alpha + beta_param):.4f}")

    batches = [
        (7, 3, "Day 1: 7 heads, 3 tails"),
        (5, 5, "Day 2: 5 heads, 5 tails"),
        (3, 7, "Day 3: 3 heads, 7 tails"),
        (6, 4, "Day 4: 6 heads, 4 tails"),
    ]

    for successes, failures, description in batches:
        alpha, beta_param = beta_update(alpha, beta_param, successes, failures)
        mean = alpha / (alpha + beta_param)
        print(f"\n  {description}")
        print(f"  Posterior: Beta({alpha}, {beta_param})")
        print(f"  Posterior mean: {mean:.4f}")
        variance = (alpha * beta_param) / ((alpha + beta_param) ** 2 * (alpha + beta_param + 1))
        std = variance ** 0.5
        print(f"  Posterior std:  {std:.4f}")

    print(f"\n  Final belief after all data: Beta({alpha}, {beta_param})")
    print(f"  Mean = {alpha / (alpha + beta_param):.4f}")

    alpha_batch, beta_batch = 1, 1
    total_s = sum(s for s, _, _ in batches)
    total_f = sum(f for _, f, _ in batches)
    alpha_batch += total_s
    beta_batch += total_f
    print(f"\n  Batch update (all data at once): Beta({alpha_batch}, {beta_batch})")
    print(f"  Mean = {alpha_batch / (alpha_batch + beta_batch):.4f}")
    print(f"  Sequential and batch give the same result: {alpha == alpha_batch and beta_param == beta_batch}")


def ab_test_demo():
    print("\n" + "=" * 60)
    print("BAYESIAN A/B TESTING")
    print("=" * 60)

    import random as rng
    rng.seed(42)

    a_clicks, a_views = 50, 1000
    b_clicks, b_views = 65, 1000

    a_alpha, a_beta = 1 + a_clicks, 1 + (a_views - a_clicks)
    b_alpha, b_beta = 1 + b_clicks, 1 + (b_views - b_clicks)

    print(f"\n  Variant A: {a_clicks}/{a_views} clicks")
    print(f"  Variant B: {b_clicks}/{b_views} clicks")
    print(f"\n  Posterior A: Beta({a_alpha}, {a_beta}), mean = {a_alpha / (a_alpha + a_beta):.4f}")
    print(f"  Posterior B: Beta({b_alpha}, {b_beta}), mean = {b_alpha / (b_alpha + b_beta):.4f}")

    n_samples = 100000
    b_wins = 0
    for _ in range(n_samples):
        sample_a = _beta_sample(a_alpha, a_beta, rng)
        sample_b = _beta_sample(b_alpha, b_beta, rng)
        if sample_b > sample_a:
            b_wins += 1

    p_b_better = b_wins / n_samples
    print(f"\n  Monte Carlo samples: {n_samples}")
    print(f"  P(B > A) = {p_b_better:.4f}")

    if p_b_better > 0.95:
        print("  Decision: Ship variant B")
    elif p_b_better < 0.05:
        print("  Decision: Ship variant A")
    else:
        print("  Decision: Keep collecting data")

    print("\n  Lift estimate:")
    lifts = []
    rng.seed(42)
    for _ in range(n_samples):
        sa = _beta_sample(a_alpha, a_beta, rng)
        sb = _beta_sample(b_alpha, b_beta, rng)
        if sa > 0:
            lifts.append((sb - sa) / sa)
    lifts.sort()
    median_lift = lifts[len(lifts) // 2]
    low = lifts[int(len(lifts) * 0.05)]
    high = lifts[int(len(lifts) * 0.95)]
    print(f"  Median lift: {median_lift:.1%}")
    print(f"  90% credible interval: [{low:.1%}, {high:.1%}]")


def _beta_sample(alpha, beta_param, rng_module):
    x = _gamma_sample(alpha, rng_module)
    y = _gamma_sample(beta_param, rng_module)
    if x + y == 0:
        return 0.5
    return x / (x + y)


def _gamma_sample(shape, rng_module):
    if shape <= 0:
        raise ValueError("Gamma shape parameter must be positive")
    if shape < 1:
        return _gamma_sample(shape + 1, rng_module) * rng_module.random() ** (1.0 / shape)

    d = shape - 1.0 / 3.0
    c = 1.0 / (9.0 * d) ** 0.5

    while True:
        x = rng_module.gauss(0, 1)
        v = (1 + c * x) ** 3
        if v <= 0:
            continue
        u = rng_module.random()
        if u < 1 - 0.0331 * x ** 4:
            return d * v
        if math.log(u) < 0.5 * x ** 2 + d * (1 - v + math.log(v)):
            return d * v


if __name__ == "__main__":
    demo_bayes_theorem()
    demo_spam_filter()
    demo_naive_bayes()
    demo_mle_vs_map()
    sequential_update_demo()
    ab_test_demo()
