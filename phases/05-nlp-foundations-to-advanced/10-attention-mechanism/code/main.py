import math


def softmax(scores):
    m = max(scores)
    exps = [math.exp(s - m) for s in scores]
    total = sum(exps)
    return [e / total for e in exps]


def dot(a, b):
    if len(a) != len(b):
        raise ValueError(f"dot: length mismatch {len(a)} vs {len(b)}")
    return sum(x * y for x, y in zip(a, b))


def dot_attention(decoder_state, encoder_states):
    if not encoder_states:
        raise ValueError("dot_attention: encoder_states must not be empty")
    d_s = len(decoder_state)
    for i, h in enumerate(encoder_states):
        if len(h) != d_s:
            raise ValueError(
                f"dot_attention: encoder_states[{i}] length {len(h)} != decoder_state length {d_s}"
            )
    scores = [dot(decoder_state, h) for h in encoder_states]
    weights = softmax(scores)
    dim = len(encoder_states[0])
    context = [0.0] * dim
    for w, h in zip(weights, encoder_states):
        for d in range(dim):
            context[d] += w * h[d]
    return context, weights


def matvec(M, v):
    for i, row in enumerate(M):
        if len(row) != len(v):
            raise ValueError(f"matvec: row {i} length {len(row)} != vector length {len(v)}")
    return [sum(M[i][j] * v[j] for j in range(len(v))) for i in range(len(M))]


def tanh_vec(v):
    return [math.tanh(x) for x in v]


def additive_attention(decoder_state, encoder_states, W_a, U_a, v_a):
    projected_dec = matvec(W_a, decoder_state)
    scores = []
    for h in encoder_states:
        projected_enc = matvec(U_a, h)
        combined = tanh_vec([projected_enc[i] + projected_dec[i] for i in range(len(v_a))])
        scores.append(dot(v_a, combined))
    weights = softmax(scores)
    dim = len(encoder_states[0])
    context = [0.0] * dim
    for w, h in zip(weights, encoder_states):
        for d in range(dim):
            context[d] += w * h[d]
    return context, weights


def main():
    H = [
        [1.0, 0.0, 0.2],
        [0.5, 0.5, 0.1],
        [0.1, 0.9, 0.3],
    ]
    positions = ["cat", "sat", "mat"]

    print("=== Luong dot attention ===")
    for name, s in [("close to 'cat'", [0.9, 0.1, 0.2]), ("close to 'mat'", [0.1, 0.9, 0.3]), ("neutral", [0.4, 0.4, 0.2])]:
        _, weights = dot_attention(s, H)
        pretty = {p: round(w, 3) for p, w in zip(positions, weights)}
        print(f"  decoder state {name:20s} -> weights {pretty}")

    print()
    print("=== Bahdanau additive attention (d_attn=2) ===")
    W_a = [[0.6, 0.3, 0.1], [0.1, 0.5, 0.4]]
    U_a = [[0.5, 0.2, 0.3], [0.2, 0.6, 0.2]]
    v_a = [0.8, 0.6]
    for name, s in [("close to 'cat'", [0.9, 0.1, 0.2]), ("close to 'mat'", [0.1, 0.9, 0.3])]:
        _, weights = additive_attention(s, H, W_a, U_a, v_a)
        pretty = {p: round(w, 3) for p, w in zip(positions, weights)}
        print(f"  decoder state {name:20s} -> weights {pretty}")


if __name__ == "__main__":
    main()
