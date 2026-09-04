import math


def rotation_2d(theta):
    c, s = math.cos(theta), math.sin(theta)
    return [[c, -s], [s, c]]


def rotation_3d_z(theta):
    c, s = math.cos(theta), math.sin(theta)
    return [[c, -s, 0], [s, c, 0], [0, 0, 1]]


def rotation_3d_x(theta):
    c, s = math.cos(theta), math.sin(theta)
    return [[1, 0, 0], [0, c, -s], [0, s, c]]


def rotation_3d_y(theta):
    c, s = math.cos(theta), math.sin(theta)
    return [[c, 0, s], [0, 1, 0], [-s, 0, c]]


def scaling_2d(sx, sy):
    return [[sx, 0], [0, sy]]


def shearing_2d(kx, ky):
    return [[1, kx], [ky, 1]]


def reflection_x():
    return [[1, 0], [0, -1]]


def reflection_y():
    return [[-1, 0], [0, 1]]


def mat_vec_mul(matrix, vector):
    return [
        sum(matrix[i][j] * vector[j] for j in range(len(vector)))
        for i in range(len(matrix))
    ]


def mat_mul(a, b):
    rows_a, cols_b = len(a), len(b[0])
    cols_a = len(a[0])
    return [
        [sum(a[i][k] * b[k][j] for k in range(cols_a)) for j in range(cols_b)]
        for i in range(rows_a)
    ]


def det_2x2(m):
    return m[0][0] * m[1][1] - m[0][1] * m[1][0]


def det_3x3(m):
    return (
        m[0][0] * (m[1][1] * m[2][2] - m[1][2] * m[2][1])
        - m[0][1] * (m[1][0] * m[2][2] - m[1][2] * m[2][0])
        + m[0][2] * (m[1][0] * m[2][1] - m[1][1] * m[2][0])
    )


def eigenvalues_2x2(matrix):
    a, b = matrix[0]
    c, d = matrix[1]
    trace = a + d
    det = a * d - b * c
    discriminant = trace ** 2 - 4 * det
    if discriminant < 0:
        real = trace / 2
        imag = (-discriminant) ** 0.5 / 2
        return (complex(real, imag), complex(real, -imag))
    sqrt_disc = discriminant ** 0.5
    return ((trace + sqrt_disc) / 2, (trace - sqrt_disc) / 2)


def eigenvector_2x2(matrix, eigenvalue):
    a, b = matrix[0]
    c, d = matrix[1]
    if abs(b) > 1e-10:
        v = [b, eigenvalue - a]
    elif abs(c) > 1e-10:
        v = [eigenvalue - d, c]
    else:
        if abs(a - eigenvalue) < 1e-10:
            v = [1, 0]
        else:
            v = [0, 1]
    mag = (v[0] ** 2 + v[1] ** 2) ** 0.5
    return [v[0] / mag, v[1] / mag]


def fmt(v, decimals=4):
    if isinstance(v, list):
        return [round(x, decimals) for x in v]
    return round(v, decimals)


def demo_basic_transformations():
    print("=" * 60)
    print("BASIC TRANSFORMATIONS")
    print("=" * 60)

    point = [1.0, 0.0]
    theta = math.pi / 4

    rotated = mat_vec_mul(rotation_2d(theta), point)
    print(f"\nRotate (1,0) by 45 deg: {fmt(rotated)}")

    scaled = mat_vec_mul(scaling_2d(2, 3), [1.0, 1.0])
    print(f"Scale (1,1) by (2,3): {fmt(scaled)}")

    sheared = mat_vec_mul(shearing_2d(1, 0), [1.0, 1.0])
    print(f"Shear (1,1) kx=1: {fmt(sheared)}")

    reflected = mat_vec_mul(reflection_y(), [2.0, 1.0])
    print(f"Reflect (2,1) across y-axis: {fmt(reflected)}")

    reflected_x = mat_vec_mul(reflection_x(), [2.0, 1.0])
    print(f"Reflect (2,1) across x-axis: {fmt(reflected_x)}")


def demo_unit_square():
    print("\n" + "=" * 60)
    print("TRANSFORMATIONS ON A UNIT SQUARE")
    print("=" * 60)

    square = [[0, 0], [1, 0], [1, 1], [0, 1]]
    labels = ["origin", "right", "top-right", "top"]

    print("\nOriginal square:")
    for label, pt in zip(labels, square):
        print(f"  {label}: {pt}")

    transforms = [
        ("Rotate 45 deg", rotation_2d(math.pi / 4)),
        ("Scale (2, 0.5)", scaling_2d(2, 0.5)),
        ("Shear kx=0.5", shearing_2d(0.5, 0)),
        ("Reflect y-axis", reflection_y()),
    ]

    for name, matrix in transforms:
        print(f"\n{name}:")
        for label, pt in zip(labels, square):
            result = mat_vec_mul(matrix, pt)
            print(f"  {label}: {pt} -> {fmt(result)}")
        print(f"  det = {fmt(det_2x2(matrix))}")


def demo_composition():
    print("\n" + "=" * 60)
    print("COMPOSITION OF TRANSFORMATIONS")
    print("=" * 60)

    R = rotation_2d(math.pi / 2)
    S = scaling_2d(2, 0.5)

    rotate_then_scale = mat_mul(S, R)
    scale_then_rotate = mat_mul(R, S)

    point = [1.0, 0.0]

    result1 = mat_vec_mul(rotate_then_scale, point)
    result2 = mat_vec_mul(scale_then_rotate, point)

    print(f"\nPoint: {point}")
    print(f"Rotate 90 then scale (2, 0.5): {fmt(result1)}")
    print(f"Scale (2, 0.5) then rotate 90: {fmt(result2)}")
    print("Order matters.")

    print(f"\ndet(R) = {fmt(det_2x2(R))}")
    print(f"det(S) = {fmt(det_2x2(S))}")
    print(f"det(S @ R) = {fmt(det_2x2(rotate_then_scale))}")
    print(f"det(S) * det(R) = {fmt(det_2x2(S) * det_2x2(R))}")
    print("Determinant of composition = product of determinants.")


def demo_3d_rotations():
    print("\n" + "=" * 60)
    print("3D ROTATIONS")
    print("=" * 60)

    point = [1.0, 0.0, 0.0]
    theta = math.pi / 2

    rz = mat_vec_mul(rotation_3d_z(theta), point)
    rx = mat_vec_mul(rotation_3d_x(theta), point)
    ry = mat_vec_mul(rotation_3d_y(theta), point)

    print(f"\nPoint: {point}")
    print(f"Rotate 90 around z: {fmt(rz)}")
    print(f"Rotate 90 around x: {fmt(rx)}")
    print(f"Rotate 90 around y: {fmt(ry)}")

    print(f"\ndet(Rz) = {fmt(det_3x3(rotation_3d_z(theta)))}")
    print(f"det(Rx) = {fmt(det_3x3(rotation_3d_x(theta)))}")
    print(f"det(Ry) = {fmt(det_3x3(rotation_3d_y(theta)))}")
    print("All rotation determinants = 1 (volume preserved).")


def demo_eigenvalues_from_scratch():
    print("\n" + "=" * 60)
    print("EIGENVALUES AND EIGENVECTORS (FROM SCRATCH, 2x2)")
    print("=" * 60)

    matrices = [
        ("Symmetric", [[2, 1], [1, 2]]),
        ("Upper triangular", [[3, 1], [0, 2]]),
        ("Scaling", [[3, 0], [0, 5]]),
        ("Rotation 90", [[0, -1], [1, 0]]),
    ]

    for name, A in matrices:
        vals = eigenvalues_2x2(A)
        print(f"\n{name}: {A}")
        print(f"  Eigenvalues: {vals[0]}, {vals[1]}")

        if all(isinstance(v, (int, float)) for v in vals):
            for val in vals:
                vec = eigenvector_2x2(A, val)
                result = mat_vec_mul(A, vec)
                scaled = [val * vec[0], val * vec[1]]
                print(f"  lambda={fmt(val)}, v={fmt(vec)}")
                print(f"    A @ v = {fmt(result)}")
                print(f"    l * v = {fmt(scaled)}")
        else:
            print("  Complex eigenvalues: pure rotation, no real eigenvectors.")


def demo_eigendecomposition():
    print("\n" + "=" * 60)
    print("EIGENDECOMPOSITION (2x2, FROM SCRATCH)")
    print("=" * 60)

    A = [[3, 1], [0, 2]]
    vals = eigenvalues_2x2(A)

    v0 = eigenvector_2x2(A, vals[0])
    v1 = eigenvector_2x2(A, vals[1])

    V = [[v0[0], v1[0]], [v0[1], v1[1]]]
    D = [[vals[0], 0], [0, vals[1]]]

    det_v = det_2x2(V)
    V_inv = [
        [V[1][1] / det_v, -V[0][1] / det_v],
        [-V[1][0] / det_v, V[0][0] / det_v],
    ]

    reconstructed = mat_mul(mat_mul(V, D), V_inv)

    print(f"\nA = {A}")
    print(f"Eigenvalues: {fmt(vals[0])}, {fmt(vals[1])}")
    print(f"V (eigenvectors as columns):")
    for row in V:
        print(f"  {fmt(row)}")
    print(f"D (eigenvalues on diagonal):")
    for row in D:
        print(f"  {fmt(row)}")
    print(f"Reconstructed A = V @ D @ V^-1:")
    for row in reconstructed:
        print(f"  {fmt(row)}")


def demo_determinant_meaning():
    print("\n" + "=" * 60)
    print("DETERMINANT AS VOLUME SCALING FACTOR")
    print("=" * 60)

    cases = [
        ("Rotation 45 deg", rotation_2d(math.pi / 4)),
        ("Scale (2, 3)", scaling_2d(2, 3)),
        ("Shear kx=1", shearing_2d(1, 0)),
        ("Reflect y-axis", reflection_y()),
        ("Singular [[1,2],[2,4]]", [[1, 2], [2, 4]]),
    ]

    print()
    for name, m in cases:
        d = det_2x2(m)
        if d == 0:
            meaning = "space collapses, irreversible"
        elif d < 0:
            meaning = "orientation flipped"
        elif abs(d - 1.0) < 1e-10:
            meaning = "area preserved"
        else:
            meaning = f"area scaled by {abs(d):.1f}x"
        print(f"det({name}) = {fmt(d):>8}  ({meaning})")


def demo_numpy_comparison():
    print("\n" + "=" * 60)
    print("NUMPY COMPARISON")
    print("=" * 60)

    try:
        import numpy as np
    except ImportError:
        print("\nNumPy not installed. Skipping.")
        return

    theta = math.pi / 4
    R = np.array([[math.cos(theta), -math.sin(theta)],
                  [math.sin(theta), math.cos(theta)]])

    point = np.array([1.0, 0.0])
    print(f"\nRotate (1,0) by 45 deg: {R @ point}")

    A = np.array([[2, 1], [1, 2]], dtype=float)
    eigenvalues, eigenvectors = np.linalg.eig(A)
    print(f"\nA = {A.tolist()}")
    print(f"Eigenvalues (numpy): {eigenvalues}")
    print(f"Eigenvectors (numpy, columns):\n{eigenvectors}")

    for i in range(len(eigenvalues)):
        v = eigenvectors[:, i]
        lam = eigenvalues[i]
        print(f"  A @ v{i} = {A @ v}, lambda * v{i} = {lam * v}")

    B = np.array([[3, 1], [0, 2]], dtype=float)
    vals, vecs = np.linalg.eig(B)
    D = np.diag(vals)
    V = vecs
    reconstructed = V @ D @ np.linalg.inv(V)
    print(f"\nEigendecomposition of {B.tolist()}:")
    print(f"  Reconstructed: {reconstructed.tolist()}")

    Rz = np.array(rotation_3d_z(math.pi / 2))
    point_3d = np.array([1.0, 0.0, 0.0])
    print(f"\n3D rotate (1,0,0) 90 deg around z: {np.round(Rz @ point_3d, 4)}")

    cov = np.array([[2.0, 1.0], [1.0, 3.0]])
    vals, vecs = np.linalg.eig(cov)
    print(f"\nCovariance matrix: {cov.tolist()}")
    print(f"Principal components (eigenvectors): columns of\n{vecs}")
    print(f"Variance along each (eigenvalues): {vals}")
    print("PCA picks the eigenvectors with the largest eigenvalues.")


if __name__ == "__main__":
    demo_basic_transformations()
    demo_unit_square()
    demo_composition()
    demo_3d_rotations()
    demo_eigenvalues_from_scratch()
    demo_eigendecomposition()
    demo_determinant_meaning()
    demo_numpy_comparison()
