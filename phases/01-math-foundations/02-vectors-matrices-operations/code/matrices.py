import random


class Vector:
    def __init__(self, data):
        self.data = list(data)
        self.size = len(self.data)

    def __repr__(self):
        return f"Vector({self.data})"

    def __add__(self, other):
        return Vector([a + b for a, b in zip(self.data, other.data)])

    def __sub__(self, other):
        return Vector([a - b for a, b in zip(self.data, other.data)])

    def __mul__(self, scalar):
        return Vector([x * scalar for x in self.data])

    def dot(self, other):
        return sum(a * b for a, b in zip(self.data, other.data))

    def magnitude(self):
        return sum(x ** 2 for x in self.data) ** 0.5

    def normalize(self):
        mag = self.magnitude()
        return Vector([x / mag for x in self.data])


class Matrix:
    def __init__(self, data):
        self.data = [list(row) for row in data]
        self.rows = len(self.data)
        self.cols = len(self.data[0])
        self.shape = (self.rows, self.cols)

    def __repr__(self):
        col_widths = []
        for j in range(self.cols):
            width = max(len(f"{self.data[i][j]:.4f}") for i in range(self.rows))
            col_widths.append(width)
        lines = []
        for i in range(self.rows):
            row_str = "  ".join(
                f"{self.data[i][j]:{col_widths[j]}.4f}" for j in range(self.cols)
            )
            bracket_l = "|" if 0 < i < self.rows - 1 else ("/" if i == 0 else "\\")
            bracket_r = "|" if 0 < i < self.rows - 1 else ("\\" if i == 0 else "/")
            lines.append(f"  {bracket_l} {row_str} {bracket_r}")
        header = f"Matrix {self.rows}x{self.cols}:"
        return header + "\n" + "\n".join(lines)

    def __add__(self, other):
        if isinstance(other, Matrix):
            if other.shape == self.shape:
                return Matrix([
                    [self.data[i][j] + other.data[i][j] for j in range(self.cols)]
                    for i in range(self.rows)
                ])
            if other.rows == 1 and other.cols == self.cols:
                return Matrix([
                    [self.data[i][j] + other.data[0][j] for j in range(self.cols)]
                    for i in range(self.rows)
                ])
            if other.cols == 1 and other.rows == self.rows:
                return Matrix([
                    [self.data[i][j] + other.data[i][0] for j in range(self.cols)]
                    for i in range(self.rows)
                ])
        raise ValueError(f"Cannot add shapes {self.shape} and {other.shape}")

    def __sub__(self, other):
        return Matrix([
            [self.data[i][j] - other.data[i][j] for j in range(self.cols)]
            for i in range(self.rows)
        ])

    def scalar_multiply(self, scalar):
        return Matrix([
            [self.data[i][j] * scalar for j in range(self.cols)]
            for i in range(self.rows)
        ])

    def element_wise_multiply(self, other):
        return Matrix([
            [self.data[i][j] * other.data[i][j] for j in range(self.cols)]
            for i in range(self.rows)
        ])

    def matmul(self, other):
        if self.cols != other.rows:
            raise ValueError(
                f"Cannot multiply shapes {self.shape} and {other.shape}: "
                f"inner dimensions {self.cols} != {other.rows}"
            )
        return Matrix([
            [
                sum(self.data[i][k] * other.data[k][j] for k in range(self.cols))
                for j in range(other.cols)
            ]
            for i in range(self.rows)
        ])

    def __matmul__(self, other):
        return self.matmul(other)

    def transpose(self):
        return Matrix([
            [self.data[j][i] for j in range(self.rows)]
            for i in range(self.cols)
        ])

    @property
    def T(self):
        return self.transpose()

    def determinant(self):
        if self.rows != self.cols:
            raise ValueError("Determinant only defined for square matrices")
        if self.shape == (1, 1):
            return self.data[0][0]
        if self.shape == (2, 2):
            return self.data[0][0] * self.data[1][1] - self.data[0][1] * self.data[1][0]
        det = 0
        for j in range(self.cols):
            minor = Matrix([
                [self.data[i][k] for k in range(self.cols) if k != j]
                for i in range(1, self.rows)
            ])
            det += ((-1) ** j) * self.data[0][j] * minor.determinant()
        return det

    def inverse_2x2(self):
        if self.shape != (2, 2):
            raise ValueError("This method only works for 2x2 matrices")
        det = self.determinant()
        if abs(det) < 1e-10:
            raise ValueError("Matrix is singular, no inverse exists")
        return Matrix([
            [self.data[1][1] / det, -self.data[0][1] / det],
            [-self.data[1][0] / det, self.data[0][0] / det]
        ])

    @staticmethod
    def identity(n):
        return Matrix([
            [1 if i == j else 0 for j in range(n)]
            for i in range(n)
        ])

    @staticmethod
    def zeros(rows, cols):
        return Matrix([[0] * cols for _ in range(rows)])

    @staticmethod
    def random(rows, cols, low=-1.0, high=1.0):
        return Matrix([
            [random.uniform(low, high) for _ in range(cols)]
            for _ in range(rows)
        ])


def relu_matrix(m):
    return Matrix([[max(0, val) for val in row] for row in m.data])


def demo_basic_operations():
    print("=" * 60)
    print("BASIC MATRIX OPERATIONS")
    print("=" * 60)

    A = Matrix([[1, 2], [3, 4]])
    B = Matrix([[5, 6], [7, 8]])

    print("\nA =")
    print(A)
    print("\nB =")
    print(B)

    print("\nA + B =")
    print(A + B)

    print("\nA - B =")
    print(A - B)

    print("\nA * 3 (scalar) =")
    print(A.scalar_multiply(3))

    print("\nA * B (element-wise) =")
    print(A.element_wise_multiply(B))

    print("\nA @ B (matrix multiply) =")
    print(A @ B)

    print("\nA^T =")
    print(A.T)


def demo_determinant_inverse():
    print("\n" + "=" * 60)
    print("DETERMINANT AND INVERSE")
    print("=" * 60)

    A = Matrix([[4, 7], [2, 6]])
    print("\nA =")
    print(A)
    print(f"\ndet(A) = {A.determinant()}")

    A_inv = A.inverse_2x2()
    print("\nA^-1 =")
    print(A_inv)

    print("\nA @ A^-1 (should be identity) =")
    print(A @ A_inv)

    I = Matrix.identity(3)
    print("\nIdentity 3x3 =")
    print(I)


def demo_broadcasting():
    print("\n" + "=" * 60)
    print("BROADCASTING")
    print("=" * 60)

    output = Matrix([[1, 2, 3], [4, 5, 6]])
    bias = Matrix([[10, 20, 30]])

    print("\nOutput =")
    print(output)
    print("\nBias =")
    print(bias)
    print("\nOutput + Bias (broadcast) =")
    print(output + bias)


def demo_neural_network_layer():
    print("\n" + "=" * 60)
    print("NEURAL NETWORK FORWARD PASS")
    print("=" * 60)

    random.seed(42)

    input_size = 3
    hidden_size = 4
    output_size = 2

    x = Matrix([[0.5], [0.8], [0.2]])
    W1 = Matrix.random(hidden_size, input_size)
    b1 = Matrix([[0.0]] * hidden_size)
    W2 = Matrix.random(output_size, hidden_size)
    b2 = Matrix([[0.0]] * output_size)

    print(f"\nInput x: {x.shape}")
    print(f"W1: {W1.shape}")
    print(f"W2: {W2.shape}")

    z1 = (W1 @ x) + b1
    h1 = relu_matrix(z1)
    print(f"\nHidden layer pre-activation z1: {z1.shape}")
    print(z1)
    print(f"\nHidden layer post-ReLU h1: {h1.shape}")
    print(h1)

    z2 = (W2 @ h1) + b2
    print(f"\nOutput z2: {z2.shape}")
    print(z2)

    print("\nThis is a complete 2-layer neural network forward pass.")
    print("Layer 1: (4x3) @ (3x1) + (4x1) -> (4x1) -> ReLU -> (4x1)")
    print("Layer 2: (2x4) @ (4x1) + (2x1) -> (2x1)")


def demo_vectors():
    print("\n" + "=" * 60)
    print("VECTOR OPERATIONS")
    print("=" * 60)

    v = Vector([3, 4])
    w = Vector([1, 2])

    print(f"\nv = {v}")
    print(f"w = {w}")
    print(f"v + w = {v + w}")
    print(f"v - w = {v - w}")
    print(f"v * 2 = {v * 2}")
    print(f"v . w = {v.dot(w)}")
    print(f"|v| = {v.magnitude()}")
    print(f"v normalized = {v.normalize()}")
    print(f"|v normalized| = {v.normalize().magnitude()}")


def demo_weight_matrix_intuition():
    print("\n" + "=" * 60)
    print("WEIGHT MATRIX INTUITION")
    print("=" * 60)

    print("\nA weight matrix transforms input features into output features.")
    print("Each row extracts one pattern from the input.\n")

    W = Matrix([
        [1.0, 0.0, 0.0],
        [0.0, 1.0, 0.0],
        [0.5, 0.5, 0.0],
    ])
    x = Matrix([[0.8], [0.6], [0.1]])

    print("Weight matrix W (3 detectors, 3 inputs):")
    print(W)
    print("\nInput x:")
    print(x)
    print("\nW @ x =")
    result = W @ x
    print(result)
    print("\nRow 0 of W = [1, 0, 0]: copies input feature 0")
    print("Row 1 of W = [0, 1, 0]: copies input feature 1")
    print("Row 2 of W = [0.5, 0.5, 0]: averages features 0 and 1")


if __name__ == "__main__":
    demo_vectors()
    demo_basic_operations()
    demo_determinant_inverse()
    demo_broadcasting()
    demo_weight_matrix_intuition()
    demo_neural_network_layer()
