import numpy as np
from functools import reduce
from itertools import product as iterproduct


class Tensor:
    def __init__(self, data, shape=None):
        if isinstance(data, (list, tuple)):
            self._data, self._shape = self._flatten_nested(data)
        elif isinstance(data, np.ndarray):
            self._data = data.flatten().tolist()
            self._shape = tuple(data.shape)
        else:
            self._data = [data]
            self._shape = ()

        if shape is not None:
            total = reduce(lambda a, b: a * b, shape, 1)
            if total != len(self._data):
                raise ValueError(
                    f"Cannot reshape {len(self._data)} elements into shape {shape}"
                )
            self._shape = tuple(shape)

        self._strides = self._compute_strides(self._shape)

    def _flatten_nested(self, data):
        if not isinstance(data, (list, tuple)):
            return [data], ()
        if len(data) == 0:
            return [], (0,)

        sub_results = [self._flatten_nested(item) for item in data]
        sub_shape = sub_results[0][1]
        for i, (_, s) in enumerate(sub_results):
            if s != sub_shape:
                raise ValueError(
                    f"Inconsistent shapes at index {i}: {s} vs {sub_shape}"
                )

        flat = []
        for sub_data, _ in sub_results:
            flat.extend(sub_data)

        return flat, (len(data),) + sub_shape

    @staticmethod
    def _compute_strides(shape):
        if len(shape) == 0:
            return ()
        strides = [1] * len(shape)
        for i in range(len(shape) - 2, -1, -1):
            strides[i] = strides[i + 1] * shape[i + 1]
        return tuple(strides)

    @property
    def shape(self):
        return self._shape

    @property
    def rank(self):
        return len(self._shape)

    @property
    def size(self):
        return len(self._data)

    @property
    def strides(self):
        return self._strides

    def _flat_index(self, indices):
        if len(indices) != len(self._shape):
            raise IndexError(
                f"Expected {len(self._shape)} indices, got {len(indices)}"
            )
        idx = 0
        for i, (ind, stride) in enumerate(zip(indices, self._strides)):
            if ind < 0 or ind >= self._shape[i]:
                raise IndexError(
                    f"Index {ind} out of range for axis {i} with size {self._shape[i]}"
                )
            idx += ind * stride
        return idx

    def __getitem__(self, indices):
        if not isinstance(indices, tuple):
            indices = (indices,)
        if len(indices) == len(self._shape):
            return self._data[self._flat_index(indices)]
        raise IndexError("Partial indexing not supported in this basic implementation")

    def __setitem__(self, indices, value):
        if not isinstance(indices, tuple):
            indices = (indices,)
        self._data[self._flat_index(indices)] = value

    def reshape(self, new_shape):
        new_shape = list(new_shape)
        neg_idx = -1
        known_product = 1
        for i, s in enumerate(new_shape):
            if s == -1:
                if neg_idx != -1:
                    raise ValueError("Only one dimension can be -1")
                neg_idx = i
            else:
                known_product *= s

        if neg_idx != -1:
            new_shape[neg_idx] = self.size // known_product

        total = reduce(lambda a, b: a * b, new_shape, 1)
        if total != self.size:
            raise ValueError(
                f"Cannot reshape {self.size} elements into shape {tuple(new_shape)}"
            )

        result = Tensor.__new__(Tensor)
        result._data = self._data[:]
        result._shape = tuple(new_shape)
        result._strides = self._compute_strides(result._shape)
        return result

    def squeeze(self, dim=None):
        if dim is not None:
            if self._shape[dim] != 1:
                return self.reshape(self._shape)
            new_shape = list(self._shape)
            new_shape.pop(dim)
            return self.reshape(tuple(new_shape) if new_shape else ())
        new_shape = tuple(s for s in self._shape if s != 1)
        if not new_shape:
            new_shape = ()
        return self.reshape(new_shape)

    def unsqueeze(self, dim):
        if dim < 0:
            dim = len(self._shape) + 1 + dim
        new_shape = list(self._shape)
        new_shape.insert(dim, 1)
        return self.reshape(tuple(new_shape))

    def transpose(self, dim0, dim1):
        perm = list(range(self.rank))
        perm[dim0], perm[dim1] = perm[dim1], perm[dim0]
        return self.permute(perm)

    def permute(self, dims):
        if sorted(dims) != list(range(self.rank)):
            raise ValueError(f"Invalid permutation {dims} for rank {self.rank}")

        new_shape = tuple(self._shape[d] for d in dims)
        result = Tensor.__new__(Tensor)
        result._shape = new_shape
        result._strides = self._compute_strides(new_shape)
        result._data = [0] * self.size

        old_strides = self._strides
        for old_indices in iterproduct(*(range(s) for s in self._shape)):
            new_indices = tuple(old_indices[d] for d in dims)
            old_flat = sum(i * s for i, s in zip(old_indices, old_strides))
            new_flat = sum(
                i * s for i, s in zip(new_indices, result._strides)
            )
            result._data[new_flat] = self._data[old_flat]

        return result

    def flatten(self, start_dim=0, end_dim=-1):
        if end_dim < 0:
            end_dim = self.rank + end_dim
        new_shape = (
            list(self._shape[:start_dim])
            + [reduce(lambda a, b: a * b, self._shape[start_dim:end_dim + 1], 1)]
            + list(self._shape[end_dim + 1:])
        )
        return self.reshape(tuple(new_shape))

    def _elementwise_op(self, other, op):
        if isinstance(other, (int, float)):
            result_data = [op(x, other) for x in self._data]
            return Tensor(result_data, shape=self._shape)
        if not isinstance(other, Tensor):
            raise TypeError(f"Unsupported type {type(other)}")
        if self._shape != other._shape:
            raise ValueError(
                f"Shape mismatch: {self._shape} vs {other._shape}. "
                "Use broadcast() first."
            )
        result_data = [op(a, b) for a, b in zip(self._data, other._data)]
        return Tensor(result_data, shape=self._shape)

    def __add__(self, other):
        return self._elementwise_op(other, lambda a, b: a + b)

    def __mul__(self, other):
        return self._elementwise_op(other, lambda a, b: a * b)

    def __sub__(self, other):
        return self._elementwise_op(other, lambda a, b: a - b)

    def sum(self, axis=None):
        if axis is None:
            return sum(self._data)
        if axis < 0:
            axis = self.rank + axis
        new_shape = list(self._shape)
        axis_size = new_shape.pop(axis)

        result_size = reduce(lambda a, b: a * b, new_shape, 1)
        result_data = [0.0] * result_size
        result_strides = self._compute_strides(tuple(new_shape))

        for indices in iterproduct(*(range(s) for s in self._shape)):
            old_flat = sum(i * s for i, s in zip(indices, self._strides))
            new_indices = indices[:axis] + indices[axis + 1:]
            if new_indices:
                new_flat = sum(
                    i * s for i, s in zip(new_indices, result_strides)
                )
            else:
                new_flat = 0
            result_data[new_flat] += self._data[old_flat]

        if not new_shape:
            return result_data[0]
        return Tensor(result_data, shape=tuple(new_shape))

    def to_list(self):
        if self.rank == 0:
            return self._data[0]
        return self._build_nested(self._data, self._shape, 0)

    def _build_nested(self, data, shape, offset):
        if len(shape) == 1:
            return data[offset:offset + shape[0]]
        result = []
        stride = reduce(lambda a, b: a * b, shape[1:], 1)
        for i in range(shape[0]):
            result.append(self._build_nested(data, shape[1:], offset + i * stride))
        return result

    def __repr__(self):
        return f"Tensor(shape={self._shape}, data={self.to_list()})"

    def to_numpy(self):
        return np.array(self._data).reshape(self._shape)


def demo_basic_tensor():
    print("=" * 60)
    print("BASIC TENSOR OPERATIONS")
    print("=" * 60)

    scalar = Tensor(3.14)
    print(f"Scalar: shape={scalar.shape}, rank={scalar.rank}, value={scalar.to_list()}")

    vector = Tensor([1, 2, 3, 4, 5])
    print(f"Vector: shape={vector.shape}, rank={vector.rank}")

    matrix = Tensor([[1, 2, 3], [4, 5, 6]])
    print(f"Matrix: shape={matrix.shape}, rank={matrix.rank}")
    print(f"  matrix[0, 1] = {matrix[0, 1]}")
    print(f"  matrix[1, 2] = {matrix[1, 2]}")

    tensor_3d = Tensor([[[1, 2], [3, 4]], [[5, 6], [7, 8]]])
    print(f"3D Tensor: shape={tensor_3d.shape}, rank={tensor_3d.rank}")
    print(f"  tensor[1, 0, 1] = {tensor_3d[1, 0, 1]}")

    print(f"\nStrides for shape {matrix.shape}: {matrix.strides}")
    print(f"Strides for shape {tensor_3d.shape}: {tensor_3d.strides}")
    print()


def demo_reshape_operations():
    print("=" * 60)
    print("RESHAPE OPERATIONS")
    print("=" * 60)

    data = Tensor(list(range(12)), shape=(2, 6))
    print(f"Original: shape={data.shape}")
    print(f"  {data.to_list()}")

    r1 = data.reshape((3, 4))
    print(f"\nReshaped to (3, 4): {r1.to_list()}")

    r2 = data.reshape((2, 2, 3))
    print(f"Reshaped to (2, 2, 3): {r2.to_list()}")

    r3 = data.reshape((-1, 3))
    print(f"Reshaped to (-1, 3): shape={r3.shape}, {r3.to_list()}")

    t = Tensor(list(range(6)), shape=(1, 3, 1, 2))
    print(f"\nBefore squeeze: shape={t.shape}")
    s = t.squeeze()
    print(f"After squeeze():  shape={s.shape}")
    s0 = t.squeeze(dim=0)
    print(f"After squeeze(0): shape={s0.shape}")

    v = Tensor([1, 2, 3])
    print(f"\nVector shape: {v.shape}")
    print(f"unsqueeze(0): {v.unsqueeze(0).shape}")
    print(f"unsqueeze(1): {v.unsqueeze(1).shape}")
    print(f"unsqueeze(-1): {v.unsqueeze(-1).shape}")

    mat = Tensor(list(range(6)), shape=(2, 3))
    print(f"\nOriginal: shape={mat.shape}, {mat.to_list()}")
    tr = mat.transpose(0, 1)
    print(f"Transpose(0,1): shape={tr.shape}, {tr.to_list()}")

    t4d = Tensor(list(range(24)), shape=(1, 2, 3, 4))
    perm = t4d.permute((0, 2, 3, 1))
    print(f"\nPermute (1,2,3,4) -> (0,2,3,1): {t4d.shape} -> {perm.shape}")

    batch_conv = Tensor(list(range(2 * 4 * 4 * 2)), shape=(2, 4, 4, 2))
    flat = batch_conv.flatten(start_dim=1)
    print(f"\nFlatten (2,4,4,2) from dim 1: shape={flat.shape}")
    print()


def demo_broadcasting_numpy():
    print("=" * 60)
    print("BROADCASTING (NumPy)")
    print("=" * 60)

    print("\n--- Adding bias to batch ---")
    activations = np.random.randn(4, 3)
    bias = np.array([0.1, 0.2, 0.3])
    result = activations + bias
    print(f"activations: {activations.shape}")
    print(f"bias:        {bias.shape}")
    print(f"result:      {result.shape}")

    print("\n--- Channel-wise scaling ---")
    images = np.random.randn(2, 3, 4, 4)
    scale = np.array([0.5, 1.0, 1.5]).reshape(1, 3, 1, 1)
    result = images * scale
    print(f"images: {images.shape}")
    print(f"scale:  {scale.shape}")
    print(f"result: {result.shape}")

    print("\n--- Outer product via broadcasting ---")
    a = np.array([1, 2, 3]).reshape(-1, 1)
    b = np.array([10, 20, 30, 40]).reshape(1, -1)
    outer = a * b
    print(f"a: {a.shape}, b: {b.shape}")
    print(f"outer product: {outer.shape}")
    print(outer)

    print("\n--- Pairwise distances via broadcasting ---")
    points_a = np.random.randn(5, 2)
    points_b = np.random.randn(3, 2)
    diff = points_a[:, np.newaxis, :] - points_b[np.newaxis, :, :]
    distances = np.sqrt(np.sum(diff ** 2, axis=-1))
    print(f"points_a: {points_a.shape}")
    print(f"points_b: {points_b.shape}")
    print(f"diff:     {diff.shape}")
    print(f"distances: {distances.shape}")

    print("\n--- Broadcasting rules check ---")
    shapes_to_test = [
        ((8, 1, 6, 1), (7, 1, 5)),
        ((3, 4), (4,)),
        ((2, 1, 3), (1, 4, 3)),
        ((3, 1), (1, 4)),
    ]
    for sa, sb in shapes_to_test:
        a = np.zeros(sa)
        b = np.zeros(sb)
        try:
            result = a + b
            print(f"  {sa} + {sb} -> {result.shape}")
        except ValueError as e:
            print(f"  {sa} + {sb} -> ERROR: {e}")

    print()


def demo_einsum():
    print("=" * 60)
    print("EINSUM NOTATION")
    print("=" * 60)

    print("\n--- Dot product: i,i-> ---")
    a = np.array([1.0, 2.0, 3.0])
    b = np.array([4.0, 5.0, 6.0])
    result = np.einsum("i,i->", a, b)
    verify = np.dot(a, b)
    print(f"  einsum: {result}, np.dot: {verify}")

    print("\n--- Outer product: i,j->ij ---")
    a = np.array([1.0, 2.0, 3.0])
    b = np.array([10.0, 20.0])
    result = np.einsum("i,j->ij", a, b)
    verify = np.outer(a, b)
    print(f"  einsum:\n{result}")
    print(f"  np.outer:\n{verify}")

    print("\n--- Matrix multiply: ik,kj->ij ---")
    A = np.array([[1, 2], [3, 4], [5, 6]], dtype=float)
    B = np.array([[7, 8, 9], [10, 11, 12]], dtype=float)
    result = np.einsum("ik,kj->ij", A, B)
    verify = A @ B
    print(f"  A: {A.shape}, B: {B.shape}")
    print(f"  einsum result:\n{result}")
    print(f"  matmul result:\n{verify}")

    print("\n--- Trace: ii-> ---")
    M = np.array([[1, 2, 3], [4, 5, 6], [7, 8, 9]], dtype=float)
    result = np.einsum("ii->", M)
    verify = np.trace(M)
    print(f"  einsum: {result}, np.trace: {verify}")

    print("\n--- Transpose: ij->ji ---")
    result = np.einsum("ij->ji", A)
    verify = A.T
    print(f"  einsum:\n{result}")

    print("\n--- Diagonal: ii->i ---")
    result = np.einsum("ii->i", M)
    verify = np.diag(M)
    print(f"  einsum: {result}, np.diag: {verify}")

    print("\n--- Sum over axis: ij->i (row sums) ---")
    result = np.einsum("ij->i", A)
    verify = A.sum(axis=1)
    print(f"  einsum: {result}, sum(axis=1): {verify}")

    print("\n--- Batch matrix multiply: bij,bjk->bik ---")
    batch_A = np.random.randn(4, 3, 5)
    batch_B = np.random.randn(4, 5, 2)
    result = np.einsum("bij,bjk->bik", batch_A, batch_B)
    verify = np.matmul(batch_A, batch_B)
    print(f"  batch_A: {batch_A.shape}, batch_B: {batch_B.shape}")
    print(f"  einsum result: {result.shape}")
    print(f"  matmul result: {verify.shape}")
    print(f"  match: {np.allclose(result, verify)}")

    print("\n--- Hadamard (element-wise) product: ij,ij->ij ---")
    C = np.array([[1, 2], [3, 4]], dtype=float)
    D = np.array([[5, 6], [7, 8]], dtype=float)
    result = np.einsum("ij,ij->ij", C, D)
    verify = C * D
    print(f"  einsum:\n{result}")
    print(f"  element-wise:\n{verify}")

    print()


def demo_attention_einsum():
    print("=" * 60)
    print("ATTENTION MECHANISM via EINSUM")
    print("=" * 60)

    B, H, T, D = 2, 4, 8, 16
    E = H * D

    np.random.seed(42)

    X = np.random.randn(B, T, E)
    print(f"Input X: {X.shape}  (batch, seq_len, embed_dim)")

    W_q = np.random.randn(E, E) * 0.02
    W_k = np.random.randn(E, E) * 0.02
    W_v = np.random.randn(E, E) * 0.02

    Q = np.einsum("bte,ek->btk", X, W_q)
    K = np.einsum("bte,ek->btk", X, W_k)
    V = np.einsum("bte,ek->btk", X, W_v)
    print(f"Q, K, V: {Q.shape}")

    Q = Q.reshape(B, T, H, D).transpose(0, 2, 1, 3)
    K = K.reshape(B, T, H, D).transpose(0, 2, 1, 3)
    V = V.reshape(B, T, H, D).transpose(0, 2, 1, 3)
    print(f"After split heads: Q={Q.shape}, K={K.shape}, V={V.shape}")

    scores = np.einsum("bhtd,bhsd->bhts", Q, K) / np.sqrt(D)
    print(f"Attention scores: {scores.shape}")

    def softmax(x, axis=-1):
        e = np.exp(x - np.max(x, axis=axis, keepdims=True))
        return e / np.sum(e, axis=axis, keepdims=True)

    weights = softmax(scores, axis=-1)
    print(f"Attention weights: {weights.shape}")
    print(f"  weights sum per query (should be 1.0): {weights[0, 0, 0].sum():.6f}")

    attn_output = np.einsum("bhts,bhsd->bhtd", weights, V)
    print(f"Attention output: {attn_output.shape}")

    concat = attn_output.transpose(0, 2, 1, 3).reshape(B, T, E)
    print(f"Concatenated heads: {concat.shape}")

    W_o = np.random.randn(E, E) * 0.02
    output = np.einsum("bte,ek->btk", concat, W_o)
    print(f"Final output: {output.shape}")
    print()


def demo_memory_layout():
    print("=" * 60)
    print("MEMORY LAYOUT")
    print("=" * 60)

    a = np.array([[1, 2, 3], [4, 5, 6]])
    print(f"Array shape: {a.shape}")
    print(f"Strides (bytes): {a.strides}")
    print(f"Strides (elements): {tuple(s // a.itemsize for s in a.strides)}")
    print(f"C-contiguous: {a.flags['C_CONTIGUOUS']}")
    print(f"F-contiguous: {a.flags['F_CONTIGUOUS']}")
    print(f"Memory layout: {a.ravel()}")

    print("\n--- After transpose ---")
    b = a.T
    print(f"Transposed shape: {b.shape}")
    print(f"Strides (bytes): {b.strides}")
    print(f"C-contiguous: {b.flags['C_CONTIGUOUS']}")
    print(f"F-contiguous: {b.flags['F_CONTIGUOUS']}")
    print(f"Note: transpose swapped strides without moving data")

    print("\n--- Contiguous copy ---")
    c = np.ascontiguousarray(b)
    print(f"After ascontiguousarray:")
    print(f"  C-contiguous: {c.flags['C_CONTIGUOUS']}")
    print(f"  Strides: {c.strides}")

    print("\n--- Row-major vs Column-major ---")
    row_major = np.array([[1, 2, 3], [4, 5, 6]], order='C')
    col_major = np.array([[1, 2, 3], [4, 5, 6]], order='F')
    print(f"Row-major (C) flat: {row_major.ravel(order='K')}")
    print(f"Col-major (F) flat: {col_major.ravel(order='K')}")
    print(f"Row-major strides: {row_major.strides}")
    print(f"Col-major strides: {col_major.strides}")

    print("\n--- Stride tricks: creating a view ---")
    x = np.arange(12).reshape(3, 4)
    print(f"Original:\n{x}")
    print(f"Strides: {x.strides}")
    sliced = x[:, ::2]
    print(f"Every other column (x[:, ::2]):\n{sliced}")
    print(f"Sliced strides: {sliced.strides}")
    print(f"Sliced is contiguous: {sliced.flags['C_CONTIGUOUS']}")
    print()


def demo_ai_tensor_shapes():
    print("=" * 60)
    print("COMMON AI TENSOR SHAPES")
    print("=" * 60)

    print("\n--- Vision: (B, C, H, W) ---")
    B, C, H, W = 32, 3, 224, 224
    images = np.random.randn(B, C, H, W).astype(np.float32)
    print(f"Image batch: {images.shape}")
    print(f"  Total elements: {images.size:,}")
    print(f"  Memory (float32): {images.nbytes / 1024 / 1024:.1f} MB")

    kernel = np.random.randn(64, 3, 3, 3).astype(np.float32)
    print(f"Conv2D kernel (64 filters, 3x3): {kernel.shape}")

    print("\n--- NLP: (B, T, D) ---")
    B, T, D = 16, 512, 768
    embeddings = np.random.randn(B, T, D).astype(np.float32)
    print(f"Token embeddings: {embeddings.shape}")
    print(f"  Total elements: {embeddings.size:,}")
    print(f"  Memory (float32): {embeddings.nbytes / 1024 / 1024:.1f} MB")

    vocab_size = 50257
    embed_table = np.random.randn(vocab_size, D).astype(np.float32)
    print(f"Embedding table (GPT-2): {embed_table.shape}")
    print(f"  Memory: {embed_table.nbytes / 1024 / 1024:.1f} MB")

    print("\n--- Attention: (B, H, T, D_head) ---")
    H = 12
    D_head = D // H
    Q = np.random.randn(B, H, T, D_head).astype(np.float32)
    print(f"Query tensor: {Q.shape}")
    print(f"  Head dim: {D_head}")
    attn_scores = np.random.randn(B, H, T, T).astype(np.float32)
    print(f"Attention scores: {attn_scores.shape}")
    print(f"  Memory: {attn_scores.nbytes / 1024 / 1024:.1f} MB")

    print("\n--- Weight shapes ---")
    shapes = {
        "Linear (768 -> 3072)": (3072, 768),
        "Linear (3072 -> 768)": (768, 3072),
        "Conv2D (3->64, 7x7)": (64, 3, 7, 7),
        "Conv2D (64->128, 3x3)": (128, 64, 3, 3),
        "LayerNorm (768)": (768,),
        "Embedding (50257, 768)": (50257, 768),
        "Positional (1024, 768)": (1024, 768),
    }
    for name, shape in shapes.items():
        params = reduce(lambda a, b: a * b, shape, 1)
        print(f"  {name}: {shape} -> {params:,} params")

    print("\n--- Layout conversion: NCHW <-> NHWC ---")
    nchw = np.random.randn(2, 3, 4, 4)
    nhwc = np.transpose(nchw, (0, 2, 3, 1))
    back = np.transpose(nhwc, (0, 3, 1, 2))
    print(f"NCHW: {nchw.shape}")
    print(f"NHWC: {nhwc.shape}")
    print(f"Back to NCHW: {back.shape}")
    print(f"Round-trip match: {np.allclose(nchw, back)}")

    print("\n--- Reshaping for multi-head attention ---")
    B, T, D = 4, 128, 768
    H = 12
    D_head = D // H
    x = np.random.randn(B, T, D)
    print(f"Input: {x.shape}")

    step1 = x.reshape(B, T, H, D_head)
    print(f"After reshape to (B,T,H,D_head): {step1.shape}")

    step2 = step1.transpose(0, 2, 1, 3)
    print(f"After transpose to (B,H,T,D_head): {step2.shape}")

    step3 = step2.transpose(0, 2, 1, 3).reshape(B, T, D)
    print(f"Merge heads back: {step3.shape}")
    print(f"Round-trip match: {np.allclose(x, step3)}")

    print()


def demo_reduction_operations():
    print("=" * 60)
    print("REDUCTION OPERATIONS")
    print("=" * 60)

    x = np.random.randn(2, 3, 4)
    print(f"Input shape: {x.shape}")

    print(f"\n  sum():           {x.sum().shape if hasattr(x.sum(), 'shape') else 'scalar'}")
    print(f"  sum(axis=0):     {x.sum(axis=0).shape}")
    print(f"  sum(axis=1):     {x.sum(axis=1).shape}")
    print(f"  sum(axis=2):     {x.sum(axis=2).shape}")
    print(f"  sum(axis=(1,2)): {x.sum(axis=(1,2)).shape}")

    print(f"\n  mean(axis=0):    {x.mean(axis=0).shape}")
    print(f"  max(axis=-1):    {x.max(axis=-1).shape}")
    print(f"  argmax(axis=-1): {x.argmax(axis=-1).shape}")

    print("\n--- Global Average Pooling (vision) ---")
    feature_map = np.random.randn(2, 64, 7, 7)
    pooled = feature_map.mean(axis=(2, 3))
    print(f"  Feature map: {feature_map.shape}")
    print(f"  After GAP:   {pooled.shape}")

    print("\n--- Sequence mean pooling (NLP) ---")
    hidden_states = np.random.randn(4, 128, 768)
    mask = np.ones((4, 128, 1))
    mask[:, 100:, :] = 0
    pooled = (hidden_states * mask).sum(axis=1) / mask.sum(axis=1)
    print(f"  Hidden states: {hidden_states.shape}")
    print(f"  Mask:          {mask.shape}")
    print(f"  Pooled:        {pooled.shape}")

    print()


def demo_custom_tensor_class():
    print("=" * 60)
    print("CUSTOM TENSOR CLASS DEMO")
    print("=" * 60)

    t = Tensor([[1, 2, 3], [4, 5, 6]])
    print(f"Created: {t}")
    print(f"Shape: {t.shape}, Rank: {t.rank}, Size: {t.size}")
    print(f"Strides: {t.strides}")
    print(f"Element [1,2]: {t[1, 2]}")

    r = t.reshape((3, 2))
    print(f"\nReshaped to (3,2): {r}")

    r2 = t.reshape((-1,))
    print(f"Flattened: {r2}")

    u = t.unsqueeze(0)
    print(f"\nUnsqueeze(0): shape={u.shape}")
    s = u.squeeze(0)
    print(f"Squeeze(0):   shape={s.shape}")

    tr = t.transpose(0, 1)
    print(f"\nTranspose: {tr}")

    a = Tensor([[1, 2], [3, 4]])
    b = Tensor([[10, 20], [30, 40]])
    print(f"\na + b: {(a + b).to_list()}")
    print(f"a * b: {(a * b).to_list()}")
    print(f"a * 2: {(a * 2).to_list()}")

    print(f"\nSum all: {a.sum()}")
    print(f"Sum axis 0: {a.sum(axis=0).to_list()}")
    print(f"Sum axis 1: {a.sum(axis=1).to_list()}")

    np_arr = t.to_numpy()
    print(f"\nConverted to numpy: {np_arr.shape}")

    t3d = Tensor([[[1, 2], [3, 4]], [[5, 6], [7, 8]]])
    perm = t3d.permute((2, 0, 1))
    print(f"\n3D tensor {t3d.shape} permuted (2,0,1): {perm.shape}")
    print(f"  {perm.to_list()}")

    flat = t3d.flatten(start_dim=1)
    print(f"Flatten from dim 1: {flat.shape} -> {flat.to_list()}")

    print()


def demo_einsum_gallery():
    print("=" * 60)
    print("EINSUM GALLERY: ALL COMMON PATTERNS")
    print("=" * 60)

    two_operand_ops = [
        ("Vector dot product",      "i,i->",     (4,),       (4,)),
        ("Outer product",           "i,j->ij",   (3,),       (4,)),
        ("Matrix-vector product",   "ij,j->i",   (3, 4),     (4,)),
        ("Matrix multiply",         "ij,jk->ik", (3, 4),     (4, 5)),
        ("Batch matmul",            "bij,bjk->bik", (2, 3, 4), (2, 4, 5)),
        ("Batch outer product",     "bi,bj->bij", (2, 3),    (2, 4)),
        ("Frobenius norm squared",  "ij,ij->",   (3, 4),     (3, 4)),
        ("Tensor contraction",      "ijk,jkl->il", (2, 3, 4), (3, 4, 5)),
    ]

    single_operand_ops = [
        ("Trace",                   "ii->",      (4, 4)),
        ("Diagonal",                "ii->i",     (4, 4)),
        ("Row sum",                 "ij->i",     (3, 4)),
        ("Column sum",              "ij->j",     (3, 4)),
        ("Transpose",               "ij->ji",    (3, 4)),
    ]

    np.random.seed(0)
    for name, subscripts, shape_a, shape_b in two_operand_ops:
        a = np.random.randn(*shape_a)
        b = np.random.randn(*shape_b)
        result = np.einsum(subscripts, a, b)
        result_shape = result.shape if hasattr(result, 'shape') and result.shape else 'scalar'
        print(f"  {name:30s}  {subscripts:15s}  "
              f"{shape_a} x {shape_b} -> {result_shape}")

    for name, subscripts, shape_a in single_operand_ops:
        a = np.random.randn(*shape_a)
        result = np.einsum(subscripts, a)
        result_shape = result.shape if hasattr(result, 'shape') and result.shape else 'scalar'
        print(f"  {name:30s}  {subscripts:15s}  "
              f"{shape_a} -> {result_shape}")

    print()
    print("--- Bilinear form (3-operand einsum): i,ij,j-> ---")
    x = np.array([1.0, 2.0, 3.0])
    W = np.array([[1, 0, 0], [0, 2, 0], [0, 0, 3]], dtype=float)
    y = np.array([1.0, 1.0, 1.0])
    result = np.einsum("i,ij,j->", x, W, y)
    manual = x @ W @ y
    print(f"  x: {x.shape}, W: {W.shape}, y: {y.shape}")
    print(f"  x^T W y = einsum: {result}, manual: {manual}")

    print()


if __name__ == "__main__":
    demo_custom_tensor_class()
    demo_basic_tensor()
    demo_reshape_operations()
    demo_broadcasting_numpy()
    demo_memory_layout()
    demo_einsum()
    demo_einsum_gallery()
    demo_attention_einsum()
    demo_ai_tensor_shapes()
    demo_reduction_operations()
