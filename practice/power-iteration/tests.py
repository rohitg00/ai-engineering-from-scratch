import numpy as np

from practice_check import check, close, equal, fixture, fixtures, true

M_EX = np.array([[4.0, 1.0, 0.0], [1.0, 3.0, 1.0], [0.0, 1.0, 2.0]])


def symmetric_with(eigenvalues, seed):
    rng = np.random.default_rng(seed)
    Q, _ = np.linalg.qr(rng.normal(size=(len(eigenvalues), len(eigenvalues))))
    return Q @ np.diag(eigenvalues) @ Q.T


@check("examples", "fix_sign flips a vector whose largest entry is negative", "Find the entry with the largest absolute value. When it is negative, multiply the whole vector by -1.")
def example_fix_sign(sub):
    close(sub.fix_sign(np.array([0.1, -0.9, 0.3])), [-0.1, 0.9, -0.3], what="the vector after fix_sign")
    close(sub.fix_sign(np.array([0.2, 0.7])), [0.2, 0.7], what="a vector that is already positive")


@check("examples", "top eigenpair of the 3 by 3 example", "The eigenvalue is the Rayleigh quotient v^T M v of the final unit vector. The vector has its largest entry positive.")
def example_power(sub):
    value, vector, iters = sub.power_iteration(M_EX, np.array([0.0, 0.0, -1.0]))
    close(value, 4.732050806909286, rtol=1e-9, what="the eigenvalue")
    close(vector, [0.78866387, 0.57736154, 0.21133613], rtol=0, atol=1e-7, what="the eigenvector")
    equal(int(iters), 26, what="the number of iterations")


@check("examples", "the loop stops at num_iters", "When the vector does not converge, the loop runs num_iters times and returns the current vector.")
def example_max_iters(sub):
    value, vector, iters = sub.power_iteration(M_EX, np.array([1.0, 1.0, 1.0]), num_iters=3)
    close(value, 4.71702331523475, rtol=1e-9, what="the eigenvalue after 3 iterations")
    close(vector, [0.73272722, 0.62549884, 0.26807093], rtol=0, atol=1e-7, what="the vector after 3 iterations")
    equal(int(iters), 3, what="the number of iterations")


@check("properties", "the result satisfies M v = lambda v", "An eigenpair makes M v equal to lambda v. The vector must also have length 1.")
def eigen_equation(sub):
    M = symmetric_with([6.0, 2.0, -1.0, 0.5], seed=0)
    rng = np.random.default_rng(10)
    value, vector, _ = sub.power_iteration(M, rng.normal(size=4))
    close(np.linalg.norm(vector), 1.0, rtol=1e-9, what="the length of the vector")
    close(M @ vector, value * vector, atol=1e-4, what="M v compared with lambda v")
    close(value, 6.0, rtol=1e-8, what="the eigenvalue")


@check("properties", "the eigenvalue matches numpy on random symmetric matrices", "Power iteration finds the eigenvalue with the largest absolute value.")
def matches_eigh(sub):
    rng = np.random.default_rng(1)
    for n in [3, 5, 8]:
        S = rng.normal(size=(n, n))
        M = S + S.T
        values, vectors = np.linalg.eigh(M)
        top = int(np.argmax(np.abs(values)))
        expected = vectors[:, top]
        expected = expected if expected[np.argmax(np.abs(expected))] > 0 else -expected
        value, vector, _ = sub.power_iteration(M, rng.normal(size=n), num_iters=2000)
        close(value, values[top], rtol=1e-6, what=f"the eigenvalue for n = {n}")
        close(vector, expected, atol=1e-3, what=f"the eigenvector for n = {n}")


@check("properties", "the result does not depend on the sign or scale of v0", "The first step divides v0 by its norm. The sign rule then removes the sign of the start vector.")
def start_invariance(sub):
    M = symmetric_with([5.0, 1.5, 1.0], seed=2)
    v0 = np.array([0.3, -0.4, 0.8])
    value_a, vector_a, iters_a = sub.power_iteration(M, v0)
    value_b, vector_b, iters_b = sub.power_iteration(M, -250.0 * v0)
    close(value_b, value_a, rtol=1e-12, what="the eigenvalue from -250 v0")
    close(vector_b, vector_a, atol=1e-12, what="the eigenvector from -250 v0")
    equal(int(iters_b), int(iters_a), what="the number of iterations from -250 v0")


@check("properties", "the inputs are not changed", "A function that writes into its input array breaks the code that calls it.")
def inputs_unchanged(sub):
    M = M_EX.copy()
    v0 = np.array([0.0, 0.0, -1.0])
    v = np.array([0.1, -0.9, 0.3])
    saved_m, saved_v0, saved_v = M.copy(), v0.copy(), v.copy()
    sub.power_iteration(M, v0)
    sub.fix_sign(v)
    close(M, saved_m, rtol=0, atol=0, what="M after the call")
    close(v0, saved_v0, rtol=0, atol=0, what="v0 after the call")
    close(v, saved_v, rtol=0, atol=0, what="the vector given to fix_sign")


@check("edge", "a negative dominant eigenvalue", "When the top eigenvalue is negative, the vector changes sign at every step. Compare the absolute value of the dot product with 1 - tol, and keep the sign of the Rayleigh quotient.")
def negative_dominant(sub):
    value, vector, iters = sub.power_iteration(np.diag([-5.0, 2.0, 1.0]), np.array([1.0, 1.0, 1.0]))
    close(value, -5.0, rtol=1e-9, what="the eigenvalue")
    close(vector, [1.0, 0.0, 0.0], atol=1e-5, what="the eigenvector")
    equal(int(iters), 14, what="the number of iterations")


@check("edge", "the zero matrix", "When the norm of M v is below tol, return 0.0, the current vector with the sign rule, and the iteration count.")
def zero_matrix(sub):
    value, vector, iters = sub.power_iteration(np.zeros((2, 2)), np.array([0.0, -2.0]))
    close(value, 0.0, what="the eigenvalue")
    close(vector, [0.0, 1.0], what="the vector")
    equal(int(iters), 1, what="the number of iterations")


@check("edge", "a 1 by 1 matrix and a tie in fix_sign", "A 1 by 1 matrix converges in one step. In a tie for the largest absolute value, fix_sign uses the first index.")
def tiny_and_tie(sub):
    value, vector, iters = sub.power_iteration(np.array([[3.0]]), np.array([-2.0]))
    close(value, 3.0, what="the eigenvalue")
    close(vector, [1.0], what="the vector")
    equal(int(iters), 1, what="the number of iterations")
    close(sub.fix_sign(np.array([-0.5, 0.5])), [0.5, -0.5], what="fix_sign of [-0.5, 0.5]")
    close(sub.fix_sign(np.array([0.5, -0.5])), [0.5, -0.5], what="fix_sign of [0.5, -0.5]")


@fixture("matrices")
def matrices(ref):
    rng = np.random.default_rng(42)
    for n, scale, num_iters, tol in [(2, 1.0, 200, 1e-10), (4, 3.0, 200, 1e-10), (5, 0.5, 50, 1e-8), (6, 1.0, 500, 1e-12), (3, 100.0, 200, 1e-10), (7, 1.0, 10, 1e-10)]:
        eigenvalues = np.sort(rng.uniform(-1.0, 1.0, size=n))
        eigenvalues[-1] = 2.0 if rng.random() < 0.5 else -2.0
        M = symmetric_with(eigenvalues * scale, seed=int(rng.integers(0, 1000)))
        v0 = rng.normal(size=n) * 5.0
        value, vector, iters = ref.power_iteration(M, v0, num_iters=num_iters, tol=tol)
        yield {"M": M, "v0": v0, "num_iters": num_iters, "tol": tol}, {"value": value, "vector": vector, "iters": int(iters)}


@check("reference", "eigenpairs match the reference on random matrices", "Your eigenvalue, eigenvector and iteration count agree with the reference solution for many sizes, scales and tolerances.")
def reference_power(sub):
    for case, expected in fixtures("matrices"):
        value, vector, iters = sub.power_iteration(case["M"], case["v0"], num_iters=case["num_iters"], tol=case["tol"])
        label = f"n = {case['M'].shape[0]}, num_iters = {case['num_iters']}, tol = {case['tol']}"
        close(value, expected["value"], rtol=1e-8, what=f"the eigenvalue for {label}")
        close(vector, expected["vector"], atol=1e-8, what=f"the eigenvector for {label}")
        true(abs(int(iters) - expected["iters"]) <= 1, f"wrong number of iterations for {label}", expected["iters"], int(iters))
