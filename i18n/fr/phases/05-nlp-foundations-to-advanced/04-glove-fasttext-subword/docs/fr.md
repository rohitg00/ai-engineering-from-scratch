# GloVe, FastText et les insertions de sous-parts

> Word2Vec a formé un intégration par mot. GloVe a factorisé la matrice de co-occurrence. FastText a intégré les pièces. BPE a relié aux transformateurs.

**Type:** Build
**Languages:** Python, TypeScript
**Prerequisites:** Phase 5 · 03 (Word2Vec from Scratch)
**Time:** ~45 minutes

## Le problème

Word2Vec a laissé deux questions ouvertes.

Premièrement, il y avait une ligne parallèle de recherche qui facturait directement la matrice de co-occurrence (LSA, HAL) plutôt que de faire des mises à jour en ligne de skip-grammes.**GloVe**Il a répondu que: la factualisation de matrice avec une perte bien choisie correspond ou bat Word2Vec, et coûte moins cher à former.

Deuxièmement, aucune méthode n'avait une histoire pour les mots qu'elle n'avait jamais vus. `Zoomer-approved`- Je suis là .`dogecoin`, tout nom propre inventé la semaine dernière, chaque forme inflexion d'une racine rare.**FastText**Il a fixé cela en intégrant des caractères n-grammes: un mot est la somme de ses parties, y compris les morphèmes, donc même les mots hors vocabulaire obtiennent un vecteur sensible.

Troisièmement, une fois les transformateurs arrivés, la question a changé à nouveau. Les vocabulaires au niveau des mots se limitent à environ un million d'entrées; le langage réel est plus ouvert que cela. **Byte-pair encoding (BPE)**Et ses parents ont résolu cela en apprenant un vocabulaire de fréquents unités de sous-parts qui couvre tout.

Cette leçon traverse les trois, puis explique lequel pour quand.

## Le concept

**GloVe (Global Vectors).**Construire la matrice de co-occurrence mot-mot `X`où `X[i][j]`est la fréquence de la parole `j`apparaît dans le contexte du mot `i`- Les vecteurs de train tels que`v_i · v_j + b_i + b_j ≈ log(X[i][j])`- Le poids est perdu si souvent que les couples ne dominent pas.

**FastText.**Un mot est la somme de ses caractères n-grammes plus le mot lui-même. `where`devient `<wh, whe, her, ere, re>, <where>`Le vecteur de mot est la somme de ces vecteurs composants.`whereupon`) sont composés de n-grammes connus.

**BPE (Byte-Pair Encoding).**Commencez par un vocabulaire de caractères (ou octets) individuels. Comptez chaque paire adjacente dans le corpus. Fusez la paire la plus fréquente dans un nouveau jeton. Répétez pour `k`Les résultats: un vocabulaire des symboles de base plus `k`fusion (`k + 256`les jetons lorsque vous démarrez à partir de octets) où les séquences fréquentes (`ing`- Je suis là .`tion`- Je suis là .`the`Les mots rares sont divisés en morceaux familiers.

```figure
n5-subword-merge
```

## Faites-le

### GloVe: facteuriser la matrice de co-occurrence

```python
import numpy as np
from collections import Counter


def build_cooccurrence(docs, window=5):
    pair_counts = Counter()
    vocab = {}
    for doc in docs:
        for token in doc:
            if token not in vocab:
                vocab[token] = len(vocab)
    for doc in docs:
        indexed = [vocab[t] for t in doc]
        for i, center in enumerate(indexed):
            for j in range(max(0, i - window), min(len(indexed), i + window + 1)):
                if i != j:
                    distance = abs(i - j)
                    pair_counts[(center, indexed[j])] += 1.0 / distance
    return vocab, pair_counts


def glove_train(vocab, pair_counts, dim=16, epochs=100, lr=0.05, x_max=100, alpha=0.75, seed=0):
    n = len(vocab)
    rng = np.random.default_rng(seed)
    W = rng.normal(0, 0.1, size=(n, dim))
    W_tilde = rng.normal(0, 0.1, size=(n, dim))
    b = np.zeros(n)
    b_tilde = np.zeros(n)

    for epoch in range(epochs):
        for (i, j), x_ij in pair_counts.items():
            weight = (x_ij / x_max) ** alpha if x_ij < x_max else 1.0
            diff = W[i] @ W_tilde[j] + b[i] + b_tilde[j] - np.log(x_ij)
            coef = weight * diff

            grad_W_i = coef * W_tilde[j]
            grad_W_tilde_j = coef * W[i]
            W[i] -= lr * grad_W_i
            W_tilde[j] -= lr * grad_W_tilde_j
            b[i] -= lr * coef
            b_tilde[j] -= lr * coef

    return W + W_tilde
```

Deux pièces en mouvement qui méritent d'être nommées.`f(x) = (x/x_max)^alpha`des poids inférieurs très fréquents par paires (comme `(the, and)`L'intégration finale est la somme de `W`(centre) et `W_tilde`(contextes) les tables. La somme des deux est une astuce publiée qui tend à surpasser en utilisant une seule.

### FastText: intégrations sensibles aux sous-commentaires

```python
def char_ngrams(word, n_min=3, n_max=6):
    wrapped = f"<{word}>"
    grams = {wrapped}
    for n in range(n_min, n_max + 1):
        for i in range(len(wrapped) - n + 1):
            grams.add(wrapped[i:i + n])
    return grams
```

```python
>>> char_ngrams("where")
{'<where>', '<wh', 'whe', 'her', 'ere', 're>', '<whe', 'wher', 'here', 'ere>', '<wher', 'where', 'here>'}
```

Chaque mot est représenté par son ensemble de n-grammes (généralement 3 à 6 caractères).

```python
def fasttext_vector(word, ngram_table):
    grams = char_ngrams(word)
    vecs = [ngram_table[g] for g in grams if g in ngram_table]
    if not vecs:
        return None
    return np.sum(vecs, axis=0)
```

Pour un mot invisible, vous obtenez toujours un vecteur tant que certains de ses n-grammes sont connus. `whereupon`actions `<wh`- Je suis là .`her`- Je suis là .`ere`, et `<where`avec `where`, donc les deux atterrissent près l'un de l'autre.

### BPE: vocabulaire de sous-parts appris

```python
def learn_bpe(corpus, k_merges):
    vocab = Counter()
    for word, freq in corpus.items():
        tokens = tuple(word) + ("</w>",)
        vocab[tokens] = freq

    merges = []
    for _ in range(k_merges):
        pair_freq = Counter()
        for tokens, freq in vocab.items():
            for a, b in zip(tokens, tokens[1:]):
                pair_freq[(a, b)] += freq
        if not pair_freq:
            break
        best = pair_freq.most_common(1)[0][0]
        merges.append(best)

        new_vocab = Counter()
        for tokens, freq in vocab.items():
            new_tokens = []
            i = 0
            while i < len(tokens):
                if i + 1 < len(tokens) and (tokens[i], tokens[i + 1]) == best:
                    new_tokens.append(tokens[i] + tokens[i + 1])
                    i += 2
                else:
                    new_tokens.append(tokens[i])
                    i += 1
            new_vocab[tuple(new_tokens)] = freq
        vocab = new_vocab
    return merges


def apply_bpe(word, merges):
    tokens = list(word) + ["</w>"]
    for a, b in merges:
        new_tokens = []
        i = 0
        while i < len(tokens):
            if i + 1 < len(tokens) and tokens[i] == a and tokens[i + 1] == b:
                new_tokens.append(a + b)
                i += 2
            else:
                new_tokens.append(tokens[i])
                i += 1
        tokens = new_tokens
    return tokens
```

```python
>>> corpus = Counter({"low": 5, "lower": 2, "newest": 6, "widest": 3})
>>> merges = learn_bpe(corpus, k_merges=10)
>>> apply_bpe("lowest", merges)
['low', 'est</w>']
```

La première itération fusionne la paire adjacente la plus courante.`low`- Je suis là .`est`- Je suis là .`tion`) deviennent des jetons uniques et des mots rares se brisent nettement.

Les véritables jetonneurs GPT / BERT / T5 apprennent des fusions de 30k à 100k. Résultat: tout texte se jetonne dans une séquence de longueurs limitées d'ID connus, aucun OOV jamais.

## Utilisez-le

En pratique, vous entraînez rarement vous-même.

```python
import fasttext.util
fasttext.util.download_model("en", if_exists="ignore")
ft = fasttext.load_model("cc.en.300.bin")
print(ft.get_word_vector("whereupon").shape)
print(ft.get_word_vector("zoomerapproved").shape)
```

Pour la tokénisation de sous-mot de style BPE à l'ère des transformateurs:

```python
from transformers import AutoTokenizer

tok = AutoTokenizer.from_pretrained("gpt2")
print(tok.tokenize("unbelievably tokenized"))
```

```
['un', 'bel', 'iev', 'ably', 'Ġtoken', 'ized']
```

Le `Ġ`Le préfixe marque les limites des mots (une convention GPT-2).

### Quand choisir lequel

| Situation | Pick |
|-----------|------|
| Pretrained general-purpose word vectors, no OOV tolerance needed | GloVe 300d |
| Pretrained general-purpose word vectors, must handle misspellings / neologisms / morphologically rich languages | FastText |
| Anything going into a transformer (training or inference) | Whatever tokenizer the model shipped with. Never swap. |
| Training your own language model from scratch | Train a BPE or SentencePiece tokenizer on your corpus first |
| Production text classification with a linear model | Still TF-IDF. Lesson 02. |

## La faire partir

- Je ne sais pas .`outputs/skill-embeddings-picker.md`- Le numéro de la liste:

```markdown
---
name: tokenizer-picker
description: Pick a tokenization approach for a new language model or text pipeline.
version: 1.0.0
phase: 5
lesson: 04
tags: [nlp, tokenization, embeddings]
---

Given a task and dataset description, you output:

1. Tokenization strategy (word-level, BPE, WordPiece, SentencePiece, byte-level). One-sentence reason.
2. Vocabulary size target (e.g., 32k for an English-only LM, 64k-100k for multilingual).
3. Library call with the exact training command. Name the library. Quote the arguments.
4. One reproducibility pitfall. Tokenizer-model mismatch is the single most common silent production bug; call out which pair must be used together.

Refuse to recommend training a custom tokenizer when the user is fine-tuning a pretrained LLM. Refuse to recommend word-level tokenization for any model targeting production inference. Flag non-English / multi-script corpora as needing SentencePiece with byte fallback.
```

## Exercices

1. **Easy.**On court .`char_ngrams("playing")`et `char_ngrams("played")`- calculer le chevauchement de Jaccard des deux ensembles de n-grammes.`pla`- Je suis là .`lay`- Je suis là .`play`), ce qui explique pourquoi FastText transforme largement les variantes morphologiques.
2. **Medium.**Extension `learn_bpe`Vous devriez voir une compression rapide au début, en assimilant près de ~2-3 caractères par jeton.
3. **Hard.**Prenez une formation de 1k sur les œuvres complètes de Shakespeare. Comparer la symbolisation des mots communs contre les noms propres rares. Mesurer les jetons moyens par mot avant et après. Écrire ce qui vous a surpris.

## Les termes clés

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| Co-occurrence matrix | Word-word frequency table | `X[i][j]` = how often word `j` appears in a window around word `i`. |
| Subword | Piece of a word | A character n-gram (FastText) or learned token (BPE/WordPiece/SentencePiece). |
| BPE | Byte-pair encoding | Iterative merging of most-frequent adjacent pairs until vocabulary hits target size. |
| OOV | Out of vocabulary | Word the model has never seen. Word2Vec/GloVe fail. FastText and BPE handle it. |
| Byte-level BPE | BPE on raw bytes | GPT-2's scheme. Vocabulary starts with 256 bytes, so nothing is ever OOV. |

## Pour en savoir plus

- [Pennington, Socher, Manning (2014). GloVe: Global Vectors for Word Representation](https://nlp.stanford.edu/pubs/glove.pdf)Le papier GloVe, sept pages, est toujours la meilleure dérivation de la perte.
- [Bojanowski et al. (2017). Enriching Word Vectors with Subword Information](https://arxiv.org/abs/1607.04606) FastText.
- [Sennrich, Haddow, Birch (2016). Neural Machine Translation of Rare Words with Subword Units](https://arxiv.org/abs/1508.07909) l'article qui introduit la BPE dans la PNL moderne.
- [Hugging Face tokenizer summary](https://huggingface.co/docs/transformers/tokenizer_summary) comment BPE, WordPiece et SentencePiece diffèrent réellement dans la pratique.
