# Inferência da linguagem natural  Envolvimento textual

> "t implica h" significa uma leitura humana t concluiria h é verdade. NLI é a tarefa de prever implicação / contradição / neutralidade.

**Type:** Learn
**Languages:** Python, TypeScript
**Prerequisites:** Phase 5 · 05 (Sentiment Analysis), Phase 5 · 13 (Question Answering)
**Time:** ~60 minutes

## O problema

Como é que sabe que o resumo não contém alucinações?

Construíste um chatbot e ele respondeu "sim". Como é que sabes que a resposta está apoiada pela passagem recuperada?

Precisas de classificar 10 mil artigos de notícias por tópico.

Os três problemas se reduzem à inferência da linguagem natural.`t`E uma hipótese.`h`, é `h`Consequências`t`, contraditório ou neutro (não relacionado)?

- **Hallucination check:** `t`= documento de origem, `h`Não implicação = alucinação.
- **Grounded QA:** `t`= passagem recuperada, `h`Não é a implicação que é a fabricação.
- **Zero-shot classification:** `t`= documento, `h`= etiqueta verbal ("É sobre esportes").

Uma tarefa, três usos de produção. É por isso que cada quadro de avaliação RAG envia um modelo NLI sob o capô.

## O conceito

![NLI: three-way classification, premise vs hypothesis](../assets/nli.svg)

**The three labels.**

- **Entailment.** `t`→ `h`"O gato está no tapete" significa "há um gato".
- **Contradiction.** `t`→`h`"O gato está no tapete" contradiz "Não há gato".
- **Neutral.**Não há nenhuma conclusão. "O gato está no tapete" é neutro para "O gato está com fome".

**Not logical entailment.**A NLI é uma inferência de linguagem natural que um leitor humano típico inferiria, não uma lógica rigorosa. "John walked his dog" implica "John has a dog" na NLI, mas a lógica rigorosa de primeira ordem só admitiria isso se você axiomatizar a posse.

**Datasets.**

- **SNLI**(2015). 570 mil pares de anúncios humanos, capções de imagem como premissas. Domínio estreito.
- **MultiNLI**O corpus de formação padrão em 2026.
- **ANLI**(2019). NLI adversário. Os seres humanos escreveram exemplos especificamente projetados para quebrar os modelos existentes.
- **DocNLI, ConTRoL**(202021). Pré-sistemas de comprimento de documento.

**The architecture.**Um codificador de transformador (BERT, RoBERTa, DeBERTa) lê `[CLS] premise [SEP] hypothesis [SEP]`- O .`[CLS]`A expressão de um modelo de referência é de 3 vias.

**Zero-shot via NLI.**Dado um documento e rótulos candidatos, transformar cada rótulo em uma hipótese ("Este texto é sobre esportes").`zero-shot-classification`- O gasoduto.

```figure
nli-router
```

## Construí-lo

### Passo 1: executar um modelo de NLI pré-treinado

```python
from transformers import pipeline

nli = pipeline("text-classification",
               model="facebook/bart-large-mnli",
               top_k=None)  # return all labels; replaces deprecated return_all_scores=True

premise = "The cat is sleeping on the couch."
hypothesis = "There is a cat in the room."

result = nli({"text": premise, "text_pair": hypothesis})[0]
print(result)
# [{'label': 'entailment', 'score': 0.97},
#  {'label': 'neutral', 'score': 0.02},
#  {'label': 'contradiction', 'score': 0.01}]
```

Para as NLI de produção, `facebook/bart-large-mnli`E ...`MoritzLaurer/DeBERTa-v3-large-mnli-fever-anli-ling-wanli`O DeBERTa-V3 está no topo das listas de classificação.

### Passo 2: classificação de tiro zero

```python
zs = pipeline("zero-shot-classification", model="facebook/bart-large-mnli")

text = "The stock market rallied after the central bank cut interest rates."
labels = ["finance", "sports", "politics", "technology"]

result = zs(text, candidate_labels=labels)
print(result)
# {'labels': ['finance', 'politics', 'technology', 'sports'],
#  'scores': [0.92, 0.05, 0.02, 0.01]}
```

O modelo é "Este exemplo é sobre {etiqueta}." por padrão.`hypothesis_template`Não é preciso dados de treinamento, não é preciso ajustar, funciona de fora do caixa.

### Passo 3: Verificação de fidelidade para RAG

```python
def is_faithful(answer, context, threshold=0.5):
    result = nli({"text": context, "text_pair": answer})[0]
    entail = next(s for s in result if s["label"] == "entailment")
    return entail["score"] > threshold
```

Esta é a base da fidelidade do RAGAS. Divida a resposta gerada em reivindicações atômicas. Verifique cada reivindicação contra o contexto recuperado.

### Passo 4: classificador de NLI laminado à mão (concepcional)

Veja .`code/main.py`Para um brinquedo apenas com um limite de limite: a premissa e a hipótese são comparadas através de sobreposição léxica + detecção de negação. Não competitivo com modelos transformadores  mas mostra a forma da tarefa: dois textos dentro, rotulagem de três vias, perda = entropia cruzada sobre `{entail, contradict, neutral}`- Não .

## Encurralagens

- **Hypothesis-only shortcuts.**Os modelos podem prever o rótulo apenas a partir da hipótese em ~60% no SNLI porque "não", "ninguém", "nunca" correlacionam com contradição.
- **Lexical overlap heuristic.**A heurística de subsequência ("cada subsequência é implicada") passa SNLI mas não HANS/ANLI.
- **Document-length degradation.**Os modelos de NLI de uma frase soltam 20+ F1 em instalações de comprimento de documento.
- **Zero-shot template sensitivity.**"Este exemplo é sobre {label}" vs "{label}" vs "O tópico é {label}" pode oscilar precisão por 10+ pontos.
- **Domain mismatch.**O MNLI treina em inglês geral. O texto jurídico, médico e científico precisa de modelos NLI específicos de domínio (por exemplo, SciNLI, MedNLI).

## Usá-lo

A pilha de 2026:

| Use case | Model |
|---------|-------|
| General-purpose NLI | `MoritzLaurer/DeBERTa-v3-large-mnli-fever-anli-ling-wanli` |
| Fast / edge | `cross-encoder/nli-deberta-v3-base` |
| Zero-shot classification (lightweight) | `facebook/bart-large-mnli` |
| Document-level NLI | `MoritzLaurer/DeBERTa-v3-large-mnli-fever-anli-ling-wanli` |
| Multilingual | `MoritzLaurer/multilingual-MiniLMv2-L6-mnli-xnli` |
| Hallucination detection in RAG | NLI layer inside RAGAS / DeepEval |

O 2026 meta-patrão: NLI é a fita adesiva da compreensão de texto. Sempre que você precisar de "A suporta B?" ou "A contradiz B?"  acessar NLI antes de chegar a outra chamada de LLM.

## Envia-o

Salva como`outputs/skill-nli-picker.md`- Não .

```markdown
---
name: nli-picker
description: Pick an NLI model, label template, and evaluation setup for a classification / faithfulness / zero-shot task.
version: 1.0.0
phase: 5
lesson: 21
tags: [nlp, nli, zero-shot]
---

Given a use case (faithfulness check, zero-shot classification, document-level inference), output:

1. Model. Named NLI checkpoint. Reason tied to domain, length, language.
2. Template (if zero-shot). Verbalization pattern. Example.
3. Threshold. Entailment cutoff for the decision rule. Reason based on calibration.
4. Evaluation. Accuracy on held-out labeled set, hypothesis-only baseline, adversarial subset.

Refuse to ship zero-shot classification without a 100-example labeled sanity check. Refuse to use a sentence-level NLI model on document-length premises. Flag any claim that NLI solves hallucination — it reduces it; it does not eliminate it.
```

## Exercícios

1. **Easy.**Corra .`facebook/bart-large-mnli`Em 20 triplos feitos à mão (pré-premissa, hipótese, rótulo) cobrindo as três classes. Messa a precisão. Adicione armadilhas adversárias "subseqüência heurística" ("Eu não comi o bolo" vs "Eu comi o bolo") e veja se ele rompe.
2. **Medium.**Compare o modelo de tiro zero `"This text is about {label}"`contra`"The topic is {label}"`E ...`"{label}"`100 cabeçalhos da AG News.
3. **Hard.**Construir um verificador de fidelidade RAG: decomposição de reivindicações atômicas + NLI por reivindicação. Avalie em 50 respostas geradas por RAG com contexto de ouro. Mese taxas falsas positivas e falsas negativas contra rótulos de mão.

## Termos-chave

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| NLI | Natural Language Inference | 3-way classification of premise-hypothesis relationship. |
| RTE | Recognizing Textual Entailment | Older name for NLI; same task. |
| Entailment | "t implies h" | A typical reader would conclude h is true given t. |
| Contradiction | "t rules out h" | A typical reader would conclude h is false given t. |
| Neutral | "undecided" | No inference from t to h either way. |
| Zero-shot classification | NLI as classifier | Verbalize labels as hypotheses, pick max entailment. |
| Faithfulness | Is the answer supported? | NLI over (retrieved context, generated answer). |

## Mais leitura

- [Bowman et al. (2015). A large annotated corpus for learning natural language inference](https://arxiv.org/abs/1508.05326) SNLI.
- [Williams, Nangia, Bowman (2017). A Broad-Coverage Challenge Corpus for Sentence Understanding through Inference](https://arxiv.org/abs/1704.05426) Multi-NLI.
- [Nie et al. (2019). Adversarial NLI](https://arxiv.org/abs/1910.14599) o índice de referência ANLI.
- [Yin, Hay, Roth (2019). Benchmarking Zero-shot Text Classification](https://arxiv.org/abs/1909.00161) NLI-as-classificador.
- [He et al. (2021). DeBERTa: Decoding-enhanced BERT with Disentangled Attention](https://arxiv.org/abs/2006.03654) o cavalo de trabalho NLI de 2026.
