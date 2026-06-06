import math
from collections import Counter, defaultdict


TRAIN = [
    (["The", "cat", "sat", "on", "the", "mat"], ["DET", "NOUN", "VERB", "ADP", "DET", "NOUN"]),
    (["A", "dog", "ran", "across", "the", "road"], ["DET", "NOUN", "VERB", "ADP", "DET", "NOUN"]),
    (["Cats", "chase", "mice"], ["NOUN", "VERB", "NOUN"]),
    (["Dogs", "bark", "loudly"], ["NOUN", "VERB", "ADV"]),
    (["The", "mat", "is", "red"], ["DET", "NOUN", "AUX", "ADJ"]),
    (["A", "red", "cat", "sat"], ["DET", "ADJ", "NOUN", "VERB"]),
]


def train_mft(examples):
    word_tag_counts = defaultdict(Counter)
    all_tags = Counter()
    for tokens, tags in examples:
        for token, tag in zip(tokens, tags):
            word_tag_counts[token.lower()][tag] += 1
            all_tags[tag] += 1
    word_best = {w: c.most_common(1)[0][0] for w, c in word_tag_counts.items()}
    default_tag = all_tags.most_common(1)[0][0]
    return word_best, default_tag


def predict_mft(tokens, word_best, default_tag):
    return [word_best.get(t.lower(), default_tag) for t in tokens]


def train_hmm(examples, alpha=0.01):
    transitions = defaultdict(Counter)
    emissions = defaultdict(Counter)
    tags = set()
    vocab = set()
    for tokens, ts in examples:
        prev = "<BOS>"
        for token, tag in zip(tokens, ts):
            transitions[prev][tag] += 1
            emissions[tag][token.lower()] += 1
            tags.add(tag)
            vocab.add(token.lower())
            prev = tag
        transitions[prev]["<EOS>"] += 1
    return transitions, emissions, tags, vocab


def log_prob(table, given, key, smooth_denom, alpha):
    return math.log((table[given].get(key, 0) + alpha) / smooth_denom)


def viterbi(tokens, transitions, emissions, tags, vocab, alpha=0.01):
    tags_list = list(tags)
    n = len(tokens)
    V = [[0.0] * len(tags_list) for _ in range(n)]
    back = [[0] * len(tags_list) for _ in range(n)]

    for j, tag in enumerate(tags_list):
        em_denom = sum(emissions[tag].values()) + alpha * (len(vocab) + 1)
        tr_denom = sum(transitions["<BOS>"].values()) + alpha * (len(tags_list) + 1)
        tr = log_prob(transitions, "<BOS>", tag, tr_denom, alpha)
        em = log_prob(emissions, tag, tokens[0].lower(), em_denom, alpha)
        V[0][j] = tr + em
        back[0][j] = 0

    for i in range(1, n):
        for j, tag in enumerate(tags_list):
            em_denom = sum(emissions[tag].values()) + alpha * (len(vocab) + 1)
            em = log_prob(emissions, tag, tokens[i].lower(), em_denom, alpha)
            best_prev = 0
            best_score = -1e30
            for k, prev_tag in enumerate(tags_list):
                tr_denom = sum(transitions[prev_tag].values()) + alpha * (len(tags_list) + 1)
                tr = log_prob(transitions, prev_tag, tag, tr_denom, alpha)
                score = V[i - 1][k] + tr + em
                if score > best_score:
                    best_score = score
                    best_prev = k
            V[i][j] = best_score
            back[i][j] = best_prev

    last_best = max(range(len(tags_list)), key=lambda j: V[n - 1][j])
    path = [last_best]
    for i in range(n - 1, 0, -1):
        path.append(back[i][path[-1]])
    return [tags_list[j] for j in reversed(path)]


def main():
    word_best, default_tag = train_mft(TRAIN)
    transitions, emissions, tags, vocab = train_hmm(TRAIN)

    test_sentences = [
        "The cat chased the dog".split(),
        "A red mat is here".split(),
        "Dogs bark".split(),
    ]

    for sent in test_sentences:
        mft = predict_mft(sent, word_best, default_tag)
        hmm = viterbi(sent, transitions, emissions, tags, vocab)
        print(f"tokens: {sent}")
        print(f"  mft : {mft}")
        print(f"  hmm : {hmm}")
        print()


if __name__ == "__main__":
    main()
