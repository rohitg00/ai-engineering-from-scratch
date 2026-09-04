import numpy as np
import warnings
warnings.filterwarnings("ignore")


def make_mixed_data(n_samples=500, seed=42):
    rng = np.random.RandomState(seed)

    age = rng.normal(35, 12, n_samples).clip(18, 80)
    income = rng.lognormal(10.5, 0.8, n_samples)
    score = rng.uniform(300, 850, n_samples)

    cities = np.array(["new_york", "chicago", "la", "houston", "phoenix"])
    city = rng.choice(cities, n_samples)

    plans = np.array(["free", "basic", "premium"])
    plan = rng.choice(plans, n_samples, p=[0.5, 0.3, 0.2])

    mask = rng.random(n_samples) < 0.05
    age_with_missing = age.copy()
    age_with_missing[mask] = np.nan

    mask2 = rng.random(n_samples) < 0.03
    income_with_missing = income.copy()
    income_with_missing[mask2] = np.nan

    boundary = (
        0.01 * (age - 35)
        + 0.00001 * (income - 40000)
        + 0.002 * (score - 600)
        + 0.5 * (plan == "premium").astype(float)
        - 0.3 * (plan == "free").astype(float)
        + rng.normal(0, 0.5, n_samples)
    )
    target = (boundary > 0).astype(int)

    return {
        "age": age_with_missing,
        "income": income_with_missing,
        "score": score,
        "city": city,
        "plan": plan,
        "target": target,
    }


def train_test_split_dict(data, test_ratio=0.2, seed=42):
    rng = np.random.RandomState(seed)
    n = len(data["target"])
    idx = rng.permutation(n)
    split = int(n * (1 - test_ratio))
    train_idx, test_idx = idx[:split], idx[split:]

    train = {k: v[train_idx] for k, v in data.items()}
    test = {k: v[test_idx] for k, v in data.items()}
    return train, test


class MedianImputer:
    def __init__(self):
        self.medians = None

    def fit(self, X):
        self.medians = np.nanmedian(X, axis=0)
        return self

    def transform(self, X):
        X_out = X.copy()
        for col in range(X.shape[1]):
            mask = np.isnan(X_out[:, col])
            X_out[mask, col] = self.medians[col]
        return X_out

    def fit_transform(self, X):
        return self.fit(X).transform(X)


class StandardScaler:
    def __init__(self):
        self.means = None
        self.stds = None

    def fit(self, X):
        self.means = np.nanmean(X, axis=0)
        self.stds = np.nanstd(X, axis=0)
        self.stds[self.stds == 0] = 1.0
        return self

    def transform(self, X):
        return (X - self.means) / self.stds

    def fit_transform(self, X):
        return self.fit(X).transform(X)


class OneHotEncoder:
    def __init__(self, handle_unknown="ignore"):
        self.categories = None
        self.handle_unknown = handle_unknown

    def fit(self, X):
        self.categories = []
        for col in range(X.shape[1]):
            self.categories.append(sorted(set(X[:, col])))
        return self

    def transform(self, X):
        encoded_cols = []
        for col in range(X.shape[1]):
            cats = self.categories[col]
            for cat in cats:
                encoded_cols.append((X[:, col] == cat).astype(float))
        return np.column_stack(encoded_cols) if encoded_cols else np.zeros((X.shape[0], 0))

    def fit_transform(self, X):
        return self.fit(X).transform(X)


class PipelineFromScratch:
    def __init__(self, steps):
        self.steps = steps

    def fit(self, X, y=None):
        X_current = X.copy() if isinstance(X, np.ndarray) else X
        for name, step in self.steps[:-1]:
            X_current = step.fit_transform(X_current)
        name, model = self.steps[-1]
        model.fit(X_current, y)
        return self

    def predict(self, X):
        X_current = X.copy() if isinstance(X, np.ndarray) else X
        for name, step in self.steps[:-1]:
            X_current = step.transform(X_current)
        name, model = self.steps[-1]
        return model.predict(X_current)

    def score(self, X, y):
        pred = self.predict(X)
        return np.mean(pred == y)


class ColumnTransformerScratch:
    def __init__(self, transformers):
        self.transformers = transformers

    def fit(self, data):
        for name, pipeline, columns in self.transformers:
            X_subset = np.column_stack([data[c] for c in columns])
            pipeline.fit(X_subset)
        return self

    def transform(self, data):
        outputs = []
        for name, pipeline, columns in self.transformers:
            X_subset = np.column_stack([data[c] for c in columns])
            outputs.append(pipeline.transform(X_subset))
        return np.hstack(outputs)

    def fit_transform(self, data):
        return self.fit(data).transform(data)


class TransformerPipeline:
    def __init__(self, steps):
        self.steps = steps

    def fit(self, X):
        X_current = X
        for name, step in self.steps:
            X_current = step.fit_transform(X_current)
        return self

    def transform(self, X):
        X_current = X
        for name, step in self.steps:
            X_current = step.transform(X_current)
        return X_current

    def fit_transform(self, X):
        return self.fit(X).transform(X)


class LogisticRegressionSimple:
    def __init__(self, lr=0.01, n_iter=1000):
        self.lr = lr
        self.n_iter = n_iter
        self.weights = None
        self.bias = None

    def _sigmoid(self, z):
        return 1.0 / (1.0 + np.exp(-np.clip(z, -500, 500)))

    def fit(self, X, y):
        n_samples, n_features = X.shape
        self.weights = np.zeros(n_features)
        self.bias = 0.0

        for _ in range(self.n_iter):
            z = X @ self.weights + self.bias
            pred = self._sigmoid(z)
            dw = (1 / n_samples) * X.T @ (pred - y)
            db = (1 / n_samples) * np.sum(pred - y)
            self.weights -= self.lr * dw
            self.bias -= self.lr * db

    def predict(self, X):
        z = X @ self.weights + self.bias
        return (self._sigmoid(z) >= 0.5).astype(int)

    def predict_proba(self, X):
        z = X @ self.weights + self.bias
        p = self._sigmoid(z)
        return np.column_stack([1 - p, p])


class DecisionTreeSimple:
    def __init__(self, max_depth=5):
        self.max_depth = max_depth
        self.root = None

    def fit(self, X, y):
        self.root = self._build(X, y, 0)

    def _gini(self, y):
        if len(y) == 0:
            return 0
        p = np.mean(y)
        return 1 - p ** 2 - (1 - p) ** 2

    def _build(self, X, y, depth):
        if depth >= self.max_depth or len(np.unique(y)) == 1 or len(y) < 4:
            return {"value": round(np.mean(y))}

        best_gain = -1
        best_f, best_t = 0, 0
        gini_parent = self._gini(y) * len(y)

        for f in range(X.shape[1]):
            thresholds = np.percentile(X[:, f], np.linspace(10, 90, 10))
            for t in thresholds:
                left = y[X[:, f] <= t]
                right = y[X[:, f] > t]
                if len(left) < 2 or len(right) < 2:
                    continue
                gain = gini_parent - self._gini(left) * len(left) - self._gini(right) * len(right)
                if gain > best_gain:
                    best_gain = gain
                    best_f, best_t = f, t

        if best_gain <= 0:
            return {"value": round(np.mean(y))}

        mask = X[:, best_f] <= best_t
        return {
            "feature": best_f,
            "threshold": best_t,
            "left": self._build(X[mask], y[mask], depth + 1),
            "right": self._build(X[~mask], y[~mask], depth + 1),
        }

    def predict(self, X):
        return np.array([self._pred(x, self.root) for x in X])

    def _pred(self, x, node):
        if "value" in node:
            return node["value"]
        if x[node["feature"]] <= node["threshold"]:
            return self._pred(x, node["left"])
        return self._pred(x, node["right"])


def cross_validate_pipeline(pipeline_factory, data, n_folds=5, seed=42):
    rng = np.random.RandomState(seed)
    n = len(data["target"])
    idx = rng.permutation(n)
    fold_size = n // n_folds
    scores = []

    for fold in range(n_folds):
        val_start = fold * fold_size
        val_end = val_start + fold_size if fold < n_folds - 1 else n

        val_idx = idx[val_start:val_end]
        train_idx = np.concatenate([idx[:val_start], idx[val_end:]])

        train_data = {k: v[train_idx] for k, v in data.items()}
        val_data = {k: v[val_idx] for k, v in data.items()}

        pipe = pipeline_factory()
        pipe.fit(train_data)
        score = pipe.score(val_data)
        scores.append(score)

    return scores


class FullPipeline:
    def __init__(self, model, numeric_cols, categorical_cols):
        self.model = model
        self.numeric_cols = numeric_cols
        self.categorical_cols = categorical_cols
        self.num_pipeline = TransformerPipeline([
            ("impute", MedianImputer()),
            ("scale", StandardScaler()),
        ])
        self.cat_encoder = OneHotEncoder(handle_unknown="ignore")

    def fit(self, data):
        X_num = np.column_stack([data[c] for c in self.numeric_cols])
        X_cat = np.column_stack([data[c] for c in self.categorical_cols])

        X_num_processed = self.num_pipeline.fit_transform(X_num)
        X_cat_processed = self.cat_encoder.fit_transform(X_cat)

        X = np.hstack([X_num_processed, X_cat_processed])
        y = data["target"]

        self.model.fit(X, y)
        return self

    def predict(self, data):
        X_num = np.column_stack([data[c] for c in self.numeric_cols])
        X_cat = np.column_stack([data[c] for c in self.categorical_cols])

        X_num_processed = self.num_pipeline.transform(X_num)
        X_cat_processed = self.cat_encoder.transform(X_cat)

        X = np.hstack([X_num_processed, X_cat_processed])
        return self.model.predict(X)

    def score(self, data):
        pred = self.predict(data)
        return np.mean(pred == data["target"])


def demo_data_leakage():
    print("=" * 60)
    print("DATA LEAKAGE DEMONSTRATION")
    print("=" * 60)

    rng = np.random.RandomState(42)
    X = rng.randn(200, 5)
    y = (X[:, 0] + 0.5 * X[:, 1] > 0).astype(int)

    scaler_leaky = StandardScaler()
    X_scaled_leaky = scaler_leaky.fit_transform(X)
    X_train_leaky = X_scaled_leaky[:160]
    X_test_leaky = X_scaled_leaky[160:]
    y_train, y_test = y[:160], y[160:]

    model_leaky = LogisticRegressionSimple(lr=0.1, n_iter=500)
    model_leaky.fit(X_train_leaky, y_train)
    acc_leaky = np.mean(model_leaky.predict(X_test_leaky) == y_test)

    X_train = X[:160]
    X_test = X[160:]
    scaler_clean = StandardScaler()
    X_train_clean = scaler_clean.fit_transform(X_train)
    X_test_clean = scaler_clean.transform(X_test)

    model_clean = LogisticRegressionSimple(lr=0.1, n_iter=500)
    model_clean.fit(X_train_clean, y_train)
    acc_clean = np.mean(model_clean.predict(X_test_clean) == y_test)

    print(f"  Leaky (scaler fit on all data):    {acc_leaky:.3f}")
    print(f"  Clean (scaler fit on train only):  {acc_clean:.3f}")
    print(f"  Difference:                        {acc_leaky - acc_clean:+.3f}")
    print()
    print("  On this simple case the difference may be small,")
    print("  but on real data with target encoding or feature")
    print("  selection, leakage can inflate accuracy by 10-30%.")
    print()


def demo_pipeline_from_scratch():
    print("=" * 60)
    print("PIPELINE FROM SCRATCH")
    print("=" * 60)

    rng = np.random.RandomState(42)
    X = rng.randn(300, 5)
    y = (X[:, 0] + 0.5 * X[:, 1] - 0.3 * X[:, 2] > 0).astype(int)

    X_train, X_test = X[:240], X[240:]
    y_train, y_test = y[:240], y[240:]

    pipe = PipelineFromScratch([
        ("scaler", StandardScaler()),
        ("model", LogisticRegressionSimple(lr=0.1, n_iter=500)),
    ])

    pipe.fit(X_train, y_train)
    train_acc = pipe.score(X_train, y_train)
    test_acc = pipe.score(X_test, y_test)

    print(f"  Pipeline (scaler + logistic regression):")
    print(f"  Train accuracy: {train_acc:.3f}")
    print(f"  Test accuracy:  {test_acc:.3f}")
    print()


def demo_full_pipeline():
    print("=" * 60)
    print("FULL PIPELINE WITH MIXED DATA TYPES")
    print("=" * 60)

    data = make_mixed_data(n_samples=500)
    train, test = train_test_split_dict(data)

    pipe = FullPipeline(
        model=DecisionTreeSimple(max_depth=5),
        numeric_cols=["age", "income", "score"],
        categorical_cols=["city", "plan"],
    )

    pipe.fit(train)
    train_acc = pipe.score(train)
    test_acc = pipe.score(test)

    print(f"  Full pipeline (impute + scale + encode + tree):")
    print(f"  Train accuracy: {train_acc:.3f}")
    print(f"  Test accuracy:  {test_acc:.3f}")
    print()


def demo_cross_validation():
    print("=" * 60)
    print("CROSS-VALIDATION WITH PIPELINE")
    print("=" * 60)

    data = make_mixed_data(n_samples=500)

    def make_pipeline():
        return FullPipeline(
            model=DecisionTreeSimple(max_depth=5),
            numeric_cols=["age", "income", "score"],
            categorical_cols=["city", "plan"],
        )

    scores = cross_validate_pipeline(make_pipeline, data, n_folds=5)

    print(f"  5-fold CV scores: {[f'{s:.3f}' for s in scores]}")
    print(f"  Mean: {np.mean(scores):.3f} +/- {np.std(scores):.3f}")
    print()
    print("  Each fold fits the preprocessor on its own training split.")
    print("  No data leakage across folds.")
    print()


def demo_unknown_categories():
    print("=" * 60)
    print("HANDLING UNKNOWN CATEGORIES")
    print("=" * 60)

    train_cats = np.array([["new_york"], ["chicago"], ["la"], ["houston"]])
    encoder = OneHotEncoder(handle_unknown="ignore")
    encoder.fit(train_cats)

    print(f"  Known categories: {encoder.categories[0]}")

    train_encoded = encoder.transform(train_cats)
    print(f"  'new_york' encoded: {train_encoded[0]}")

    unknown = np.array([["seattle"]])
    unknown_encoded = encoder.transform(unknown)
    print(f"  'seattle' (unknown) encoded: {unknown_encoded[0]}")
    print(f"  Unknown category produces zero vector (no crash).")
    print()


def demo_model_comparison():
    print("=" * 60)
    print("MODEL COMPARISON VIA PIPELINE")
    print("=" * 60)

    data = make_mixed_data(n_samples=500)

    models = [
        ("Logistic Regression", lambda: LogisticRegressionSimple(lr=0.05, n_iter=1000)),
        ("Decision Tree d=3", lambda: DecisionTreeSimple(max_depth=3)),
        ("Decision Tree d=5", lambda: DecisionTreeSimple(max_depth=5)),
        ("Decision Tree d=10", lambda: DecisionTreeSimple(max_depth=10)),
    ]

    for name, model_fn in models:
        def make_pipe(m=model_fn):
            return FullPipeline(
                model=m(),
                numeric_cols=["age", "income", "score"],
                categorical_cols=["city", "plan"],
            )

        scores = cross_validate_pipeline(make_pipe, data, n_folds=5)
        print(f"  {name:>25s}:  {np.mean(scores):.3f} +/- {np.std(scores):.3f}")

    print()


def demo_sklearn_pipeline():
    print("=" * 60)
    print("SKLEARN PIPELINE (if installed)")
    print("=" * 60)

    try:
        from sklearn.pipeline import Pipeline as SkPipeline
        from sklearn.compose import ColumnTransformer as SkColumnTransformer
        from sklearn.preprocessing import StandardScaler as SkScaler
        from sklearn.preprocessing import OneHotEncoder as SkOHE
        from sklearn.impute import SimpleImputer
        from sklearn.ensemble import GradientBoostingClassifier
        from sklearn.model_selection import cross_val_score
    except ImportError:
        print("  sklearn not installed, skipping.")
        print()
        return

    data = make_mixed_data(n_samples=500)

    import pandas as pd
    df = pd.DataFrame({
        "age": data["age"],
        "income": data["income"],
        "score": data["score"],
        "city": data["city"],
        "plan": data["plan"],
    })
    y = data["target"]

    numeric_pipe = SkPipeline([
        ("impute", SimpleImputer(strategy="median")),
        ("scale", SkScaler()),
    ])

    cat_pipe = SkPipeline([
        ("impute", SimpleImputer(strategy="most_frequent")),
        ("encode", SkOHE(handle_unknown="ignore", sparse_output=False)),
    ])

    preprocessor = SkColumnTransformer([
        ("num", numeric_pipe, ["age", "income", "score"]),
        ("cat", cat_pipe, ["city", "plan"]),
    ])

    full_pipe = SkPipeline([
        ("preprocess", preprocessor),
        ("model", GradientBoostingClassifier(n_estimators=100, max_depth=3)),
    ])

    scores = cross_val_score(full_pipe, df, y, cv=5, scoring="accuracy")
    print(f"  sklearn GBM pipeline:")
    print(f"  5-fold CV: {scores.mean():.3f} +/- {scores.std():.3f}")
    print(f"  Per fold:  {[f'{s:.3f}' for s in scores]}")
    print()

    full_pipe.fit(df, y)
    print(f"  Pipeline steps: {[name for name, _ in full_pipe.steps]}")
    print(f"  Preprocessor transformers: {[name for name, _, _ in preprocessor.transformers]}")
    print()


def demo_experiment_tracking():
    print("=" * 60)
    print("EXPERIMENT TRACKING (manual log)")
    print("=" * 60)

    data = make_mixed_data(n_samples=500)
    experiments = []

    configs = [
        {"model": "tree", "max_depth": 3},
        {"model": "tree", "max_depth": 5},
        {"model": "tree", "max_depth": 10},
        {"model": "logistic", "lr": 0.01, "n_iter": 500},
        {"model": "logistic", "lr": 0.1, "n_iter": 1000},
    ]

    for i, config in enumerate(configs):
        if config["model"] == "tree":
            model_fn = lambda c=config: DecisionTreeSimple(max_depth=c["max_depth"])
        else:
            model_fn = lambda c=config: LogisticRegressionSimple(lr=c["lr"], n_iter=c["n_iter"])

        def make_pipe(m=model_fn):
            return FullPipeline(
                model=m(),
                numeric_cols=["age", "income", "score"],
                categorical_cols=["city", "plan"],
            )

        scores = cross_validate_pipeline(make_pipe, data, n_folds=5)
        result = {
            "run_id": i + 1,
            "config": config,
            "mean_accuracy": np.mean(scores),
            "std_accuracy": np.std(scores),
        }
        experiments.append(result)

    print(f"  {'Run':>4}  {'Config':>40}  {'Accuracy':>10}  {'Std':>8}")
    print(f"  {'-'*4}  {'-'*40}  {'-'*10}  {'-'*8}")
    for exp in experiments:
        config_str = str(exp["config"])[:40]
        print(
            f"  {exp['run_id']:>4d}  {config_str:>40}  "
            f"{exp['mean_accuracy']:>10.3f}  {exp['std_accuracy']:>8.3f}"
        )

    best = max(experiments, key=lambda e: e["mean_accuracy"])
    print(f"\n  Best run: #{best['run_id']}")
    print(f"  Config: {best['config']}")
    print(f"  Accuracy: {best['mean_accuracy']:.3f} +/- {best['std_accuracy']:.3f}")
    print()


def demo_reproducibility():
    print("=" * 60)
    print("REPRODUCIBILITY CHECK")
    print("=" * 60)

    data = make_mixed_data(n_samples=500, seed=42)

    def make_pipe():
        return FullPipeline(
            model=DecisionTreeSimple(max_depth=5),
            numeric_cols=["age", "income", "score"],
            categorical_cols=["city", "plan"],
        )

    run1 = cross_validate_pipeline(make_pipe, data, n_folds=5, seed=42)
    run2 = cross_validate_pipeline(make_pipe, data, n_folds=5, seed=42)
    run3 = cross_validate_pipeline(make_pipe, data, n_folds=5, seed=99)

    print(f"  Run 1 (seed=42): {[f'{s:.4f}' for s in run1]}")
    print(f"  Run 2 (seed=42): {[f'{s:.4f}' for s in run2]}")
    print(f"  Run 3 (seed=99): {[f'{s:.4f}' for s in run3]}")
    print(f"  Run 1 == Run 2: {all(abs(a-b) < 1e-10 for a,b in zip(run1, run2))}")
    print(f"  Run 1 == Run 3: {all(abs(a-b) < 1e-10 for a,b in zip(run1, run3))}")
    print()
    print("  Same seed, same data, same results. That is reproducibility.")
    print()


if __name__ == "__main__":
    demo_data_leakage()
    demo_pipeline_from_scratch()
    demo_full_pipeline()
    demo_cross_validation()
    demo_unknown_categories()
    demo_model_comparison()
    demo_sklearn_pipeline()
    demo_experiment_tracking()
    demo_reproducibility()
    print("All pipeline demos complete.")
