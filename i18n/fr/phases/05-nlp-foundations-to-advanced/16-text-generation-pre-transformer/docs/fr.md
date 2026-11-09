# Génération de texte avant les transformateurs  Modèles de langage en N-grammes

> Si un mot est surprenant, le modèle est mauvais. La perplexité fait une surprise. Le doucement le maintient fini.

**Type:** Build
**Languages:** Python, TypeScript
**Prerequisites:** Phase 5 · 01 (Text Processing), Phase 2 · 14 (Naive Bayes)
**Time:** ~45 minutes

## Le problème

Avant les transformateurs, avant les RNN, avant les emblèmes de mots, un modèle de langage prédisait le mot suivant en comptant la fréquence avec laquelle il suivait le précédent `n-1`Les mots: "le chat" → "s'assoit" 47 fois, "le chat" → "s'est fait sauter" 12 fois, "le chat" → "réfrigérateur" 0 fois. Normalize pour obtenir une répartition de probabilité.

C'est un modèle de langage n-gramme. Il a utilisé tous les reconnaisseurs de discours, tous les contrôleurs d'orthographe et tous les systèmes de traduction automatique basés sur des phrases de 1980 à 2015.

Le problème intéressant est ce qu'il faut faire avec les n-grammes invisibles. Un modèle à base de compte brut attribue zéro probabilité à tout ce qu'il n'a pas vu, ce qui est catastrophique parce que les phrases sont longues et presque toutes les phrases longues contiennent au moins une séquence invisible. Cinquante ans de recherche de lissage fixé que.

## Le concept

![N-gram model: count, smooth, generate](../assets/ngram.svg)

### Le jeu de prédiction

Avant que cette machine n'existe, une expérience défini un modèle de langage. Couvrez la lettre suivante d'une phrase anglaise. Demandez à quelqu'un de deviner, une devinette à la fois, jusqu'à ce qu'il la fasse correctement. Écrivez le nombre de devinettes. Répétez pour quelques centaines de lettres.

Les chiffres de devinettes ne sont pas des trivialités. Ce sont un recodage sans perte du texte: remettre la séquence de calcul à un second devinetteur identique et ils peuvent reconstruire chaque lettre, parce qu'à chaque position ils savent exactement quelles devinettes viennent en premier. Un message que vous pouvez recoder en moins de symboles porte moins d'informations par symbole, donc les statistiques de recodage de devinettes placent un plafond sur l'entropie de l'anglais.

Shannon a fait cette étude en 1951 et a obtenu un nombre qui gouverne encore le champ. Un alphabet de 27 symboles (26 lettres plus espace) pouvait contenir`log2(27) ≈ 4.75`Les devins humains avec 100 lettres de contexte ont obtenu entre 0,6 et 1,3 bits par lettre. L'anglais est environ trois quarts des mouvements forcés. La structure qu'un modèle doit apprendre a été mesurée avant qu'un modèle puisse l'apprendre.

Chaque modèle de langue depuis est un joueur mécanique de ce jeu, et chaque numéro d'évaluation dans cette leçon est le jeu marqué:

- **Cross-entropy loss**L'entraînement d'un LM réduit littéralement son score au jeu de devinettes.
- **Perplexity**est `2^bits`(ou `e^nats`Le facteur de branchage qui reste devant le modèle après sa conjecture.
- **Context length is the player's memory.**Un modèle de trigramme joue avec deux jetons de mémoire. Un transformateur joue le même jeu avec 100K jetons. Les règles n'ont jamais changé; le joueur est devenu meilleur.

Un seul passage à la piste: les scores du jeu par lettre en bits (`log2`), tandis que les formules n-grammes ci-dessous donnent un score par mot en nats (log naturel)  et depuis la perplexité `e^H`en natts égaux `2^H`en bits, les deux vues sont la même mesure dans différentes unités.

```figure
prediction-game
```

**N-gram probability:** `P(w_i | w_{i-n+1}, ..., w_{i-1})`- Réparer .`n`(généralement 3 pour les trigrammes, 4 pour les 4 grammes).

```math
P(w \mid \text{context}) = \frac{\mathop{\mathrm{count}}(\text{context}, w)}{\mathop{\mathrm{count}}(\text{context})}
```

**The zero-count problem.**Un rapport de 2007 sur le corpus de Brown a révélé que même un modèle de 4 grammes avait 30% de 4 grammes non vus dans l'entraînement.

**Smoothing approaches, in order of sophistication:**

1. **Laplace (add-one).**Ajouter un à chaque compte, simple, terrible pour des événements rares.
2. **Good-Turing.**Réaffectionner la masse de probabilité des événements à plus haute fréquence à ceux invisibles en fonction de la fréquence des fréquences.
3. **Interpolation.**Combiner n-grammes, (n-1)-grammes, etc., estimations avec des poids réglables.
4. **Backoff.**Si n-gramme a le nombre zéro, retourner à (n-1) gramme.
5. **Absolute discounting.**Soustraire une réduction fixe `D`de tous les nombres, redistribuer à l'invisible.
6. **Kneser-Ney.**Discounting absolu plus un choix intelligent pour le modèle de l'ordre inférieur: utiliser *probabilité de continuation* (combien de contextes un mot apparaît dans) au lieu de fréquence brute.

Le concept de Kneser-Ney est profond. "San Francisco" est un gros mot commun. L'unigramme "Francisco" apparaît principalement après "San". Le rabat absolu naïf donne à "Francisco" une probabilité élevée d'unigramme (parce que le nombre est élevé). Kneser-Ney constate que "Francisco" apparaît dans un seul contexte et réduit en conséquence sa probabilité de continuation. Résultat: un bigram roman terminant par "Francisco" obtient la probabilité appropriée.

**Evaluation: perplexity.**Le facteur de probabilité négative moyenne par mot sur un ensemble de tests prolongés. Moins est mieux. Une perplexité de 100 signifie que le modèle est aussi confus qu'il choisirait uniformément parmi 100 mots.

```math
\text{perplexity} = \exp\left(-\frac{1}{N} \sum_i \log P(w_i \mid \text{context}_i)\right)
```

```figure
ngram-backoff
```

## Faites-le

### Étape 1: compte des trigrammes

```python
from collections import Counter, defaultdict


def train_ngram(corpus_tokens, n=3):
    ngrams = Counter()
    contexts = Counter()
    for sentence in corpus_tokens:
        padded = ["<s>"] * (n - 1) + sentence + ["</s>"]
        for i in range(len(padded) - n + 1):
            ctx = tuple(padded[i:i + n - 1])
            word = padded[i + n - 1]
            ngrams[ctx + (word,)] += 1
            contexts[ctx] += 1
    return ngrams, contexts


def raw_probability(ngrams, contexts, context, word):
    ctx = tuple(context)
    if contexts.get(ctx, 0) == 0:
        return 0.0
    return ngrams.get(ctx + (word,), 0) / contexts[ctx]
```

L'entrée est une liste de phrases jetonnées.`<s>`et `</s>`sont des limites de la phrase.

### Étape 2: Légalisation de la place

```python
def laplace_probability(ngrams, contexts, vocab_size, context, word):
    ctx = tuple(context)
    numerator = ngrams.get(ctx + (word,), 0) + 1
    denominator = contexts.get(ctx, 0) + vocab_size
    return numerator / denominator
```

Ajouter 1 à chaque compte, mais en suralloquant la masse à des événements invisibles, blessant aussi des événements rares.

### Étape 3: Kneser-Ney (bigramme, interpolé)

```python
def kneser_ney_bigram_model(corpus_tokens, discount=0.75):
    unigrams = Counter()
    bigrams = Counter()
    unigram_contexts = defaultdict(set)

    for sentence in corpus_tokens:
        padded = ["<s>"] + sentence + ["</s>"]
        for i, w in enumerate(padded):
            unigrams[w] += 1
            if i > 0:
                prev = padded[i - 1]
                bigrams[(prev, w)] += 1
                unigram_contexts[w].add(prev)

    total_unique_bigrams = sum(len(ctx_set) for ctx_set in unigram_contexts.values())
    continuation_prob = {
        w: len(ctx_set) / total_unique_bigrams for w, ctx_set in unigram_contexts.items()
    }

    context_totals = Counter()
    for (prev, w), count in bigrams.items():
        context_totals[prev] += count

    unique_follow = defaultdict(set)
    for (prev, w) in bigrams:
        unique_follow[prev].add(w)

    def prob(prev, w):
        count = bigrams.get((prev, w), 0)
        denom = context_totals.get(prev, 0)
        if denom == 0:
            return continuation_prob.get(w, 1e-9)
        first_term = max(count - discount, 0) / denom
        lambda_prev = discount * len(unique_follow[prev]) / denom
        return first_term + lambda_prev * continuation_prob.get(w, 1e-9)

    return prob
```

Trois pièces en mouvement.`continuation_prob`Il est donc important de noter que les résultats de l'étude de la recherche ont été analysés dans des contextes différents.`lambda_prev`est la masse libérée par la réduction, utilisée pour pondérer le backoff.

### Étape 4: générer du texte avec le prélèvement d'échantillons

```python
import random


def generate(prob_fn, vocab, prefix, max_len=30, seed=0):
    rng = random.Random(seed)
    tokens = list(prefix)
    for _ in range(max_len):
        candidates = [(w, prob_fn(tokens[-1], w)) for w in vocab]
        total = sum(p for _, p in candidates)
        r = rng.random() * total
        acc = 0.0
        for w, p in candidates:
            acc += p
            if r <= acc:
                tokens.append(w)
                break
        if tokens[-1] == "</s>":
            break
    return tokens
```

Pratiquer des échantillons proportionnels à la probabilité. Il donne toujours une sortie différente par semence. Pour une sortie similaire à celle de la recherche de faisceau, choisissez l'argmax à chaque étape (avidité) et ajoutez un petit bouton de randomité (température).

### Étape 5: perplexité

```python
import math


def perplexity(prob_fn, sentences):
    total_log_prob = 0.0
    total_tokens = 0
    for sentence in sentences:
        padded = ["<s>"] + sentence + ["</s>"]
        for i in range(1, len(padded)):
            p = prob_fn(padded[i - 1], padded[i])
            total_log_prob += math.log(max(p, 1e-12))
            total_tokens += 1
    return math.exp(-total_log_prob / total_tokens)
```

Pour le corpus Brown, un modèle KN de 4 grammes bien ajusté atteint une perplexité d'environ 140. un transformateur LM atteint 15-30 sur le même ensemble de test.

## Utilisez-le

- **Classical NLP teaching.**L'exposition la plus claire au smoothing, MLE, et la perplexité que vous pouvez obtenir.
- **KenLM.**Bibliothèque de production n-gramme. Utilisé comme rescorer dans les systèmes de parole et de MT où la faible latence compte.
- **On-device autocomplete.**Des modèles de trigramme sur le clavier.
- **Baselines.**Si votre transformateur ne dépasse pas KN de manière large, quelque chose ne va pas.

## La faire partir

- Je ne sais pas .`outputs/prompt-lm-baseline.md`- Le numéro de la liste:

```markdown
---
name: lm-baseline
description: Build a reproducible n-gram language model baseline before training a neural LM.
phase: 5
lesson: 16
---

Given a corpus and target use (next-word prediction, rescoring, perplexity baseline), output:

1. N-gram order. Trigram for general English, 4-gram if corpus is large, 5-gram for speech rescoring.
2. Smoothing. Modified Kneser-Ney is the default; Laplace only for teaching.
3. Library. `kenlm` for production, `nltk.lm` for teaching, roll your own only to learn.
4. Evaluation. Held-out perplexity with consistent tokenization between train and test sets.

Refuse to report perplexity computed with different tokenization between systems being compared — perplexity numbers are comparable only under identical tokenization. Flag OOV rate in test set; KN handles OOV poorly unless you reserve a special <UNK> token during training.
```

## Exercices

1. **Easy.**Exercez un trigramme LM sur un corpus de Shakespeare de 1000 phrases. Générez 20 phrases. Elles seront plausibles localement mais incohérentes à l'échelle mondiale.
2. **Medium.**Vous devriez voir la perplexité de votre modèle KN sur une fraction de Shakespeare prolongée.
3. **Hard.**Construire un correcteur d'orthographe de trigramme: compte tenu d'un mot mal orthographié et de son contexte, générer des corrections et classer par probabilité de contexte dans le LM. Évaluer sur le corpus d'orthographe Birkbeck (public).

## Les termes clés

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| N-gram | Word sequence | Sequence of `n` consecutive tokens. |
| Smoothing | Avoiding zeros | Reallocating probability mass so unseen events get non-zero probability. |
| Perplexity | LM quality metric | `exp(-average log-prob)` on held-out data. Lower is better. |
| Backoff | Fallback to shorter context | If trigram count is zero, use bigram. Katz backoff formalizes this. |
| Kneser-Ney | Best smoothing for n-grams | Absolute discounting + continuation probability for the lower-order model. |
| Continuation probability | KN-specific | `P(w)` weighted by number of contexts `w` appears in, not by raw count. |
| Entropy of text | Information per symbol | Average bits needed to encode the next symbol given the context. Shannon's 1951 estimate for printed English with up to 100 letters of context: 0.6-1.3 bits/letter, measured before any model existed. |

## Pour en savoir plus

- [Shannon (1951). Prediction and Entropy of Printed English](https://www.princeton.edu/~wbialek/rome/refs/shannon_51.pdf) l'expérience de jeu de devinettes qui définit la cible que chaque modèle de langage optimise encore.
- [Jurafsky and Martin — Speech and Language Processing, Chapter 3 (2026 draft)](https://web.stanford.edu/~jurafsky/slp3/3.pdf) le traitement canonique des LM n-grammes et le lissage.
- [Chen and Goodman (1998). An Empirical Study of Smoothing Techniques for Language Modeling](https://dash.harvard.edu/handle/1/25104739)Le papier qui a établi Kneser-Ney comme le meilleur n-gramme plus lisse.
- [Kneser and Ney (1995). Improved Backing-off for M-gram Language Modeling](https://ieeexplore.ieee.org/document/479394) le papier KN original.
- [KenLM](https://kheafield.com/code/kenlm/) LM à production rapide n-gramme, encore utilisé en 2026 pour les applications sensibles à la latence.
