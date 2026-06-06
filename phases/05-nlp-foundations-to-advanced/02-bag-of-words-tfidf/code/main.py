import math
import re


TOKEN_RE = re.compile(r"[A-Za-z]+(?:'[A-Za-z]+)?|[0-9]+")


def tokenize(text):
    return [t.lower() for t in TOKEN_RE.findall(text)]


def build_vocab(docs):
    vocab = {}
    for doc in docs:
        for token in doc:
            if token not in vocab:
                vocab[token] = len(vocab)
    return vocab


def bag_of_words(docs, vocab):
    matrix = [[0] * len(vocab) for _ in docs]
    for i, doc in enumerate(docs):
        for token in doc:
            if token in vocab:
                matrix[i][vocab[token]] += 1
    return matrix


def document_frequency(bow_matrix):
    df = [0] * len(bow_matrix[0])
    for row in bow_matrix:
        for j, count in enumerate(row):
            if count > 0:
                df[j] += 1
    return df


def inverse_document_frequency(df, n_docs):
    return [math.log((n_docs + 1) / (d + 1)) + 1 for d in df]


def tfidf(bow_matrix):
    n_docs = len(bow_matrix)
    df = document_frequency(bow_matrix)
    idf = inverse_document_frequency(df, n_docs)
    out = []
    for row in bow_matrix:
        length = sum(row)
        tf = [c / length if length else 0 for c in row]
        out.append([t * i for t, i in zip(tf, idf)])
    return out


def l2_normalize(matrix):
    out = []
    for row in matrix:
        norm = math.sqrt(sum(x * x for x in row))
        out.append([x / norm if norm else 0 for x in row])
    return out


def cosine_similarity(a, b):
    return sum(x * y for x, y in zip(a, b))


def main():
    raw = [
        "The cat sat on the mat.",
        "The dog sat on the mat.",
        "The cat ran across the room.",
    ]
    docs = [tokenize(r) for r in raw]
    vocab = build_vocab(docs)
    bow = bag_of_words(docs, vocab)
    tfidf_vectors = l2_normalize(tfidf(bow))

    words = sorted(vocab, key=lambda w: vocab[w])
    print(f"vocab: {words}")
    print()
    for i, (r, v) in enumerate(zip(raw, tfidf_vectors)):
        pretty = [f"{x:.2f}" for x in v]
        print(f"d{i}: {r}")
        print(f"    tfidf: {pretty}")
        print()

    print("cosine similarity matrix:")
    for i in range(len(tfidf_vectors)):
        row = [f"{cosine_similarity(tfidf_vectors[i], tfidf_vectors[j]):.2f}" for j in range(len(tfidf_vectors))]
        print(f"  d{i}: {row}")


if __name__ == "__main__":
    main()
