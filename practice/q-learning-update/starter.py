import numpy as np


def q_learning_update(Q, s, a, r, s_next, done, alpha=0.1, gamma=0.99):
    raise NotImplementedError


def sarsa_update(Q, s, a, r, s_next, a_next, done, alpha=0.1, gamma=0.99):
    raise NotImplementedError


def epsilon_greedy(Q, s, epsilon, rng):
    raise NotImplementedError
