# Resumo de Texto

> Sistemas extrativos dizem o que o documento disse. Sistemas abstrativos dizem o que o autor quis dizer. Tarefas diferentes, armadilhas diferentes.

**Tipo:** Construção
**Linguagens:** Python
**Pré-requisitos:** Fase 5 · 02 (BoW + TF-IDF), Fase 5 · 11 (Tradução Automatizada)
**Tempo:** ~75 minutos

## O Problema

Uma notícia de 2.000 palavras cai no seu feed. Você precisa de 120 palavras que capturem. Você pode escolher as três frases mais importantes do artigo (extrativo) ou reescrever o conteúdo com suas próprias palavras (abstrativo). Ambos se chamam resumo. São problemas completamente diferentes.

Resumo extrativo é um problema de ranking. Pontua cada frase, retorna as top-`k`. A saída é sempre gramatical porque é copiada verbatim. O risco é perder conteúdo distribuído pelo artigo.

Resumo abstrativo é um problema de geração. Um transformer produz novo texto condicionado na entrada. A saída é fluida e comprimida mas pode alucinar fatos que não estavam na fonte. O risco é fabricação confiante.

Essa lição constrói ambos, com o modo de falha que cada um tem.

## O Conceito

![TextRank extrativo vs. transformer abstrativo](../assets/summarization.svg)

**Extrativo.** Trata o artigo como um grafo onde nós são frases e arestas são similaridades. Roda PageRank (ou algo parecido) sobre o grafo pra pontuar frases por quão conectadas estão com tudo mais. Frases de maior pontuação são o resumo. A implementação canônica é **TextRank** (Mihalcea e Tarau, 2004).

**Abstrativo.** Fine-tune um transformer encoder-decoder (BART, T5, Pegasus) em pares documento-resumo. Em inferência, o modelo lê o documento e gera o resumo token por token via cross-attention. Pegasus particularmente usa um objetivo de pre-treinamento com gap-sentences que o torna excelente em resumo sem muito fine-tuning.

Avaliação com **ROUGE** (Recall-Oriented Understudy for Gisting Evaluation). ROUGE-1 e ROUGE-2 pontuam sobreposição de unigramas e bigramas. ROUGE-L pontua subsequência comum mais longa. Maior é melhor mas 40 ROUGE-L é "bom" e 50 é "excepcional." Todo paper reporta os três. Use o pacote `rouge-score`.

## Construindo

### Passo 1: TextRank (extrativo)

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

Duas coisas que vale nomear. A função de similaridade usa sobreposição de palavras normalizada com log, que é a variante original do TextRank. Cosseno de vetores TF-IDF também funciona. O fator de amortecimento 0.85 e contagem de iterações são os padrões do PageRank.

### Passo 2: abstrativo com BART

```python
from transformers import pipeline

summarizer = pipeline("summarization", model="facebook/bart-large-cnn")

article = """(long news article text)"""

summary = summarizer(article, max_length=120, min_length=60, do_sample=False)
print(summary[0]["summary_text"])
```

BART-large-CNN é fine-tunado no corpus CNN/DailyMail. Gera resumos estilo notícias de cara. Pra outros domínios (papers científicos, diálogo, jurídico), use o checkpoint Pegasus correspondente ou fine-tune nos seus dados alvo.

### Passo 3: avaliação com ROUGE

```python
from rouge_score import rouge_scorer

scorer = rouge_scorer.RougeScorer(["rouge1", "rouge2", "rougeL"], use_stemmer=True)
scores = scorer.score(reference_summary, generated_summary)
print({k: round(v.fmeasure, 3) for k, v in scores.items()})
```

Sempre use stemming. Sem ele, "running" e "run" contam como palavras diferentes e ROUGE subconta.

### Além do ROUGE (avaliação de resumo em 2026)

ROUGE foi a métrica dominante de resumo por vinte anos e é insuficiente por si só em 2026. Uma meta-análise em larga escala de papers de NLG mostrou:

- **BERTScore** (similaridade de embedding contextual) ganhou espaço até 2023 e agora é reportado junto com ROUGE na maioria dos papers de resumo.
- **BARTScore** trata avaliação como geração: pontua o resumo por quão provável um BART pré-treinado o atribui dado a fonte.
- **MoverScore** (Distância do Transporte Terrestre sobre embeddings contextuais) chegou ao topo em benchmarks de resumo de 2025 porque captura sobreposição semântica melhor que ROUGE.
- **FactCC** e **fidelidade baseada em QA** eram comuns de 2021-2023, agora frequentemente substituídos por **G-Eval** (cadeia de prompts GPT-4 que pontua coerência, consistência, fluência e relevância com raciocínio Chain of Thought).
- **G-Eval** e abordagens similares de LLM-como-julgador combinam com julgamento humano ~80% das vezes quando roteiros são bem projetados.

Recomendação de produção: reporte ROUGE-L pra comparação legada, BERTScore pra sobreposição semântica, G-Eval pra coerência e factualidade. Calibre contra 50-100 resumos rotulados por humanos.

### Passo 4: o problema de factualidade

Resumos abstrativos são propensos a alucinação. Resumos extrativos carregam risco muito menor de alucinação porque a saída é copiada da fonte, embora possam ainda enganar se frases da fonte são descontextualizadas, desatualizadas ou citadas fora de ordem. Essa é a maior razão pela qual sistemas de produção ainda preferem métodos extrativos pra conteúdo de proximidade com conformidade.

Tipos de alucinação pra nomear:

- **Troca de entidade.** Fonte diz "John Smith." Resumo diz "John Brown."
- **Deriva numérica.** Fonte diz "25,000." Resumo diz "25 milhões."
- **Inversão de polaridade.** Fonte diz "rejeitou a oferta." Resumo diz "aceitou a oferta."
- **Invenção de fato.** Fonte não menciona o CEO. Resumo diz que o CEO aprovou.

Abordagens de avaliação que funcionam:

- **FactCC.** Um classificador binário treinado em implicação entre frase da fonte e frase do resumo. Prevê factual/não-factual.
- **Fidelidade baseada em QA.** Faz perguntas a um modelo de QA cujas respostas estão na fonte. Se o resumo suporta respostas diferentes, sinalize.
- **F1 por entidade.** Compara entidades nomeadas na fonte vs. resumo. Entidades presentes só no resumo são suspeitas.

Pra qualquer coisa visível ao usuário onde factualidade importa (notícias, médicos, jurídico, financeiro), extrativo é o padrão mais seguro. Abstrativo precisa de verificação de factualidade no loop.

## Usando

Stack de 2026:

| Caso de uso | Recomendado |
|---------|-------------|
| Notícias, resumo de 3-5 frases, inglês | `facebook/bart-large-cnn` |
| Papers científicos | `google/pegasus-pubmed` ou um T5 ajustado |
| Multi-documento, formato longo | Qualquer LLM com 32k+ contexto, promptado |
| Resumo de diálogo | `philschmid/bart-large-cnn-samsum` |
| Extrativo, baixo risco de alucinação por construção | TextRank ou LSA / LexRank do `sumy` |

LLMs com contexto longo frequentemente batem modelos eespecificaçãoializados em 2026 quando compute não é restrição. O tradeoff é custo e reprodutibilidade; modelos eespecificaçãoializados dão saídas mais consistentes.

## Entregando

Salve como `outputs/skill-summary-picker.md`:

```markdown
---
name: summary-picker
description: Pick extractive or abstractive, named library, factuality check.
version: 1.0.0
phase: 5
lesson: 12
tags: [nlp, summarization]
---

Given a task (document type, conformidade requirement, length, compute budget), output:

1. Approach. Extractive or abstractive. Explain in one sentence why.
2. Starting model / library. Name it. `sumy.TextRankSummarizer`, `facebook/bart-large-cnn`, `google/pegasus-pubmed`, or an LLM prompt.
3. Evaluation plan. ROUGE-1, ROUGE-2, ROUGE-L (use rouge-score with stemming). Plus factuality check if abstractive.
4. One failure mode to probe. Entity swap is the most common in abstractive news summarization; flag samples where source entities do not appear in summary.

Refuse abstractive summarization for medical, legal, financial, or regulated content without a factuality gate. Flag input over the model's context window as needing chunked map-reduce summarization (not just truncation).
```

## Exercícios

1. **Fácil.** Rode TextRank em 5 notícias. Compare as 3 frases top com um resumo de referência. Meça ROUGE-L. Você deve ver 30-45 ROUGE-L em artigos estilo CNN/DailyMail.
2. **Médio.** Implemente factualidade por entidade: extraia entidades nomeadas de fonte e resumo (spaCy), calcule recall das entidades da fonte no resumo e precisão das entidades do resumo contra a fonte. Alta precisão e baixo recall significam seguro mas conciso; baixa precisão significa entidades alucinadas.
3. **Difícil.** Compare BART-large-CNN contra um LLM (Claude ou GPT-4) em 50 artigos CNN/DailyMail. Reporte ROUGE-L, factualidade (por F1 de entidade), e custo por resumo. Documente onde cada um ganha.

## Termos Chave

| Termo | O que a gente diz | O que realmente significa |
|------|-----------------|-----------------------|
| Extrativo | Escolher frases | Retorna frases verbatim da fonte. Nunca alucina. |
| Abstrativo | Reescrever | Gera novo texto condicionado na fonte. Pode alucinar. |
| ROUGE | Métrica de resumo | Sobreposição de n-grama / LCS entre saída do sistema e referência. |
| TextRank | Extrativo baseado em grafo | PageRank sobre grafo de similaridade de frases. |
| Fetalidade | Está certo? | Se afirmações do resumo são suportadas pela fonte. |
| Alucinação | Conteúdo inventado | Conteúdo no resumo que a fonte não suporta. |

## Leitura Complementar

- [Mihalcea and Tarau (2004). TextRank: Bringing Order into Texts](https://aclanthology.org/W04-3252/) — o paper canônico extrativo.
- [Lewis et al. (2019). BART: Denoising Sequence-to-Sequence Pre-training](https://arxiv.org/abs/1910.13461) — o paper BART.
- [Zhang et al. (2019). PEGASUS: Pre-training with Extracted Gap-sentences](https://arxiv.org/abs/1912.08777) — Pegasus e o objetivo gap-sentences.
- [Lin (2004). ROUGE: A Package for Automatic Evaluation of Summaries](https://aclanthology.org/W04-1013/) — paper ROUGE.
- [Maynez et al. (2020). On Faithfulness and Factuality in Abstractive Summarization](https://arxiv.org/abs/2005.00661) — o paper do cenário de factualidade.
