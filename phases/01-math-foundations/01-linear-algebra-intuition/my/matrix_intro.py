import numpy as np

np.set_printoptions(suppress=True, precision=4)

# M = [[28, 1500,  2],
#     [45, 8000, 30],
#    [33, 3200,  5]]

M = np.array([[28, 1500, 2], [45, 8000, 30], [33, 3200, 5]])

print(M)
print(M.shape)
print(M.ndim)
print(M[0])
print(M[:, 1])
print(M[:, 1].mean())
print(M[1, 0])

M_T = M.T.copy()
print(M_T)

M_norm_1 = M.astype(float)
M_norm_2 = M.astype(float)
M_norm_1[:, 1] = M_norm_1[:, 1] * 1.1
print(f"M_norm_1: {M_norm_1}")

M_norm_2 = M_norm_2 * [[1, 1.1, 1], [1, 1.1, 1], [1, 1.1, 1]]
print(f"M_norm_2: {M_norm_2}")

D = [[1, 0.95, 1], [1, 0.95, 1], [1, 0.95, 1]]
M_disc = M * D
print(f"матрица со скидками: {M_disc}")

M_2 = np.array([[28, 1700, 5], [45, 8100, 10], [33, 4500, 2]])
M_res = M_2 - M
print(f"дельта M_2 - M: {M_res}")

M_10 = np.random.randint(-100, 1500, size=(10, 3))
w = np.array([0, 1, -50])
print(M_10)
scores_10 = M_10 @ w
print(scores_10)
print(scores_10.shape)
print(scores_10.argmax())
print(scores_10.max())
