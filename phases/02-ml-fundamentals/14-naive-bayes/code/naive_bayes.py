import numpy as np


class MultinomialNB:
    def __init__(self, alpha=1.0):
        self.alpha = alpha
        self.classes_ = None
        self.class_log_prior_ = None
        self.feature_log_prob_ = None

    def fit(self, X, y):
        if np.any(X < 0):
            raise ValueError("MultinomialNB requires non-negative feature values")
        self.classes_ = np.unique(y)
        n_classes = len(self.classes_)
        n_features = X.shape[1]

        self.class_log_prior_ = np.zeros(n_classes)
        self.feature_log_prob_ = np.zeros((n_classes, n_features))

        for i, c in enumerate(self.classes_):
            X_c = X[y == c]
            self.class_log_prior_[i] = np.log(X_c.shape[0] / X.shape[0])
            counts = X_c.sum(axis=0) + self.alpha
            total = counts.sum()
            self.feature_log_prob_[i] = np.log(counts / total)

        return self

    def predict_log_proba(self, X):
        return X @ self.feature_log_prob_.T + self.class_log_prior_

    def predict_proba(self, X):
        log_proba = self.predict_log_proba(X)
        log_proba -= log_proba.max(axis=1, keepdims=True)
        proba = np.exp(log_proba)
        proba /= proba.sum(axis=1, keepdims=True)
        return proba

    def predict(self, X):
        log_proba = self.predict_log_proba(X)
        return self.classes_[np.argmax(log_proba, axis=1)]

    def score(self, X, y):
        return np.mean(self.predict(X) == y)


class GaussianNB:
    def __init__(self, var_smoothing=1e-9):
        self.var_smoothing = var_smoothing
        self.classes_ = None
        self.means_ = None
        self.vars_ = None
        self.priors_ = None

    def fit(self, X, y):
        self.classes_ = np.unique(y)
        n_classes = len(self.classes_)
        n_features = X.shape[1]

        self.means_ = np.zeros((n_classes, n_features))
        self.vars_ = np.zeros((n_classes, n_features))
        self.priors_ = np.zeros(n_classes)

        for i, c in enumerate(self.classes_):
            X_c = X[y == c]
            self.means_[i] = X_c.mean(axis=0)
            self.vars_[i] = X_c.var(axis=0) + self.var_smoothing
            self.priors_[i] = X_c.shape[0] / X.shape[0]

        return self

    def _log_likelihood(self, X):
        n_classes = len(self.classes_)
        n_samples = X.shape[0]
        log_proba = np.zeros((n_samples, n_classes))

        for i in range(n_classes):
            diff = X - self.means_[i]
            log_prob_features = (
                -0.5 * np.log(2 * np.pi * self.vars_[i])
                - 0.5 * (diff ** 2) / self.vars_[i]
            )
            log_proba[:, i] = log_prob_features.sum(axis=1) + np.log(self.priors_[i])

        return log_proba

    def predict(self, X):
        log_proba = self._log_likelihood(X)
        return self.classes_[np.argmax(log_proba, axis=1)]

    def predict_proba(self, X):
        log_proba = self._log_likelihood(X)
        log_proba -= log_proba.max(axis=1, keepdims=True)
        proba = np.exp(log_proba)
        proba /= proba.sum(axis=1, keepdims=True)
        return proba

    def score(self, X, y):
        return np.mean(self.predict(X) == y)


def make_text_data(n_samples=1000, n_features=200, seed=42):
    rng = np.random.RandomState(seed)

    tech_words_weight = np.zeros(n_features)
    tech_words_weight[:40] = rng.uniform(3, 10, 40)
    tech_words_weight[40:80] = rng.uniform(0.5, 2, 40)
    tech_words_weight[80:] = rng.uniform(0.1, 1, 120)

    sports_words_weight = np.zeros(n_features)
    sports_words_weight[:40] = rng.uniform(0.1, 1, 40)
    sports_words_weight[40:80] = rng.uniform(0.5, 2, 40)
    sports_words_weight[80:120] = rng.uniform(3, 10, 40)
    sports_words_weight[120:] = rng.uniform(0.1, 1, 80)

    n_tech = n_samples // 2
    n_sports = n_samples - n_tech

    X_tech = rng.poisson(tech_words_weight, (n_tech, n_features)).astype(float)
    X_sports = rng.poisson(sports_words_weight, (n_sports, n_features)).astype(float)

    X = np.vstack([X_tech, X_sports])
    y = np.array([0] * n_tech + [1] * n_sports)

    shuffle_idx = rng.permutation(n_samples)
    return X[shuffle_idx], y[shuffle_idx]


def make_continuous_data(n_samples=300, seed=42):
    rng = np.random.RandomState(seed)
    n_per_class = n_samples // 3

    class_0 = rng.multivariate_normal(
        [5.0, 3.4, 1.4, 0.2],
        np.diag([0.12, 0.14, 0.03, 0.01]),
        n_per_class,
    )
    class_1 = rng.multivariate_normal(
        [5.9, 2.8, 4.3, 1.3],
        np.diag([0.27, 0.10, 0.22, 0.04]),
        n_per_class,
    )
    class_2 = rng.multivariate_normal(
        [6.6, 3.0, 5.6, 2.0],
        np.diag([0.40, 0.10, 0.30, 0.08]),
        n_per_class,
    )

    X = np.vstack([class_0, class_1, class_2])
    y = np.array([0] * n_per_class + [1] * n_per_class + [2] * n_per_class)

    shuffle_idx = rng.permutation(len(y))
    return X[shuffle_idx], y[shuffle_idx]


def train_test_split(X, y, test_ratio=0.2, seed=42):
    rng = np.random.RandomState(seed)
    n = len(y)
    idx = rng.permutation(n)
    split = int(n * (1 - test_ratio))
    train_idx, test_idx = idx[:split], idx[split:]
    return X[train_idx], X[test_idx], y[train_idx], y[test_idx]


def accuracy(y_true, y_pred):
    return np.mean(y_true == y_pred)


def print_separator(title):
    print(f"\n{'=' * 60}")
    print(f"  {title}")
    print(f"{'=' * 60}\n")


def demo_multinomial():
    print_separator("MULTINOMIAL NAIVE BAYES -- TEXT CLASSIFICATION")

    X, y = make_text_data(n_samples=1200, n_features=200, seed=42)
    X_train, X_test, y_train, y_test = train_test_split(X, y, test_ratio=0.25, seed=42)

    print(f"Training samples: {X_train.shape[0]}")
    print(f"Test samples:     {X_test.shape[0]}")
    print(f"Features (words): {X_train.shape[1]}")
    print(f"Classes:          tech (0), sports (1)")
    print()

    mnb = MultinomialNB(alpha=1.0)
    mnb.fit(X_train, y_train)

    train_acc = mnb.score(X_train, y_train)
    test_acc = mnb.score(X_test, y_test)
    print(f"From-scratch MultinomialNB:")
    print(f"  Train accuracy: {train_acc:.4f}")
    print(f"  Test accuracy:  {test_acc:.4f}")

    proba = mnb.predict_proba(X_test[:5])
    print(f"\nPredicted probabilities (first 5 samples):")
    for i in range(5):
        print(f"  Sample {i}: P(tech)={proba[i, 0]:.4f}, P(sports)={proba[i, 1]:.4f} -> {'tech' if proba[i, 0] > proba[i, 1] else 'sports'}")

    print(f"\nSmoothing (alpha) comparison:")
    for alpha in [0.01, 0.1, 1.0, 5.0, 10.0]:
        model = MultinomialNB(alpha=alpha)
        model.fit(X_train, y_train)
        acc = model.score(X_test, y_test)
        print(f"  alpha={alpha:5.2f} -> test accuracy: {acc:.4f}")


def demo_gaussian():
    print_separator("GAUSSIAN NAIVE BAYES -- CONTINUOUS FEATURES")

    X, y = make_continuous_data(n_samples=450, seed=42)
    X_train, X_test, y_train, y_test = train_test_split(X, y, test_ratio=0.25, seed=42)

    print(f"Training samples: {X_train.shape[0]}")
    print(f"Test samples:     {X_test.shape[0]}")
    print(f"Features:         {X_train.shape[1]}")
    print(f"Classes:          0, 1, 2 (Iris-like)")
    print()

    gnb = GaussianNB()
    gnb.fit(X_train, y_train)

    train_acc = gnb.score(X_train, y_train)
    test_acc = gnb.score(X_test, y_test)
    print(f"From-scratch GaussianNB:")
    print(f"  Train accuracy: {train_acc:.4f}")
    print(f"  Test accuracy:  {test_acc:.4f}")

    print(f"\nLearned parameters:")
    for i, c in enumerate(gnb.classes_):
        print(f"  Class {c}:")
        print(f"    Means: {gnb.means_[i].round(3)}")
        print(f"    Vars:  {gnb.vars_[i].round(4)}")
        print(f"    Prior: {gnb.priors_[i]:.3f}")

    proba = gnb.predict_proba(X_test[:5])
    print(f"\nPredicted probabilities (first 5 samples):")
    for i in range(5):
        pred = gnb.classes_[np.argmax(proba[i])]
        probs_str = ", ".join(f"P({c})={proba[i, j]:.4f}" for j, c in enumerate(gnb.classes_))
        print(f"  Sample {i}: {probs_str} -> class {pred}")


def demo_comparison():
    print_separator("COMPARISON: MULTINOMIAL vs GAUSSIAN")

    print("Task 1: Text data (bag-of-words counts)")
    X, y = make_text_data(n_samples=1000, seed=99)
    X_train, X_test, y_train, y_test = train_test_split(X, y, seed=99)

    mnb = MultinomialNB(alpha=1.0)
    mnb.fit(X_train, y_train)
    mnb_acc = mnb.score(X_test, y_test)

    gnb = GaussianNB()
    gnb.fit(X_train, y_train)
    gnb_acc = gnb.score(X_test, y_test)

    print(f"  MultinomialNB: {mnb_acc:.4f}")
    print(f"  GaussianNB:    {gnb_acc:.4f}")
    print(f"  Winner: {'MultinomialNB' if mnb_acc >= gnb_acc else 'GaussianNB'}")

    print(f"\nTask 2: Continuous features (Iris-like)")
    X, y = make_continuous_data(n_samples=450, seed=99)
    X_train, X_test, y_train, y_test = train_test_split(X, y, seed=99)

    X_train_pos = X_train - X_train.min(axis=0) + 0.01
    X_test_pos = X_test - X_train.min(axis=0) + 0.01

    mnb2 = MultinomialNB(alpha=1.0)
    mnb2.fit(X_train_pos, y_train)
    mnb_acc2 = mnb2.score(X_test_pos, y_test)

    gnb2 = GaussianNB()
    gnb2.fit(X_train, y_train)
    gnb_acc2 = gnb2.score(X_test, y_test)

    print(f"  MultinomialNB: {mnb_acc2:.4f} (shifted to positive)")
    print(f"  GaussianNB:    {gnb_acc2:.4f}")
    print(f"  Winner: {'MultinomialNB' if mnb_acc2 >= gnb_acc2 else 'GaussianNB'}")


def demo_training_size():
    print_separator("NAIVE BAYES vs TRAINING SET SIZE")

    X_full, y_full = make_text_data(n_samples=2000, n_features=200, seed=42)
    X_test_full = X_full[1600:]
    y_test_full = y_full[1600:]

    print(f"{'Train Size':>12} {'Accuracy':>10}")
    print(f"{'-' * 24}")

    for n_train in [20, 50, 100, 200, 500, 1000, 1600]:
        X_train = X_full[:n_train]
        y_train = y_full[:n_train]

        mnb = MultinomialNB(alpha=1.0)
        mnb.fit(X_train, y_train)
        acc = mnb.score(X_test_full, y_test_full)
        print(f"{n_train:>12} {acc:>10.4f}")


def demo_confusion_matrix():
    print_separator("CONFUSION MATRIX AND PER-CLASS METRICS")

    X, y = make_text_data(n_samples=800, seed=42)
    X_train, X_test, y_train, y_test = train_test_split(X, y, seed=42)

    mnb = MultinomialNB(alpha=1.0)
    mnb.fit(X_train, y_train)
    y_pred = mnb.predict(X_test)

    classes = np.unique(y_test)
    n_classes = len(classes)
    cm = np.zeros((n_classes, n_classes), dtype=int)
    for true, pred in zip(y_test, y_pred):
        cm[int(true), int(pred)] += 1

    class_names = ["tech", "sports"]
    print("Confusion Matrix:")
    print(f"{'':>12} {'Pred tech':>12} {'Pred sports':>12}")
    for i, name in enumerate(class_names):
        row = "".join(f"{cm[i, j]:>12}" for j in range(n_classes))
        print(f"{'True ' + name:>12}{row}")

    print(f"\nPer-class metrics:")
    for i, name in enumerate(class_names):
        tp = cm[i, i]
        fp = cm[:, i].sum() - tp
        fn = cm[i, :].sum() - tp
        precision = tp / (tp + fp) if (tp + fp) > 0 else 0
        recall = tp / (tp + fn) if (tp + fn) > 0 else 0
        f1 = 2 * precision * recall / (precision + recall) if (precision + recall) > 0 else 0
        print(f"  {name:>8}: precision={precision:.4f}, recall={recall:.4f}, f1={f1:.4f}")


if __name__ == "__main__":
    demo_multinomial()
    demo_gaussian()
    demo_comparison()
    demo_training_size()
    demo_confusion_matrix()
