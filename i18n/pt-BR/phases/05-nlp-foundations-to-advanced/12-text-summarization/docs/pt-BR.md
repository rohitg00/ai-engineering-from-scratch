# Resumo do texto

> Os sistemas de extracção dizem o que o documento disse, os sistemas abstractos dizem o que o autor queria dizer, diferentes tarefas, diferentes armadilhas.

**Type:** Build
**Languages:** Python, TypeScript
**Prerequisites:** Phase 5 · 02 (BoW + TF-IDF), Phase 5 · 11 (Machine Translation)
**Time:** ~75 minutes

## O problema

Um artigo de notícias de 2.000 palavras chega ao seu feed. Você precisa de 120 palavras que o capturem. Você pode escolher as três frases mais importantes do artigo (extrativa) ou reescrever o conteúdo em suas próprias palavras (abstrativa). Ambos são chamados de resumo.

A resumo extractivo é um problema de classificação.`k`O resultado é sempre gramatical porque é levantado literalmente. O risco é a falta de conteúdo que é distribuído em todo o artigo.

A resumo abstrato é um problema de geração. Um transformador produz um novo texto condicionado à entrada. A saída é fluente e compressora, mas pode alucinar fatos que não estavam na fonte. O risco é a fabricação confiante.

Esta lição constrói os dois, com o modo de falha de cada um.

## O conceito

![Extractive TextRank vs abstractive transformer](../assets/summarization.svg)

**Extractive.**Trate o artigo como um gráfico onde os nós são frases e as bordas são semelhanças. Exerça PageRank (ou algo parecido) sobre o gráfico para marcar frases por como elas estão conectadas a tudo o resto.**TextRank**(Mihalcea e Tarau, 2004).

**Abstractive.**Afinal, o modelo lê o documento e gera o resumo token-by-token através da atenção cruzada.

Avaliação com **ROUGE**(Recall-Oriented Understudy for Gisting Evaluation). ROUGE-1 e ROUGE-2 pontuação unigrama e bigrama se sobrepõem. ROUGE-L pontuação mais longa subsequência comum. Mais alto é melhor, mas 40 ROUGE-L é "bom" e 50 é "excepcional".`rouge-score`- O pacote.

```figure
summarize-collapse
```

## Construí-lo

### Passo 1: TextRank (extração)

```python
import math
import re
from collections import Counter


def sentence_split(text):
    return re.split(r"(?<=[.!?])\s+", text.strip())


def similarity(s1, s2):
    w1 = Counter(s1.lower().split())
    w2 = Counter(s2.lower().split())
    intersection = sum((w1 & w2).values())
    denom = math.log(len(w1) + 1) + math.log(len(w2) + 1)
    if denom == 0:
        return 0.0
    return intersection / denom


def textrank(text, top_k=3, damping=0.85, iterations=50, epsilon=1e-4):
    sentences = sentence_split(text)
    n = len(sentences)
    if n <= top_k:
        return sentences

    sim = [[0.0] * n for _ in range(n)]
    for i in range(n):
        for j in range(n):
            if i != j:
                sim[i][j] = similarity(sentences[i], sentences[j])

    scores = [1.0] * n
    for _ in range(iterations):
        new_scores = [1 - damping] * n
        for i in range(n):
            total_out = sum(sim[i]) or 1e-9
            for j in range(n):
                if sim[i][j] > 0:
                    new_scores[j] += damping * sim[i][j] / total_out * scores[i]
        if max(abs(s - ns) for s, ns in zip(scores, new_scores)) < epsilon:
            scores = new_scores
            break
        scores = new_scores

    ranked = sorted(range(n), key=lambda k: scores[k], reverse=True)[:top_k]
    ranked.sort()
    return [sentences[i] for i in ranked]
```

Duas coisas que vale a pena nomear. A função de semelhança usa sobreposição de palavras normalizadas de log, que é a variante original do TextRank.

### Passo 2: abstracto com BART

```python
from transformers import pipeline

summarizer = pipeline("summarization", model="facebook/bart-large-cnn")

article = """(long news article text)"""

summary = summarizer(article, max_length=120, min_length=60, do_sample=False)
print(summary[0]["summary_text"])
```

O BART-large-CNN é ajustado no corpus da CNN/DailyMail. Ele produz resumos de estilo de notícias fora da caixa. Para outros domínios (revistas científicas, diálogo, jurídico), use o ponto de verificação Pegasus correspondente ou ajuste os dados de seu alvo.

### Passo 3: Avaliação ROUGE

```python
from rouge_score import rouge_scorer

scorer = rouge_scorer.RougeScorer(["rouge1", "rouge2", "rougeL"], use_stemmer=True)
scores = scorer.score(reference_summary, generated_summary)
print({k: round(v.fmeasure, 3) for k, v in scores.items()})
```

Sem ele, "correr" e "correr" contam como palavras diferentes e o ROUGE contam em baixo.

### Além do ROUGE (2026 avaliação de resumo)

A ROUGE tem sido a métrica de resumo dominante há vinte anos e é insuficiente por si só em 2026.

- **BERTScore**(similidade de inserção contextual) ganhou terreno até 2023 e é agora relatado ao lado de ROUGE na maioria dos documentos de resumo.
- **BARTScore**Tratar a avaliação como uma geração: avaliar o resumo com base na probabilidade de um BART pré-treinado atribuí-lo dada a fonte.
- **MoverScore**(Distança do Mover da Terra sobre embebimentos contextuais) alcançou o primeiro lugar em 2025 referências de resumo porque capta sobreposição semântica melhor do que ROUGE.
- **FactCC**E ...**QA-based faithfulness**foram comuns em 2021-2023, agora muitas vezes substituídas por **G-Eval**(uma cadeia de resposta GPT-4 que avalia a coerência, a consistência, a fluência, a relevância com o raciocínio da cadeia de pensamento).
- **G-Eval**e abordagens similares de LLM-juiz correspondem ao julgamento humano ~ 80% do tempo em que as rubricas são bem concebidas.

Recomendação de produção: relatório ROUGE-L para comparação de legado, BERTScore para sobreposição semântica, G-Eval para coerência e factualidade. Calibração em relação a 50-100 resumos etiquetados por humanos.

### Passo 4: o problema da factualidade

Os resumos abstractos são propensos a alucinação. Os resumos extrativos têm um risco de alucinação muito menor porque a saída é levantada literalmente da fonte, embora ainda possam enganar se as frases de origem são descontextualizadas, ultrapassadas ou citadas fora de ordem. Esta é a única maior razão pela qual os sistemas de produção ainda preferem métodos extrativos para conteúdo adjacente à conformidade.

Tipos de alucinação:

- **Entity swap.**A fonte diz "John Smith". O resumo diz "John Brown".
- **Number drift.**A fonte diz "25.000". O resumo diz "25 milhões".
- **Polarity flip.**A fonte diz que "recusou a oferta". O resumo diz que "aceitou a oferta".
- **Fact invention.**A fonte não menciona o CEO, mas diz que o CEO aprovou.

As abordagens de avaliação são:

- **FactCC.**Um classificador binário treinado em relação entre frase fonte e frase resumida.
- **QA-based factuality.**Faça perguntas a um modelo de QA cujas respostas estão na fonte.
- **Entity-level F1.**Compare entidades nomeadas na fonte versus resumo.

Para qualquer coisa que esteja voltada ao usuário onde a factualidade seja importante (noticias, médicos, legais, financeiros), a extração é a defesa mais segura.

## Usá-lo

A pilha de 2026:

| Use case | Recommended |
|---------|-------------|
| News, 3-5 sentence summary, English | `facebook/bart-large-cnn` |
| Scientific papers | `google/pegasus-pubmed` or a tuned T5 |
| Multi-document, long-form | Any LLM with 32k+ context, prompted |
| Dialog summarization | `philschmid/bart-large-cnn-samsum` |
| Extractive, low hallucination risk by construction | TextRank or `sumy`'s LSA / LexRank |

Os LLM com longo contexto geralmente superam os modelos especializados em 2026 quando a computação não é uma restrição.

## Envia-o

Salva como`outputs/skill-summary-picker.md`- Não .

```markdown
---
name: summary-picker
description: Pick extractive or abstractive, named library, factuality check.
version: 1.0.0
phase: 5
lesson: 12
tags: [nlp, summarization]
---

Given a task (document type, compliance requirement, length, compute budget), output:

1. Approach. Extractive or abstractive. Explain in one sentence why.
2. Starting model / library. Name it. `sumy.TextRankSummarizer`, `facebook/bart-large-cnn`, `google/pegasus-pubmed`, or an LLM prompt.
3. Evaluation plan. ROUGE-1, ROUGE-2, ROUGE-L (use rouge-score with stemming). Plus factuality check if abstractive.
4. One failure mode to probe. Entity swap is the most common in abstractive news summarization; flag samples where source entities do not appear in summary.

Refuse abstractive summarization for medical, legal, financial, or regulated content without a factuality gate. Flag input over the model's context window as needing chunked map-reduce summarization (not just truncation).
```

## Exercícios

1. **Easy.**Exerça o TextRank em 5 artigos de notícias. Compare as três principais frases com um resumo de referência. Mese ROUGE-L. Você deve ver 30-45 ROUGE-L em artigos de estilo CNN / DailyMail.
2. **Medium.**Implementar factualidade a nível da entidade: extrair entidades nomeadas da fonte e resumo (spaCy), recuperar computacional das entidades fontes em resumo e precisão das entidades resumidas contra a fonte.
3. **Hard.**Compare o BART-Grande-CNN com um LLM (Claude ou GPT-4) em 50 artigos da CNN/DailyMail.

## Termos-chave

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| Extractive | Pick sentences | Return sentences verbatim from the source. Never hallucinates. |
| Abstractive | Rewrite | Generate new text conditioned on source. Can hallucinate. |
| ROUGE | Summary metric | N-gram / LCS overlap between system output and reference. |
| TextRank | Graph-based extractive | PageRank over sentence similarity graph. |
| Factuality | Is it right | Whether summary claims are supported by the source. |
| Hallucination | Made-up content | Content in the summary that the source does not support. |

## Mais leitura

- [Mihalcea and Tarau (2004). TextRank: Bringing Order into Texts](https://aclanthology.org/W04-3252/) o papel canônico extractivo.
- [Lewis et al. (2019). BART: Denoising Sequence-to-Sequence Pre-training](https://arxiv.org/abs/1910.13461)O papel BART.
- [Zhang et al. (2019). PEGASUS: Pre-training with Extracted Gap-sentences](https://arxiv.org/abs/1912.08777) Pegasus e o objectivo da frase de diferença.
- [Lin (2004). ROUGE: A Package for Automatic Evaluation of Summaries](https://aclanthology.org/W04-1013/)Papel vermelho.
- [Maynez et al. (2020). On Faithfulness and Factuality in Abstractive Summarization](https://arxiv.org/abs/2005.00661) o papel de paisagem de facto.
