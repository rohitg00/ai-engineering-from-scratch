import math


def vanishing_gradient_sim(seq_len, recurrent_weight=0.9):
    return math.pow(recurrent_weight, seq_len)


def conv1d_over_embeddings(embeddings, filter_matrix, bias=0.0):
    filter_width = len(filter_matrix)
    embed_dim = len(embeddings[0])
    out = []
    for i in range(len(embeddings) - filter_width + 1):
        total = bias
        for k in range(filter_width):
            for d in range(embed_dim):
                total += embeddings[i + k][d] * filter_matrix[k][d]
        out.append(max(total, 0.0))
    return out


def max_pool(values):
    return max(values) if values else 0.0


def main():
    print("=== vanishing gradient sim ===")
    for length in [10, 50, 100, 200]:
        print(f"  len={length:3d}  w=0.9  gradient attenuation = {vanishing_gradient_sim(length):.2e}")
    print("  a plain RNN loses 99.99% of its gradient by step 100.")
    print()

    print("=== TextCNN conceptual pass ===")
    embeddings = [
        [1.0, 0.2, 0.5],
        [0.8, 0.9, 0.1],
        [0.3, 0.4, 0.7],
        [0.6, 0.5, 0.5],
        [0.1, 0.8, 0.2],
    ]
    filter_w2 = [[0.5, 0.0, 0.5], [0.2, 0.3, 0.1]]
    filter_w3 = [[0.3, 0.3, 0.3], [0.2, 0.4, 0.1], [0.5, 0.2, 0.1]]

    act_w2 = conv1d_over_embeddings(embeddings, filter_w2, bias=-0.5)
    act_w3 = conv1d_over_embeddings(embeddings, filter_w3, bias=-0.4)

    print(f"  5 tokens x 3 embed_dim")
    print(f"  width-2 filter activations: {[round(x, 2) for x in act_w2]}")
    print(f"  width-3 filter activations: {[round(x, 2) for x in act_w3]}")
    print(f"  max-pooled features:        [{max_pool(act_w2):.2f}, {max_pool(act_w3):.2f}]")


if __name__ == "__main__":
    main()
