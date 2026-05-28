# Inferência de Linguagem Natural — Implicação Textual

> "t implica h" significa que um humano lendo t concluiria que h é verdadeiro. NLI é a tarefa de prever implicação / contradição / neutro. Chato na superfície, essencial em produção.

**Tipo:** Aprender
**Linguagens:** Python
**Pré-requisitos:** Fase 5 · 05 (Análise de Sentimento), Fase 5 · 13 (Question-Answering)
**Tempo:** ~60 minutos

## O Problema

Você construiu um resumidor. Ele gerou um resumo. Como você sabe que o resumo não contém uma alucinação?

Você construiu um chatbot. Ele respondeu "sim". Como você sabe que a resposta é suportada pelo trecho recuperado?

Você precisa classificar 10.000 notícias por tópico. Não tem rótulos de treino. Pode reutilizar um modelo?

Os três problemas se reduzem a Inferência de Linguagem Natural. NLI pergunta: dado um premisso `t` e uma hipótese `h`, `h` é implicada por `t`, contradita, ou neutra (sem relação)?

- **Verificação de alucinação:** `t` = documento fonte, `h` = afirmação do resumo. Não é implicação = alucinação.
- **QA fundamentado:** `t` = trecho recuperado, `h` = resposta gerada. Não é implicação = fabricação.
- **Classificação zero-shot:** `t` = documento, `h` = rótulo verbalizado ("This is about sports"). Implicação = rótulo previsto.

Uma tarefa, três usos em produção. É por isso que todo framework de avaliação de RAG usa um modelo de NLI por baixo dos panos.

## O Conceito

![NLI: classificação tripartite, premissa vs hipótese](../assets/nli.svg)

**Os três rótulos.**

- **Implicação.** `t` → `h`. "The cat is on the mat" implica "There is a cat."
- **Contradição.** `t` → ¬`h`. "The cat is on the mat" contradiz "There is no cat."
- **Neutro.** Sem inferência de nenhum lado. "The cat is on the mat" é neutro com "The cat is hungry."

**Não é implicação lógica.** NLI é inferência de linguagem *natural* — o que um leitor humano típico inferiria, não lógica estrita. "John walked his dog" implica "John has a dog" em NLI, mas lógica de primeira ordem estrita só admitiria se você axiomatizasse posse.

**Datasets.**

- **SNLI** (2015). 570k pares anotados por humanos, legendas de imagens como premissas. Domínio estreito.
- **MultiNLI** (2017). 433k pares em 10 gêneros. O corpus de treino padrão em 2026.
- **ANLI** (2019). NLI adversarial. Humanos escreveram exemplos projetados especificamente pra quebrar modelos existentes. Mais difícil.
- **DocNLI, ConTRoL** (2020–21). Premissas de tamanho documento. Testa inferência multi-hop e de longo alcance.

**A arquitetura.** Um encoder transformer (BERT, RoBERTa, DeBERTa) lê `[CLS] premissa [SEP] hipótese [SEP]`. A representação `[CLS]` alimenta um softmax de 3 vias. Treine em MNLI, avalie em benchmarks de validação, obtenha 90%+ de acurácia em pares em distribuição.

**Zero-shot via NLI.** Dado um documento e rótulos candidatos, transforme cada rótulo numa hipótese ("This text is about sports"). Calcule a probabilidade de implicação pra cada. Pegue o máximo. Esse é o mecanismo por trás do pipeline `zero-shot-classification` do Hugging Face.

## Construindo

### Passo 1: rodar um modelo NLI pré-treinado

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

Pra NLI em produção, `facebook/bart-large-mnli` e `microsoft/deberta-v3-large-mnli` são os padrões abertos. DeBERTa-v3 lidera rankings.

### Passo 2: classificação zero-shot

```python
zs = pipeline("zero-shot-classification", model="facebook/bart-large-mnli")

text = "The stock market rallied after the central bank cut interest rates."
labels = ["finance", "sports", "politics", "technology"]

result = zs(text, candidate_labels=labels)
print(result)
# {'labels': ['finance', 'politics', 'technology', 'sports'],
#  'scores': [0.92, 0.05, 0.02, 0.01]}
```

O template é "This example is about {label}." por padrão. Personalize com `hypothesis_template`. Sem dados de treino necessários. Sem fine-tuning. Funciona fora da caixa.

### Passo 3: verificação de fidelidade pra RAG

```python
def is_faithful(answer, context, threshold=0.5):
    result = nli({"text": context, "text_pair": answer})[0]
    entail = next(s for s in result if s["label"] == "entailment")
    return entail["score"] > threshold
```

Esse é o núcleo da fidelidade do RAGAS. Divida a resposta gerada em afirmações atômicas. Verifique cada afirmação contra o contexto recuperado. Reporte a fração que implica.

### Passo 4: classificador NLI feito à mão (conceitual)

Veja `code/main.py` pra um brinquedo com stdlib apenas: premissa e hipótese são comparadas via sobreposição lexical + detecção de negação. Não competitivo com modelos transformer — mas mostra a forma da tarefa: dois textos entrada, rótulo de 3 vias saída, perda = entropia cruzada sobre `{entail, contradict, neutral}`.

## Armadilhas

- **Atalhos só de hipótese.** Modelos podem prever o rótulo só da hipótese em ~60% no SNLI porque "not", "nobody", "never" se correlacionam com contradição. Baseline forte pra detectar vazamento de rótulo.
- **Heurística de sobreposição lexical.** A heurística de subsequência ("toda subsequência é implicada") passa no SNLI mas falha em HANS/ANLI. Use benchmarks adversariais.
- **Degradação em tamanho de documento.** Modelos NLI de frase única caem 20+ F1 com premissas de tamanho documento. Use modelos treinados em DocNLI pra contexto longo.
- **Sensibilidade a template zero-shot.** "This example is about {label}" vs "{label}" vs "The topic is {label}" pode variar a acurácia em 10+ pontos. Ajuste o template.
- **Incompatibilidade de domínio.** MNLI treina em inglês geral. Textos jurídicos, médicos e científicos precisam de modelos NLI de domínio específico (ex: SciNLI, MedNLI).

## Usar

A stack de 2026:

| Caso de uso | Modelo |
|---------|-------|
| NLI geral | `microsoft/deberta-v3-large-mnli` |
| Rápido / borda | `cross-encoder/nli-deberta-v3-base` |
| Classificação zero-shot (leve) | `facebook/bart-large-mnli` |
| NLI em nível de documento | `MoritzLaurer/DeBERTa-v3-large-mnli-fever-anli-ling-wanli` |
| Multilíngue | `MoritzLaurer/multilingual-MiniLMv2-L6-mnli-xnli` |
| Detecção de alucinação em RAG | Camada NLI dentro do RAGAS / DeepEval |

O meta-padrão de 2026: NLI é a fita adesiva da compreensão de texto. Sempre que precisar de "A suporta B?" ou "A contradiz B?" — recorra ao NLI antes de fazer outra chamada de LLM.

## Entregar

Salve como `outputs/skill-nli-picker.md`:

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

1. **Fácil.** Rode `facebook/bart-large-mnli` em 20 tripletas (premissa, hipótese, rótulo) criadas à mão cobrindo todas as três classes. Meça acurácia. Adicione armadilhas adversariais de "heurística de subsequência" ("I did not eat the cake" vs "I ate the cake") e veja se quebra.
2. **Médio.** Compare o template zero-shot `"This text is about {label}"` contra `"The topic is {label}"` e `"{label}"` em 100 headlines da AG News. Reporte a variação de acurácia.
3. **Difícil.** Construa um verificador de fidelidade RAG: decomposição em afirmações atômicas + NLI por afirmação. Avalie em 50 respostas geradas por RAG com contexto dourado. Meça taxas de falso-positivo e falso-negativo vs rótulos manuais.

## Termos Chave

| Termo | O que as pessoas dizem | O que significa de verdade |
|------|-----------------|-----------------------|
| NLI | Inferência de Linguagem Natural | Classificação de 3 vias do relacionamento premissa-hipótese. |
| RTE | Reconhecimento de Implicação Textual | Nome mais antigo pra NLI; mesma tarefa. |
| Implicação | "t implica h" | Um leitor típico concluiria que h é verdade dado t. |
| Contradição | "t descarta h" | Um leitor típico concluiria que h é falso dado t. |
| Neutro | "indeciso" | Sem inferência de t pra h de nenhum lado. |
| Classificação zero-shot | NLI como classificador | Verbalize rótulos como hipóteses, pegue o máximo de implicação. |
| Fidelidade | A resposta é suportada? | NLI sobre (contexto recuperado, resposta gerada). |

## Leitura Complementar

- [Bowman et al. (2015). A large annotated corpus for learning natural language inference](https://arxiv.org/abs/1508.05326) — SNLI.
- [Williams, Nangia, Bowman (2017). A Broad-Coverage Challenge Corpus for Sentence Understanding through Inference](https://arxiv.org/abs/1704.05426) — MultiNLI.
- [Nie et al. (2019). Adversarial NLI](https://arxiv.org/abs/1910.14599) — o benchmark ANLI.
- [Yin, Hay, Roth (2019). Benchmarking Zero-shot Text Classification](https://arxiv.org/abs/1909.00161) — NLI como classificador.
- [He et al. (2021). DeBERTa: Decoding-enhanced BERT with Disentangled Attention](https://arxiv.org/abs/2006.03654) — o cavalo de batalha de NLI de 2026.
