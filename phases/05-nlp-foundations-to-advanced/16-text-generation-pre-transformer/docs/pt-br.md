# Geração de Texto Antes de Transformers — Modelos de Linguagem N-gram

> Se uma palavra é surpreendente, o modelo é ruim. Perplexidade transforma surpresa em número. Suavização mantém finita.

**Tipo:** Construção
**Linguagens:** Python
**Pré-requisitos:** Fase 5 · 01 (Processamento de Texto), Fase 2 · 14 (Naive Bayes)
**Tempo:** ~45 minutos

## O Problema

Antes de transformers, antes de RNNs, antes de word embeddings, um modelo de linguagem previa a próxima palavra contando quantas vezes ela seguia as `n-1` palavras anteriores. Conta "the cat" → "sat" 47 vezes, "the cat" → "jumped" 12 vezes, "the cat" → "refrigerator" 0 vezes. Normaliza pra obter distribuição de probabilidade.

Esse é um modelo de linguagem n-gram. Rodou todo reconhecedor de fala, todo verificador ortográfico e todo sistema de tradução automatizada baseado em frases de 1980 até 2015. Ainda roda quando você precisa de modelagem de linguagem barata em dispositivo.

O problema interessante é o que fazer com n-gramas não vistos. Um modelo baseado em contagem bruta atribui probabilidade zero a qualquer coisa que não viu, o que é catastrófico porque frases são longas e quase toda frase longa contém pelo menos uma sequência não vista. Cinquenta anos de pesquisa em suavização corrigiram isso. Suavização Kneser-Ney é o resultado, e deep learning moderno herdou sua tradição empírica.

## O Conceito

![Modelo n-gram: contar, suavizar, gerar](../assets/ngram.svg)

**Probabilidade n-gram:** `P(w_i | w_{i-n+1}, ..., w_{i-1})`. Fixa `n` (tipicamente 3 pra trigramas, 4 pra 4-gramas). Calcula a partir de contagens:

```text
P(w | context) = count(context, w) / count(context)
```

**O problema de contagem zero.** Qualquer n-grama não visto no treino ganha probabilidade zero. Um estudo de 2007 no corpus Brown mostrou que mesmo um modelo de 4-grama tinha 30% dos 4-gramas de teste não vistos no treino. Você não consegue avaliar em qualquer texto real sem suavização.

**Abordagens de suavização, em ordem de sofisticação:**

1. **Laplace (adicionar-um).** Adiciona 1 a cada contagem. Simples, péssimo em eventos raros.
2. **Good-Turing.** Redistribui massa de probabilidade de eventos de maior frequência pra não vistos baseado em frequência-de-frequências.
3. **Interpolação.** Combina estimativas de n-grama, (n-1)-grama, etc., com pesos ajustáveis.
4. **Backoff.** Se n-grama tem contagem zero, cai no (n-1)-grama. Katz backoff normaliza isso.
5. **Desconto absoluto.** Subtrai um desconto fixo `D` de todas as contagens, redistribui pra não vistos.
6. **Kneser-Ney.** Desconto absoluto mais uma escolha clever pro modelo de ordem inferior: usa *probabilidade de continuação* (em quantos contextos uma palavra aparece) em vez de frequência bruta.

O insight do Kneser-Ney é profundo. "San Francisco" é um bigrama comum. Unigrama "Francisco" aparece quase sempre depois de "San". Desconto absoluto ingênuo dá a "Francisco" alta probabilidade unigrama (porque a contagem é alta). Kneser-Ney nota que "Francisco" aparece em apenas um contexto e reduz sua probabilidade de continuação de acordo. Resultado: um bigrama novo terminando em "Francisco" ganha a baixa probabilidade apropriada.

**Avaliação: perplexidade.** O expoente da média de log-verossimilhança negativa por palavra num conjunto de teste de teste. Menor é melhor. Perplexidade de 100 significa que o modelo está tão confuso quanto escolhendo uniformemente entre 100 palavras.

```text
perplexity = exp(- (1/N) * Σ log P(w_i | context_i))
```

## Construindo

### Passo 1: contagens de trigramas

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

Entrada é lista de frases tokenizadas. Saída são contagens de n-grama e contagens de contexto. `<s>` e `</s>` são limites de frase.

### Passo 2: suavização Laplace

```python
def laplace_probability(ngrams, contexts, vocab_size, context, word):
    ctx = tuple(context)
    numerator = ngrams.get(ctx + (word,), 0) + 1
    denominator = contexts.get(ctx, 0) + vocab_size
    return numerator / denominator
```

Adiciona 1 a cada contagem. Suaviza mas sobrealoca massa pra eventos não vistos, prejudicando eventos raros conhecidos também.

### Passo 3: Kneser-Ney (bigrama, interpolado)

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

Três peças móveis. `continuation_prob` captura "em quantos contextos diferentes esta palavra aparece?" (a inovação Kneser-Ney). `lambda_prev` é a massa liberada pelo desconto, usada pra ponderar o backoff. A probabilidade final é o termo principal descontado mais o termo de continuação ponderado.

### Passo 4: gerar texto com amostragem

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

Amostragem proporcional à probabilidade. Sempre dá saída diferente por seed. Pra saída estilo beam search, escolhe argmax a cada passo (guloso) e adiciona um parâmetro de aleatoriedade pequeno (temperatura).

### Passo 5: perplexidade

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

Menor é melhor. Pro corpus Brown, um modelo 4-gram KN bem ajustado atinge perplexidade em torno de 140. Um LM transformer atinge 15-30 no mesmo conjunto de teste. A lacuna é cerca de 10x. Essa lacuna é por que o campo seguiu em frente.

## Usando

- **Ensino de NLP clássico.** A exposição mais clara que você pode ter a suavização, MLE e perplexidade.
- **KenLM.** Biblioteca de n-gram pra produção. Usado como rescorer em sistemas de fala e MT onde baixa latência importa.
- **Autocomplete em dispositivo.** Modelos de trigramas em teclados. Ainda.
- **Baselines.** Sempre compute perplexidade de LM n-gram antes de declarar seu LM neural bom. Se seu transformer não supera KN por ampla margem, algo está errado.

## Entregando

Salve como `outputs/prompt-lm-baseline.md`:

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

Refuse to report perplexity computed with different tokenization between systems being compared — perplexity numbers are comparable only under identical tokenization. Flag OOV rate in test set; KN handles OOV poorly unless you reserve a especificaçãoial <UNK> token during training.
```

## Exercícios

1. **Fácil.** Treine um LM trigramas num corpus Shakespeare de 1.000 frases. Gere 20 frases. Vão ser localmente plausíveis mas globalmente incoerentes. Essa é a demonstração canônica.
2. **Médio.** Implemente perplexidade pro seu modelo KN num split Shakespeare de teste. Compare com Laplace. Você deve ver KN reduzir perplexidade em 30-50%.
3. **Difícil.** Construa um corretor ortográfico de trigramas: dado uma palavra mal escrita e seu contexto, gere correções e ranqueie por probabilidade de contexto sob o LM. Avalie no corpus Birkbeck de ortografia (público).

## Termos Chave

| Termo | O que a gente diz | O que realmente significa |
|------|-----------------|-----------------------|
| N-gram | Sequência de palavras | Sequência de `n` tokens consecutivos. |
| Suavização | Evitando zeros | Redistribui massa de probabilidade pra que eventos não vistos ganhem probabilidade não-zero. |
| Perplexidade | Métrica de qualidade de LM | `exp(-log-prob médio)` em dados de teste. Menor é melhor. |
| Backoff | Fallback pra contexto mais curto | Se contagem de trigramas é zero, usa bigrama. Katz backoff formaliza isso. |
| Kneser-Ney | Melhor suavização pra n-gramas | Desconto absoluto + probabilidade de continuação pro modelo de ordem inferior. |
| Probabilidade de continuação | Eespecificaçãoífico do KN | `P(w)` ponderado pelo número de contextos em que `w` aparece, não pela contagem bruta. |

## Leitura Complementar

- [Jurafsky and Martin — Speech and Language Processing, Chapter 3 (2026 draft)](https://web.stanford.edu/~jurafsky/slp3/3.pdf) — o tratamento canônico de LMs n-gram e suavização.
- [Chen and Goodman (1998). An Empirical Study of Smoothing Techniques for Language Modeling](https://dash.harvard.edu/handle/1/25104739) — o paper que estabeleceu Kneser-Ney como o melhor suavizador n-gram.
- [Kneser and Ney (1995). Improved Backing-off for M-gram Language Modeling](https://ieeexplore.ieee.org/document/479394) — o paper original KN.
- [KenLM](https://kheafield.com/code/kenlm/) — LM n-gram rápido pra produção, ainda usado em 2026 pra aplicações sensíveis a latência.
