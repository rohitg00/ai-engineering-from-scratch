# Word Embeddings — Word2Vec do Zero

> Uma palavra é a companhia que ela guarda. Treina uma rede rasa nisso e a geometria aparece.

**Tipo:** Construção
**Linguagens:** Python
**Pré-requisitos:** Fase 5 · 02 (BoW + TF-IDF), Fase 3 · 03 (Backpropagation do Zero)
**Tempo:** ~75 minutos

## O Problema

TF-IDF sabe que `dog` e `puppy` são palavras diferentes. Não sabe que significam quase a mesma coisa. Um classificador treinado em `dog` não generaliza pra uma resenha sobre `puppy`. Você pode disfarçar isso listando sinônimos, mas falha em termos raros, jargão de domínio, e todo idioma que você não antecipou.

Você quer uma representação onde `dog` e `puppy` caem perto no espaço. Onde `king - man + woman` cai perto de `queen`. Onde um modelo treinado em `dog` transfere sinal pra `puppy` de graça.

Word2Vec nos deu esse espaço. Rede neural de duas camadas, treinos com trilhões de tokens, publicado em 2013. A arquitetura é quase embaraçosamente simples. Os resultados reformularam NLP por uma década.

## O Conceito

**Hipótese distribucional** (Firth, 1957): "Você conhece uma palavra pela companhia que ela guarda." Se duas palavras aparecem em contextos similares, provavelmente significam coisas similares.

Word2Vec vem em dois sabores, ambos explorando essa ideia.

- **Skip-gram.** Dada uma palavra central, prevê as palavras ao redor. `cat -> (the, sat, on)` com janela de tamanho 2.
- **CBOW (continuous bag of words).** Dadas palavras ao redor, prevê a central. `(the, sat, on) -> cat`.

Skip-gram é mais luno pra treinar mas lida melhor com palavras raras. Tornou-se o padrão.

A rede tem uma camada oculta sem não-linearidade. A entrada é um vetor one-hot sobre o vocabulário. A saída é um softmax sobre o vocabulário. Depois do treino, joga fora a camada de saída. Os pesos da camada oculta são os embeddings.

```
one-hot(center) ── W ──▶ hidden (d-dim) ── W' ──▶ softmax(vocab)
                          ^
                          this is the embedding
```

O truque: softmax sobre 100k palavras é proibitivamente caro. Word2Vec usa **negative sampling** pra transformar em tarefa de classificação binária. Prevê "essa palavra de contexto apareceu perto dessa palavra central, sim ou não". Amostra um punhado de palavras negativas (não-co-ocorrentes) por par de treino em vez de calcular softmax sobre todo o vocabulário.

## Construindo

### Passo 1: pares de treino a partir de um corpus

```python
def skipgram_pairs(docs, window=2):
    pairs = []
    for doc in docs:
        for i, center in enumerate(doc):
            for j in range(max(0, i - window), min(len(doc), i + window + 1)):
                if i == j:
                    continue
                pairs.append((center, doc[j]))
    return pairs
```

```python
>>> skipgram_pairs([["the", "cat", "sat", "on", "mat"]], window=2)
[('the', 'cat'), ('the', 'sat'),
 ('cat', 'the'), ('cat', 'sat'), ('cat', 'on'),
 ('sat', 'the'), ('sat', 'cat'), ('sat', 'on'), ('sat', 'mat'),
 ...]
```

Cada par (central, contexto) numa janela é um exemplo de treino positivo.

### Passo 2: tabelas de embedding

Duas matrizes. `W` é a tabela de embedding de palavra central (a que você mantém). `W'` é a tabela de palavra de contexto (frequentemente descartada, às vezes média com `W`).

```python
import numpy as np


def init_embeddings(vocab_size, dim, seed=0):
    rng = np.random.default_rng(seed)
    W = rng.normal(0, 0.1, size=(vocab_size, dim))
    W_prime = rng.normal(0, 0.1, size=(vocab_size, dim))
    return W, W_prime
```

Inicialização aleatória pequena. Tamanho de vocabulário 10k e dim 100 é realista; pra ensino, 50 vocab x 16 dim é suficiente pra ver a geometria.

### Passo 3: objetivo de negative sampling

Pra cada par positivo `(central, contexto)`, amostra `k` palavras aleatórias do vocabulário como negativas. Treina o modelo pra que o produto escalar `W[central] · W'[contexto]` seja alto pra positivos e baixo pra negativos.

```python
def sigmoid(x):
    return 1.0 / (1.0 + np.exp(-np.clip(x, -20, 20)))


def train_pair(W, W_prime, center_idx, context_idx, negative_indices, lr):
    v_c = W[center_idx]
    u_pos = W_prime[context_idx]
    u_negs = W_prime[negative_indices]

    pos_score = sigmoid(v_c @ u_pos)
    neg_scores = sigmoid(u_negs @ v_c)

    grad_center = (pos_score - 1) * u_pos
    for i, u in enumerate(u_negs):
        grad_center += neg_scores[i] * u

    W[context_idx] = W[context_idx]
    W_prime[context_idx] -= lr * (pos_score - 1) * v_c
    for i, neg_idx in enumerate(negative_indices):
        W_prime[neg_idx] -= lr * neg_scores[i] * v_c
    W[center_idx] -= lr * grad_center
```

A fórmula mágica: perda logística no par positivo (quer sigmoid perto de 1) mais perda logística nos pares negativos (quer sigmoid perto de 0). Gradientes fluem pra ambas as tabelas. A derivação completa está no paper original; percorra uma vez com lápis e papel se quiser gravar.

### Passo 4: treinar num corpus de brinquedo

```python
def train(docs, dim=16, window=2, k_neg=5, epochs=100, lr=0.05, seed=0):
    vocab = build_vocab(docs)
    vocab_size = len(vocab)
    rng = np.random.default_rng(seed)
    W, W_prime = init_embeddings(vocab_size, dim, seed=seed)
    pairs = skipgram_pairs(docs, window=window)

    for epoch in range(epochs):
        rng.shuffle(pairs)
        for center, context in pairs:
            c_idx = vocab[center]
            ctx_idx = vocab[context]
            negs = rng.integers(0, vocab_size, size=k_neg)
            negs = [n for n in negs if n != ctx_idx and n != c_idx]
            train_pair(W, W_prime, c_idx, ctx_idx, negs, lr)
    return vocab, W
```

Depois de epochs suficientes num corpus grande, palavras que compartilham contextos têm embeddings centrais similares. Num corpus de brinquedo, você vê o efeito sutilmente. Em bilhões de tokens, vê dramaticamente.

### Passo 5: o truque da analogia

```python
def nearest(vocab, W, target_vec, topk=5, exclude=None):
    exclude = exclude or set()
    inv_vocab = {i: w for w, i in vocab.items()}
    norms = np.linalg.norm(W, axis=1, keepdims=True) + 1e-9
    W_norm = W / norms
    target = target_vec / (np.linalg.norm(target_vec) + 1e-9)
    sims = W_norm @ target
    order = np.argsort(-sims)
    out = []
    for i in order:
        if i in exclude:
            continue
        out.append((inv_vocab[i], float(sims[i])))
        if len(out) == topk:
            break
    return out


def analogy(vocab, W, a, b, c, topk=5):
    v = W[vocab[b]] - W[vocab[a]] + W[vocab[c]]
    return nearest(vocab, W, v, topk=topk, exclude={vocab[a], vocab[b], vocab[c]})
```

Em vetores Google News 300d pré-treinados:

```python
>>> analogy(vocab, W, "man", "king", "woman")
[('queen', 0.71), ('monarch', 0.62), ('princess', 0.59), ...]
```

`king - man + woman = queen`. Não porque o modelo sabe o que é realeza. Porque o vetor `(king - man)` captura algo como "real", e somar com `woman` cai perto da região feminina real.

## Usando

Escrever Word2Vec do zero é didático. NLP de produção usa `gensim`.

```python
from gensim.models import Word2Vec

sentences = [
    ["the", "cat", "sat", "on", "the", "mat"],
    ["the", "dog", "ran", "across", "the", "room"],
]

model = Word2Vec(
    sentences,
    vector_size=100,
    window=5,
    min_count=1,
    sg=1,
    negative=5,
    workers=4,
    epochs=30,
)

print(model.wv["cat"])
print(model.wv.most_similar("cat", topn=3))
```

Pro trabalho real, você quase nunca treina Word2Vec. Baixa vetores pré-treinados.

- **GloVe** — abordagem de fatorização de matriz de co-ocorrência da Stanford. Checkpoints 50d, 100d, 200d, 300d. Boa cobertura geral. Lição 04 cobre GloVe especificamente.
- **fastText** — extensão Word2Vec do Facebook que embedda n-gramas de caracteres. Lida com palavras fora do vocabulário compondo subpalavras. Lição 04.
- **Word2Vec pré-treinado no Google News** — 300d, vocabulário de 3M palavras, publicado em 2013. Ainda baixado diariamente.

### Quando Word2Vec ainda ganha em 2026

- Busca leve de domínio específico. Treina em resumos médicos numa hora num laptop, ganha vetores especializados que nenhum modelo geral captura.
- Engenharia de features no estilo analogia. `vetor_gênero = média(pares man - woman)`. Subtraia de outras palavras pra obter um eixo neutro de gênero. Ainda usado em pesquisas de equidade.
- Interpretabilidade. 100d é pequeno o suficiente pra plotar via PCA ou t-SNE e ver clusters se formarem de verdade.
- Qualquer lugar onde inferência tenha que rodar em dispositivo sem GPU. Lookup de Word2Vec é uma única busca de linha.

### Onde Word2Vec falha

A parede da polissemia. `bank` tem um vetor. `river bank` e `financial bank` compartilham. `table` (planilha vs. móvel) compartilha. Um classificador downstream não distingue os sentidos pelo vetor.

Embeddings contextuais (ELMo, BERT, todo transformer desde então) resolveram isso produzindo um vetor diferente pra cada ocorrência da palavra baseado no contexto ao redor. Esse é o salto de Word2Vec pra BERT: de estático pra contextual. A Fase 7 cobre a metade do transformer.

O problema de palavras fora do vocabulário é a outra falha. Word2Vec nunca viu `Zoomer-approved` se não estava nos dados de treino. Sem fallback. FastText corrige com composição de subpalavras (lição 04).

## Entregando

Salve como `outputs/skill-embedding-probe.md`:

```markdown
---
name: embedding-probe
description: Inspect a word2vec model. Run analogies, find neighbors, diagnose quality.
version: 1.0.0
phase: 5
lesson: 03
tags: [nlp, embeddings, debugging]
---

You probe trained word embeddings to verify they are working. Given a `gensim.models.KeyedVectors` object and a vocabulary, you run:

1. Three canonical analogy tests. `king : man :: queen : woman`. `paris : france :: tokyo : japan`. `walking : walked :: swimming : ?`. Report the top-1 result and its cosine.
2. Five nearest-neighbor tests on domain-specific words the user supplies. Print top-5 neighbors with cosines.
3. One symmetry check. `similarity(a, b) == similarity(b, a)` to within float precision.
4. One degenerate check. If any embedding has a norm below 0.01 or above 100, the model has a training bug. Flag it.

Refuse to declare a model good on analogy accuracy alone. Analogy benchmarks are gameable and do not transfer to downstream tasks. Recommend intrinsic + downstream evaluation together.
```

## Exercícios

1. **Fácil.** Roda o loop de treino num corpus minúsculo (20 frases sobre gatos e cachorros). Depois de 200 epochs, verifique que `nearest(vocab, W, W[vocab["cat"]])` retorna `dog` nos top 3. Se não, aumente epochs ou vocabulário.
2. **Médio.** Adicione subsampling de palavras frequentes. Palavras com frequência acima de `10^-5` são removidas dos pares de treino com probabilidade proporcional à frequência. Meça o efeito na similaridade de palavras raras.
3. **Difícil.** Treine um modelo no corpus 20 Newsgroups. Calcule dois eixos de viés: `he - she` e `doctor - nurse`. Projete palavras de ocupação em ambos eixos. Relate quais ocupações têm a maior lacuna de viés. Esse é o tipo de probe que pesquisadores de equidade usam.

## Termos Chave

| Termo | O que a gente diz | O que realmente significa |
|------|-----------------|-----------------------|
| Word embedding | Palavra como vetor | Representação densa, baixa dimensão (tipicamente 100-300) aprendida de contexto. |
| Skip-gram | Truque do Word2Vec | Prevê palavras de contexto a partir da palavra central. Mais lento que CBOW, melhor pra palavras raras. |
| Negative sampling | Atalho de treino | Substitui softmax sobre vocabulário completo por classificação binária contra `k` palavras aleatórias. |
| Embedding estático | Um vetor por palavra | Mesmo vetor independente do contexto. Falha em polissemia. |
| Embedding contextual | Vetor sensível ao contexto | Vetor diferente pra cada ocorrência baseado nas palavras ao redor. O que transformers produzem. |
| OOV | Fora do vocabulário | Palavra nunca vista no treino. Word2Vec não consegue vetor pra essas. |

## Leitura Complementar

- [Mikolov et al. (2013). Distributed Representations of Words and Phrases and their Compositionality](https://arxiv.org/abs/1310.4546) — o paper de negative sampling. Curto e legível.
- [Rong, X. (2014). word2vec Parameter Learning Explained](https://arxiv.org/abs/1411.2738) — a derivação mais clara das gradientes, se a matemática do paper original parece densa.
- [gensim Word2Vec tutorial](https://radimrehurek.com/gensim/models/word2vec.html) — configurações de treino de produção que realmente funcionam.
