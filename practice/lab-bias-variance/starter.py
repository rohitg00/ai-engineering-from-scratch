import numpy as np

from support import DEGREES, N_ROUNDS, N_TRAIN, NOISE_STD, X_TEST, fit_polynomial, generate_data, predict_polynomial, true_function


def decompose(predictions, y_true):
    raise NotImplementedError


def expected_test_error(predictions, y_true, noise_std):
    raise NotImplementedError


def sweep_degrees(degrees, n_rounds=N_ROUNDS, n_train=N_TRAIN, noise_std=NOISE_STD, seed=0):
    raise NotImplementedError


def best_degree(results):
    raise NotImplementedError


def crossover_degree(results):
    raise NotImplementedError


def answers():
    raise NotImplementedError
