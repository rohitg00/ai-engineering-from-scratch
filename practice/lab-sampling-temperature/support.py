import numpy as np

VOCAB = ["the", "cat", "dog", "sat", "ran", "jumped", "on", "mat", "floor", "."]
LOGITS = np.array([3.2, 1.1, 2.8, 0.4, 0.9, 1.5, -0.2, 2.1, 0.7, 0.1])
TEMPERATURES = [round(0.1 * i, 1) for i in range(1, 31)]
TARGET_ENTROPY = 2.0
TOP_P = 0.9
