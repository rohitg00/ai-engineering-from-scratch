import numpy as np

NOISE_STD = 0.5
N_TRAIN = 30
N_ROUNDS = 100
DEGREES = list(range(1, 13))
X_TEST = np.linspace(-2.5, 2.5, 100)


def true_function(x):
    return np.sin(1.5 * x) + 0.5 * x


def generate_data(n_samples=N_TRAIN, noise_std=NOISE_STD, seed=0):
    rng = np.random.default_rng(seed)
    x = rng.uniform(-3.0, 3.0, n_samples)
    y = true_function(x) + rng.normal(0.0, noise_std, n_samples)
    return x, y


def fit_polynomial(x_train, y_train, degree):
    X = np.column_stack([x_train ** d for d in range(degree + 1)])
    return np.linalg.lstsq(X, y_train, rcond=None)[0]


def predict_polynomial(x, w):
    X = np.column_stack([x ** d for d in range(len(w))])
    return X @ w
