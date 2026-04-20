import numpy as np
import itertools
import time


def make_data(n_samples=400, n_features=8, seed=42):
    rng = np.random.RandomState(seed)
    X = rng.randn(n_samples, n_features)
    y = (
        2.0 * X[:, 0]
        + np.sin(3 * X[:, 1])
        - 0.5 * X[:, 2] ** 2
        + 0.3 * X[:, 3] * X[:, 4]
        + rng.normal(0, 0.3, n_samples)
    )
    split = int(n_samples * 0.6)
    val_split = int(n_samples * 0.8)
    return (
        X[:split], y[:split],
        X[split:val_split], y[split:val_split],
        X[val_split:], y[val_split:],
    )


class SimpleTree:
    def __init__(self, max_depth=3, min_samples_split=5):
        self.max_depth = max_depth
        self.min_samples_split = min_samples_split
        self.root = None

    def fit(self, X, y):
        self.root = self._build(X, y, 0)

    def _build(self, X, y, depth):
        if depth >= self.max_depth or len(y) < self.min_samples_split:
            return {"value": np.mean(y)}

        best_gain = -1
        best_f, best_t = 0, 0
        var_total = np.var(y) * len(y)

        n_features = X.shape[1]
        for f in range(n_features):
            thresholds = np.percentile(X[:, f], np.linspace(10, 90, 10))
            for t in thresholds:
                left = y[X[:, f] <= t]
                right = y[X[:, f] > t]
                if len(left) < 2 or len(right) < 2:
                    continue
                gain = var_total - np.var(left) * len(left) - np.var(right) * len(right)
                if gain > best_gain:
                    best_gain = gain
                    best_f, best_t = f, t

        if best_gain <= 0:
            return {"value": np.mean(y)}

        mask = X[:, best_f] <= best_t
        return {
            "feature": best_f,
            "threshold": best_t,
            "left": self._build(X[mask], y[mask], depth + 1),
            "right": self._build(X[~mask], y[~mask], depth + 1),
        }

    def predict(self, X):
        return np.array([self._predict_one(x, self.root) for x in X])

    def _predict_one(self, x, node):
        if "value" in node:
            return node["value"]
        if x[node["feature"]] <= node["threshold"]:
            return self._predict_one(x, node["left"])
        return self._predict_one(x, node["right"])


class GBMForTuning:
    def __init__(self, n_estimators=50, learning_rate=0.1, max_depth=3,
                 min_samples_split=5, subsample=1.0):
        self.n_estimators = n_estimators
        self.learning_rate = learning_rate
        self.max_depth = max_depth
        self.min_samples_split = min_samples_split
        self.subsample = subsample
        self.trees = []
        self.init_pred = None

    def fit(self, X, y):
        rng = np.random.RandomState(42)
        self.init_pred = np.mean(y)
        pred = np.full(len(y), self.init_pred)

        for _ in range(self.n_estimators):
            residuals = y - pred

            if self.subsample < 1.0:
                n_sub = max(1, int(len(y) * self.subsample))
                idx = rng.choice(len(y), n_sub, replace=False)
                X_sub, r_sub = X[idx], residuals[idx]
            else:
                X_sub, r_sub = X, residuals

            tree = SimpleTree(
                max_depth=self.max_depth,
                min_samples_split=self.min_samples_split,
            )
            tree.fit(X_sub, r_sub)
            pred += self.learning_rate * tree.predict(X)
            self.trees.append(tree)

    def predict(self, X):
        pred = np.full(X.shape[0], self.init_pred)
        for tree in self.trees:
            pred += self.learning_rate * tree.predict(X)
        return pred


def neg_mse(model, X, y):
    pred = model.predict(X)
    return -np.mean((pred - y) ** 2)


def grid_search(param_grid, X_train, y_train, X_val, y_val):
    keys = list(param_grid.keys())
    values = list(param_grid.values())
    best_score = -float("inf")
    best_params = None
    history = []

    for combo in itertools.product(*values):
        params = dict(zip(keys, combo))
        model = GBMForTuning(**params)
        model.fit(X_train, y_train)
        score = neg_mse(model, X_val, y_val)
        history.append((params.copy(), score))

        if score > best_score:
            best_score = score
            best_params = params.copy()

    return best_params, best_score, history


def sample_param(spec, rng):
    if isinstance(spec, list):
        return rng.choice(spec)
    name, low, high = spec[0], spec[1], spec[2]
    if name == "int":
        return rng.randint(low, high + 1)
    if name == "float":
        return rng.uniform(low, high)
    if name == "log_float":
        return np.exp(rng.uniform(np.log(low), np.log(high)))
    return low


def random_search(param_distributions, X_train, y_train, X_val, y_val,
                  n_iter=50, seed=42):
    rng = np.random.RandomState(seed)
    best_score = -float("inf")
    best_params = None
    history = []

    for _ in range(n_iter):
        params = {k: sample_param(v, rng) for k, v in param_distributions.items()}
        int_params = {}
        for k, v in params.items():
            if k in ("n_estimators", "max_depth", "min_samples_split"):
                int_params[k] = int(v)
            else:
                int_params[k] = v

        model = GBMForTuning(**int_params)
        model.fit(X_train, y_train)
        score = neg_mse(model, X_val, y_val)
        history.append((int_params.copy(), score))

        if score > best_score:
            best_score = score
            best_params = int_params.copy()

    return best_params, best_score, history


class SimpleBayesianOptimizer:
    def __init__(self, param_space, n_initial=10, seed=42):
        self.param_space = param_space
        self.n_initial = n_initial
        self.rng = np.random.RandomState(seed)
        self.X_observed = []
        self.y_observed = []
        self.param_names = list(param_space.keys())

    def _sample_random(self):
        return {k: sample_param(v, self.rng) for k, v in self.param_space.items()}

    def _params_to_vec(self, params):
        vec = []
        for k in self.param_names:
            v = params[k]
            spec = self.param_space[k]
            if isinstance(spec, list):
                vec.append(spec.index(v) / max(1, len(spec) - 1))
            elif spec[0] == "log_float":
                vec.append(
                    (np.log(v) - np.log(spec[1])) / (np.log(spec[2]) - np.log(spec[1]))
                )
            else:
                vec.append((v - spec[1]) / max(1e-10, spec[2] - spec[1]))
        return np.array(vec)

    def _rbf_kernel(self, X1, X2, length_scale=0.3):
        dists = np.sum((X1[:, None, :] - X2[None, :, :]) ** 2, axis=2)
        return np.exp(-0.5 * dists / length_scale ** 2)

    def _predict(self, X_new):
        if len(self.X_observed) == 0:
            return np.zeros(len(X_new)), np.ones(len(X_new))

        X_obs = np.array(self.X_observed)
        y_obs = np.array(self.y_observed)
        y_mean = y_obs.mean()
        y_centered = y_obs - y_mean

        K = self._rbf_kernel(X_obs, X_obs) + 1e-4 * np.eye(len(X_obs))
        K_star = self._rbf_kernel(X_new, X_obs)

        try:
            L = np.linalg.cholesky(K)
            alpha = np.linalg.solve(L.T, np.linalg.solve(L, y_centered))
            mu = K_star @ alpha + y_mean
            v = np.linalg.solve(L, K_star.T)
            var = 1.0 - np.sum(v ** 2, axis=0)
            var = np.maximum(var, 1e-6)
        except np.linalg.LinAlgError:
            K_inv = np.linalg.pinv(K)
            mu = K_star @ K_inv @ y_centered + y_mean
            var = np.ones(len(X_new)) * 0.1

        return mu, var

    def _expected_improvement(self, mu, var, best_y):
        sigma = np.sqrt(var)
        z = (mu - best_y) / (sigma + 1e-10)
        ei = sigma * (z * self._norm_cdf(z) + self._norm_pdf(z))
        return ei

    @staticmethod
    def _norm_cdf(x):
        return 0.5 * (1 + np.vectorize(lambda v: np.tanh(v * 0.7978845608))(x))

    @staticmethod
    def _norm_pdf(x):
        return np.exp(-0.5 * x ** 2) / np.sqrt(2 * np.pi)

    def suggest(self):
        if len(self.X_observed) < self.n_initial:
            return self._sample_random()

        n_candidates = 500
        candidates = [self._sample_random() for _ in range(n_candidates)]
        X_cand = np.array([self._params_to_vec(c) for c in candidates])

        mu, var = self._predict(X_cand)
        best_y = max(self.y_observed)
        ei = self._expected_improvement(mu, var, best_y)

        best_idx = np.argmax(ei)
        return candidates[best_idx]

    def observe(self, params, score):
        self.X_observed.append(self._params_to_vec(params))
        self.y_observed.append(score)

    def optimize(self, objective, n_iter=50):
        best_score = -float("inf")
        best_params = None
        history = []

        for i in range(n_iter):
            params = self.suggest()
            score = objective(params)
            self.observe(params, score)
            history.append((params.copy(), score))

            if score > best_score:
                best_score = score
                best_params = params.copy()

        return best_params, best_score, history


def convergence_curve(history):
    best_so_far = -float("inf")
    curve = []
    for _, score in history:
        best_so_far = max(best_so_far, score)
        curve.append(best_so_far)
    return curve


def demo_grid_search():
    print("=" * 60)
    print("GRID SEARCH")
    print("=" * 60)

    X_tr, y_tr, X_val, y_val, X_te, y_te = make_data()

    param_grid = {
        "n_estimators": [20, 50, 100],
        "learning_rate": [0.01, 0.05, 0.1, 0.3],
        "max_depth": [2, 3, 5],
    }

    start = time.time()
    best_params, best_score, history = grid_search(param_grid, X_tr, y_tr, X_val, y_val)
    elapsed = time.time() - start

    total_combos = 1
    for v in param_grid.values():
        total_combos *= len(v)

    print(f"  Total combinations: {total_combos}")
    print(f"  Best params: {best_params}")
    print(f"  Best val neg_mse: {best_score:.4f} (MSE = {-best_score:.4f})")
    print(f"  Time: {elapsed:.1f}s")

    model = GBMForTuning(**best_params)
    model.fit(X_tr, y_tr)
    test_mse = -neg_mse(model, X_te, y_te)
    print(f"  Test MSE: {test_mse:.4f}")
    print()


def demo_random_search():
    print("=" * 60)
    print("RANDOM SEARCH")
    print("=" * 60)

    X_tr, y_tr, X_val, y_val, X_te, y_te = make_data()

    param_distributions = {
        "n_estimators": ("int", 10, 200),
        "learning_rate": ("log_float", 0.005, 0.5),
        "max_depth": ("int", 2, 8),
        "min_samples_split": ("int", 2, 20),
        "subsample": ("float", 0.5, 1.0),
    }

    budgets = [10, 25, 50, 100]

    for n_iter in budgets:
        start = time.time()
        best_params, best_score, history = random_search(
            param_distributions, X_tr, y_tr, X_val, y_val, n_iter=n_iter
        )
        elapsed = time.time() - start
        print(f"  n_iter={n_iter:>3d}  best_mse={-best_score:.4f}  time={elapsed:.1f}s")

    print()

    best_params, best_score, _ = random_search(
        param_distributions, X_tr, y_tr, X_val, y_val, n_iter=100
    )
    print(f"  Best params (100 trials):")
    for k, v in best_params.items():
        if isinstance(v, float):
            print(f"    {k}: {v:.4f}")
        else:
            print(f"    {k}: {v}")

    model = GBMForTuning(**best_params)
    model.fit(X_tr, y_tr)
    test_mse = -neg_mse(model, X_te, y_te)
    print(f"  Test MSE: {test_mse:.4f}")
    print()


def demo_bayesian():
    print("=" * 60)
    print("BAYESIAN OPTIMIZATION")
    print("=" * 60)

    X_tr, y_tr, X_val, y_val, X_te, y_te = make_data()

    param_space = {
        "n_estimators": ("int", 10, 200),
        "learning_rate": ("log_float", 0.005, 0.5),
        "max_depth": ("int", 2, 8),
        "min_samples_split": ("int", 2, 20),
        "subsample": ("float", 0.5, 1.0),
    }

    def objective(params):
        int_params = {}
        for k, v in params.items():
            if k in ("n_estimators", "max_depth", "min_samples_split"):
                int_params[k] = int(v)
            else:
                int_params[k] = v
        model = GBMForTuning(**int_params)
        model.fit(X_tr, y_tr)
        return neg_mse(model, X_val, y_val)

    optimizer = SimpleBayesianOptimizer(param_space, n_initial=10, seed=42)
    best_params, best_score, history = optimizer.optimize(objective, n_iter=50)

    print(f"  Best params (50 trials):")
    for k, v in best_params.items():
        if isinstance(v, float):
            print(f"    {k}: {v:.4f}")
        else:
            print(f"    {k}: {v}")
    print(f"  Best val MSE: {-best_score:.4f}")

    int_params = {}
    for k, v in best_params.items():
        if k in ("n_estimators", "max_depth", "min_samples_split"):
            int_params[k] = int(v)
        else:
            int_params[k] = v
    model = GBMForTuning(**int_params)
    model.fit(X_tr, y_tr)
    test_mse = -neg_mse(model, X_te, y_te)
    print(f"  Test MSE: {test_mse:.4f}")
    print()


def demo_comparison():
    print("=" * 60)
    print("HEAD-TO-HEAD: GRID vs RANDOM vs BAYESIAN")
    print("=" * 60)

    X_tr, y_tr, X_val, y_val, X_te, y_te = make_data()

    param_grid = {
        "n_estimators": [20, 50, 100],
        "learning_rate": [0.01, 0.05, 0.1, 0.3],
        "max_depth": [2, 3, 5],
    }

    _, grid_score, grid_history = grid_search(param_grid, X_tr, y_tr, X_val, y_val)
    n_grid = len(grid_history)

    param_dist = {
        "n_estimators": ("int", 10, 200),
        "learning_rate": ("log_float", 0.005, 0.5),
        "max_depth": ("int", 2, 8),
    }

    _, rand_score, rand_history = random_search(
        param_dist, X_tr, y_tr, X_val, y_val, n_iter=n_grid
    )

    param_space = {
        "n_estimators": ("int", 10, 200),
        "learning_rate": ("log_float", 0.005, 0.5),
        "max_depth": ("int", 2, 8),
    }

    def objective(params):
        int_params = {k: int(v) if k in ("n_estimators", "max_depth") else v
                      for k, v in params.items()}
        model = GBMForTuning(**int_params)
        model.fit(X_tr, y_tr)
        return neg_mse(model, X_val, y_val)

    optimizer = SimpleBayesianOptimizer(param_space, n_initial=10, seed=42)
    _, bayes_score, bayes_history = optimizer.optimize(objective, n_iter=n_grid)

    print(f"  Budget: {n_grid} evaluations each")
    print(f"  Grid search   best MSE: {-grid_score:.4f}")
    print(f"  Random search best MSE: {-rand_score:.4f}")
    print(f"  Bayesian opt  best MSE: {-bayes_score:.4f}")
    print()

    grid_curve = convergence_curve(grid_history)
    rand_curve = convergence_curve(rand_history)
    bayes_curve = convergence_curve(bayes_history)

    checkpoints = [5, 10, 20, n_grid - 1]
    print(f"  {'Eval':>6}  {'Grid MSE':>10}  {'Random MSE':>10}  {'Bayes MSE':>10}")
    print(f"  {'-'*6}  {'-'*10}  {'-'*10}  {'-'*10}")
    for cp in checkpoints:
        if cp < len(grid_curve):
            print(
                f"  {cp+1:>6d}  {-grid_curve[cp]:>10.4f}  "
                f"{-rand_curve[cp]:>10.4f}  {-bayes_curve[cp]:>10.4f}"
            )

    print()
    print("Random search explores the full continuous space (better coverage).")
    print("Bayesian optimization learns from past results (better convergence).")
    print("Grid search is only competitive with few hyperparameters.")
    print()


def demo_optuna():
    print("=" * 60)
    print("OPTUNA (if installed)")
    print("=" * 60)

    try:
        import optuna
        optuna.logging.set_verbosity(optuna.logging.WARNING)
    except ImportError:
        print("  Optuna not installed. Install with: pip install optuna")
        print("  Skipping Optuna demo.")
        print()
        return

    X_tr, y_tr, X_val, y_val, X_te, y_te = make_data()

    def objective(trial):
        lr = trial.suggest_float("learning_rate", 0.005, 0.5, log=True)
        n_est = trial.suggest_int("n_estimators", 10, 200)
        max_depth = trial.suggest_int("max_depth", 2, 8)
        min_split = trial.suggest_int("min_samples_split", 2, 20)
        subsample = trial.suggest_float("subsample", 0.5, 1.0)

        model = GBMForTuning(
            n_estimators=n_est,
            learning_rate=lr,
            max_depth=max_depth,
            min_samples_split=min_split,
            subsample=subsample,
        )
        model.fit(X_tr, y_tr)
        return np.mean((model.predict(X_val) - y_val) ** 2)

    study = optuna.create_study(direction="minimize")
    study.optimize(objective, n_trials=50)

    print(f"  Best params:")
    for k, v in study.best_params.items():
        if isinstance(v, float):
            print(f"    {k}: {v:.4f}")
        else:
            print(f"    {k}: {v}")
    print(f"  Best val MSE: {study.best_value:.4f}")

    best = study.best_params
    model = GBMForTuning(
        n_estimators=best["n_estimators"],
        learning_rate=best["learning_rate"],
        max_depth=best["max_depth"],
        min_samples_split=best["min_samples_split"],
        subsample=best["subsample"],
    )
    model.fit(X_tr, y_tr)
    test_mse = np.mean((model.predict(X_te) - y_te) ** 2)
    print(f"  Test MSE: {test_mse:.4f}")

    try:
        importances = optuna.importance.get_param_importances(study)
        print(f"\n  Hyperparameter importances:")
        for k, v in importances.items():
            bar = "#" * int(v * 40)
            print(f"    {k:>20s}: {v:.3f} {bar}")
    except Exception:
        pass

    print()


if __name__ == "__main__":
    demo_grid_search()
    demo_random_search()
    demo_bayesian()
    demo_comparison()
    demo_optuna()
    print("All tuning demos complete.")
