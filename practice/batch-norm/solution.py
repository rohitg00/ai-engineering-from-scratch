import numpy as np


def batchnorm_forward(x, gamma, beta, running_mean, running_var, momentum=0.1, eps=1e-5, training=True):
    if not training:
        x_hat = (x - running_mean) / np.sqrt(running_var + eps)
        return gamma * x_hat + beta, None, running_mean.copy(), running_var.copy()
    mean = np.mean(x, axis=0)
    var = np.mean((x - mean) ** 2, axis=0)
    std_inv = 1.0 / np.sqrt(var + eps)
    x_hat = (x - mean) * std_inv
    out = gamma * x_hat + beta
    new_mean = (1 - momentum) * running_mean + momentum * mean
    new_var = (1 - momentum) * running_var + momentum * var
    cache = (x_hat, std_inv, gamma)
    return out, cache, new_mean, new_var


def batchnorm_backward(grad_output, cache):
    x_hat, std_inv, gamma = cache
    n = grad_output.shape[0]
    dgamma = np.sum(grad_output * x_hat, axis=0)
    dbeta = np.sum(grad_output, axis=0)
    dx_hat = grad_output * gamma
    dx = std_inv / n * (n * dx_hat - np.sum(dx_hat, axis=0) - x_hat * np.sum(dx_hat * x_hat, axis=0))
    return dx, dgamma, dbeta
