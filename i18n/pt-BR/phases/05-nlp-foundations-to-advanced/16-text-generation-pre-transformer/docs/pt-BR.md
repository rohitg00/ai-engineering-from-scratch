# Geração de texto antes dos transformadores  Modelos de linguagem N-gram

> Se uma palavra é surpreendente, o modelo é ruim. A perplexidade torna surpresa um número.

**Type:** Build
**Languages:** Python, TypeScript
**Prerequisites:** Phase 5 · 01 (Text Processing), Phase 2 · 14 (Naive Bayes)
**Time:** ~45 minutes

## O problema

Antes dos transformadores, antes dos RNNs, antes das incorporações de palavras, um modelo de linguagem previu a próxima palavra contando a frequência com que ela seguiu a anterior `n-1`Conte "o gato" → "sede" 47 vezes, "o gato" → "saltou" 12 vezes, "o gato" → "frigerador" 0 vezes. Normalize para obter uma distribuição de probabilidade.

Este é um modelo de linguagem n-gram. Ele executou todos os reconhecedores de fala, todos os verificadores de ortografia e todos os sistemas de tradução automática baseados em frases de 1980 a 2015.

O problema interessante é o que fazer com n-gramas invisíveis. Um modelo baseado em contagem crua atribui probabilidade zero a qualquer coisa que não tenha visto, o que é catastrófico porque as frases são longas e quase todas as frases longas contêm pelo menos uma sequência invisível. Cinquenta anos de pesquisa de suavizagem fixaram isso.

## O conceito

![N-gram model: count, smooth, generate](../assets/ngram.svg)

### O jogo de previsão

Antes de qualquer uma dessas máquinas existir, um experimento definia o que é um modelo de linguagem. Cubra a próxima letra de uma frase inglesa. Peça a alguém para adivinhar, uma adivinha de cada vez, até que eles a consigam bem. Escreva a contagem de adivinhações. Repita por algumas centenas de letras.

As contagens de adivinhações não são triviais. São uma recodificação sem perda do texto: entregue a sequência de contagem a um segundo adivinhador idêntico e eles podem reconstruir cada letra, porque em cada posição eles sabem exatamente quais adivinhas são as primeiras. Uma mensagem que você pode recodificar em menos símbolos carrega menos informações por símbolo, então as estatísticas de contagem de adivinhações colocam um teto na entropia do inglês.

Shannon fez isto em 1951 e conseguiu um número que ainda governa o campo. Um alfabeto de 27 símbolos (26 letras mais espaço) poderia levar`log2(27) ≈ 4.75`Os adivinhadores humanos com 100 letras de contexto aterraram entre 0,6 e 1,3 bits por letra. Inglês é aproximadamente três quartos de movimentos forçados. A estrutura que um modelo deve aprender foi medida antes que qualquer modelo pudesse aprendê-lo.

Cada modelo de linguagem desde então é um jogador mecânico deste jogo, e cada número de avaliação nesta lição é o jogo marcado:

- **Cross-entropy loss**O treinamento de um LM é literalmente minimizar sua pontuação no jogo de adivinhação.
- **Perplexity**É o que é`2^bits`(ou `e^nats`O factor de ramificação ainda está diante do modelo após a sua conjectura.
- **Context length is the player's memory.**Um modelo de trigramas joga com dois tokens de memória. Um transformador joga o mesmo jogo com 100K tokens. As regras nunca mudaram; o jogador melhorou.

Uma unidade de rotação: as pontuações do jogo por letra em bits (`log2`), enquanto as fórmulas n-gram abaixo pontuação por palavra token em nats (log natural)  e desde perplexidade `e^H`em nats iguais `2^H`em bits, as duas visões são a mesma medida em unidades diferentes.

```figure
prediction-game
```

**N-gram probability:** `P(w_i | w_{i-n+1}, ..., w_{i-1})`- Corrigir .`n`(normalmente 3 para trigramas, 4 para 4 gramas).

```math
P(w \mid \text{context}) = \frac{\mathop{\mathrm{count}}(\text{context}, w)}{\mathop{\mathrm{count}}(\text{context})}
```

**The zero-count problem.**Qualquer n-gram não visto no treinamento recebe probabilidade zero. Um estudo de 2007 sobre o corpus de Brown descobriu que mesmo um modelo de 4 gramas tinha 30% de 4 gramas não vistos no treinamento.

**Smoothing approaches, in order of sophistication:**

1. **Laplace (add-one).**Adicionar um a cada contagem.
2. **Good-Turing.**Realocar a massa de probabilidade de eventos de alta frequência para os invisíveis com base na frequência de frequências.
3. **Interpolation.**Combinar n-gram, (n-1)-gram, etc., estimativas com pesos ajustáveis.
4. **Backoff.**Se n-gram tem contado zero, cair de volta para (n-1)-gram.
5. **Absolute discounting.**Subtrair um desconto fixo `D`De todas as contas, redistribuir para o invisível.
6. **Kneser-Ney.**Desconto absoluto mais uma escolha inteligente para o modelo de ordem inferior: usar * probabilidade de continuação* (quantos contextos uma palavra aparece) em vez de freqüência bruta.

A visão do Kneser-Ney é profunda. "San Francisco" é um bigrama comum. O unigrama "Francisco" aparece principalmente após "San". O desconto absoluto ingênuo dá a "Francisco" uma alta probabilidade de unigrama (porque a contagem é alta). A Kneser-Ney observa que o "Francisco" aparece apenas num contexto e reduz, em conformidade, a probabilidade de sua continuação. Resultado: um bigrama romântico terminando em "Francisco" obtém a probabilidade apropriada.

**Evaluation: perplexity.**O exponente da probabilidade média negativa de registro por palavra em um conjunto de testes prolongados. Baixo é melhor. Uma perplexidade de 100 significa que o modelo é tão confuso quanto ele escolheria uniformemente entre 100 palavras.

```math
\text{perplexity} = \exp\left(-\frac{1}{N} \sum_i \log P(w_i \mid \text{context}_i)\right)
```

```figure
ngram-backoff
```

## Construí-lo

### Passo 1: contagem de trigramas

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

A entrada é uma lista de frases tokenizadas. A saída é n-gram counts e contexts counts. `<s>`E ...`</s>`São limites de sentença.

### Passo 2: Limeamento de laplace

```python
def laplace_probability(ngrams, contexts, vocab_size, context, word):
    ctx = tuple(context)
    numerator = ngrams.get(ctx + (word,), 0) + 1
    denominator = contexts.get(ctx, 0) + vocab_size
    return numerator / denominator
```

Adiciona 1 a cada contagem, mas super-aloca massa para eventos invisíveis, prejudicando eventos raros também.

### Passo 3: Kneser-Ney (bigrama, interpolada)

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

Três partes móveis.`continuation_prob`"Quantos contextos diferentes esta palavra aparece?" (a inovação Kneser-Ney).`lambda_prev`A probabilidade final é o termo principal descontado mais o termo ponderado de continuação.

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

Amostragem proporcional à probabilidade. Sempre dá diferentes resultados por semente. Para resultados semelhantes a uma busca de feixe, escolha o argmax em cada passo (avididade) e adicione um pequeno botão de aleatoriedade (temperatura).

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

Para o corpus Brown, um modelo KN de 4 gramas bem ajustado atinge perplexidade em torno de 140. Um transformador LM atinge 15-30 no mesmo conjunto de teste. O gap é cerca de 10x. Esse gap é o motivo pelo qual o campo se movia.

## Usá-lo

- **Classical NLP teaching.**A exposição mais clara ao suavizamento, MLE e perplexidade que pode ter.
- **KenLM.**Biblioteca de produção n-gram. Utilizado como rescador em sistemas de fala e MT onde a baixa latência importa.
- **On-device autocomplete.**Modelos de trigramas nos teclados.
- **Baselines.**Sempre calcule uma perplexidade de LM de n gramas antes de declarar o seu LM neural bom.

## Envia-o

Salva como`outputs/prompt-lm-baseline.md`- Não .

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

## Exercícios

1. **Easy.**Treinar um trigrama LM num corpo de Shakespeare de 1.000 frases. Gerencie 20 frases. Serão plausíveis localmente mas globalmente incoerentes. Esta é a demonstração canônica.
2. **Medium.**Aplique perplexidade para o seu modelo KN em uma divisão Shakespeare prolongada. Comparar com Laplace. Você deve ver perplexidade KN menor por 30-50%.
3. **Hard.**Construir um corrector de ortografia de trigramas: dada uma palavra errada e seu contexto, gerar correções e classificar por probabilidade de contexto sob o LM. Avalie no corpus de ortografia Birkbeck (público).

## Termos-chave

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| N-gram | Word sequence | Sequence of `n` consecutive tokens. |
| Smoothing | Avoiding zeros | Reallocating probability mass so unseen events get non-zero probability. |
| Perplexity | LM quality metric | `exp(-average log-prob)` on held-out data. Lower is better. |
| Backoff | Fallback to shorter context | If trigram count is zero, use bigram. Katz backoff formalizes this. |
| Kneser-Ney | Best smoothing for n-grams | Absolute discounting + continuation probability for the lower-order model. |
| Continuation probability | KN-specific | `P(w)` weighted by number of contexts `w` appears in, not by raw count. |
| Entropy of text | Information per symbol | Average bits needed to encode the next symbol given the context. Shannon's 1951 estimate for printed English with up to 100 letters of context: 0.6-1.3 bits/letter, measured before any model existed. |

## Mais leitura

- [Shannon (1951). Prediction and Entropy of Printed English](https://www.princeton.edu/~wbialek/rome/refs/shannon_51.pdf) o experimento de adivinhação que definiu o alvo que cada modelo de linguagem ainda otimiza.
- [Jurafsky and Martin — Speech and Language Processing, Chapter 3 (2026 draft)](https://web.stanford.edu/~jurafsky/slp3/3.pdf) o tratamento canônico de N-gram LM e o suavização.
- [Chen and Goodman (1998). An Empirical Study of Smoothing Techniques for Language Modeling](https://dash.harvard.edu/handle/1/25104739)O papel que resolveu o Kneser-Ney como o melhor n-gram suave.
- [Kneser and Ney (1995). Improved Backing-off for M-gram Language Modeling](https://ieeexplore.ieee.org/document/479394) o papel KN original.
- [KenLM](https://kheafield.com/code/kenlm/) LM de produção rápida n-gram, ainda utilizado em 2026 para aplicações sensíveis à latência.
