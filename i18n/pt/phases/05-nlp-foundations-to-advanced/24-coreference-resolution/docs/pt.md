# Resolução de Coreferência

> "Ela ligou-lhe, ele não respondeu, o médico estava no almoço". Três referências a duas pessoas e ninguém é nomeado.

**Type:** Learn
**Languages:** Python, TypeScript
**Prerequisites:** Phase 5 · 06 (NER), Phase 5 · 07 (POS & Parsing)
**Time:** ~60 minutes

## O problema

Extrair todas as menções à Apple Inc. de um artigo de 300 palavras. Fácil quando o artigo diz "Apple". Difícil quando diz "a empresa", "eles", "o gigante tecnológico de Cupertino", ou "a empresa de Jobs". Sem resolver essas menções para a mesma entidade, seu pipeline NER perde 60-80% das menções.

A resolução de coreferência liga todas as expressões que se referem à mesma entidade do mundo real em um cluster. É a cola entre a PNL de nível superficial (NER, análise) e a semântica descendente (IE, QA, resumo, KG).

Por que é importante em 2026:

- Resumo: "O CEO anunciou... " vs "Tim Cook anunciou... "  O resumo deve nomear o CEO.
- Responda à pergunta: "A quem ela chamou?" requer resolver "ela".
- Extração de informações: um gráfico de conhecimento com "PER1 fundou a Apple" e "Jobs fundou a Apple" como entradas separadas é errado.
- Multi-document IE: a fusão de menções entre artigos sobre o mesmo evento é coreferência entre documentos.

## O conceito

![Coreference clustering: mentions → entities](../assets/coref.svg)

**The task.**Introdução: um documento. Saída: um agrupamento de menções (amplitude) onde cada agrupamento se refere a uma entidade.

**Mention types.**

- **Named entity.**"Tim Cook"
- **Nominal.**"o CEO", "a empresa"
- **Pronominal.**"Ele", "ela", "eles", "ela"
- **Appositive.**"Tim Cook, CEO da Apple,

**Architectures.**

1. **Rule-based (Hobbs, 1978).**Resolução de pronome baseada em árvores sintáticas usando regras gramaticais. Boa linha de base. Surpreendentemente difícil de superar em pronome.
2. **Mention-pair classifier.**Por cada par de menções .$(m_i, m_j)$O que é que se passa com o sistema de controle de dados?
3. **Mention-ranking.**Para cada menção, classifique antecedentes candidatos (incluindo "sem antecedentes").
4. **Span-based end-to-end (Lee et al., 2017).**Encoderador de transformador. Enumere todos os intervalos candidatos até um limite de comprimento. Previne a menção de pontuações. Previne a probabilidade de antecedentes para cada intervalos. Cluster com ganância. O padrão moderno.
5. **Generative (2024+).**Promover um LLM: "Lista todos os pronúncios neste texto e seus antecedentes".

**The evaluation metrics.**Cinco métricas padrão (MUC, B3, CEAF, BLANC, LEA) porque nenhuma métrica única capta a qualidade do clustering.

**Known hard cases.**

- Descrições definidas referentes a entidades introduzidas em páginas anteriores.
- Anafora de ponte ("as rodas" → um carro mencionado anteriormente).
- Anafora zero em idiomas como chinês e japonês.
- Cataphora (pronom antes do referente): "Quando **she**"Entrou, e a Mary sorriu".

```figure
coref-links
```

## Construí-lo

### Passo 1: Coreferência neural pré-treinada (AllenNLP / spaCy-experimental)

```python
import spacy
nlp = spacy.load("en_coreference_web_trf")   # experimental model
doc = nlp("Apple announced new products. The company said it would ship them soon.")
for cluster in doc._.coref_clusters:
    print(cluster, "->", [m.text for m in cluster])
```

Num documento mais longo, obtém algo como:
- Cluster 1: [Apple, a empresa, ele]
- Cluster 2: [novos produtos, eles]

### Passo 2: Resolver pronome baseado em regras (ensino)

Veja .`code/main.py`Para uma aplicação apenas de restrições:

1. Menções de extratos: entidades nomeadas (capitalizadas), pronomes (busca direta), descrições definidas ("a X").
2. Para cada pronome, olhe para as menções anteriores de K e ponta-as por:
   - acordo de gênero/número (heurística)
   - recente (vincimentos mais próximos)
   - Função sintática (subjetos preferidos)
3. Liga o antecedente com maior pontuação.

Não é competitivo com modelos neurais, mas mostra o espaço de busca e as decisões que um modelo de ponta a ponta deve tomar.

### Passo 3: utilização de LLM para coreferência

```python
prompt = f"""Text: {text}

List every pronoun and noun phrase that refers to a person or company.
Cluster them by what they refer to. Output JSON:
[{{"entity": "Apple", "mentions": ["Apple", "the company", "it"]}}, ...]
"""
```

Dois modos de falha para assistir. Primeiro, LLM supermergem ("ele" e "ela" referindo-se a duas pessoas distintas). segundo, LLM silenciosamente soltam menções em documentos longos. Verifique sempre com verificações de tempo de compensação.

### Passo 4: Avaliação

O script padrão conll-2012 calcula MUC, B3, CEAF-φ4 e relata a média. Para uma avaliação interna, comece com precisão de nível de span e retira o seu conjunto de teste anotado, depois adicione o link de menção F1.

## Encurralagens

- **Singleton explosion.**Alguns sistemas relatam cada menção como seu próprio cluster. B3 é indulgente. MUC pede isso.
- **Pronouns in long context.**O desempenho cai em 15 F1 em documentos com mais de 2.000 tokens.
- **Gender assumptions.**As regras de gênero codificadas violam referentes não binários, organizações, animais.
- **LLM drift on long docs.**Uma única chamada de API não pode mencionar com confiança clusters em mais de 50 parágrafos. Use janela deslizante + merge.

## Usá-lo

A pilha de 2026:

| Situation | Pick |
|-----------|------|
| English, single document | `en_coreference_web_trf` (spaCy-experimental) or AllenNLP neural coref |
| Multilingual | SpanBERT / XLM-R trained on OntoNotes or Multilingual CoNLL |
| Cross-document event coref | Specialized end-to-end models (2025–26 SOTA) |
| Quick LLM baseline | GPT-4o / Claude with structured-output coref prompt |
| Production dialog systems | Rule-based fallback + neural primary + manual review for critical slots |

O padrão de integração que se lança em 2026: executar primeiro o NER, executar o coref, fundir os clusters principais em entidades NER.

## Envia-o

Salva como`outputs/skill-coref-picker.md`- Não .

```markdown
---
name: coref-picker
description: Pick a coreference approach, evaluation plan, and integration strategy.
version: 1.0.0
phase: 5
lesson: 24
tags: [nlp, coref, information-extraction]
---

Given a use case (single-doc / multi-doc, domain, language), output:

1. Approach. Rule-based / neural span-based / LLM-prompted / hybrid. One-sentence reason.
2. Model. Named checkpoint if neural.
3. Integration. Order of operations: tokenize → NER → coref → downstream task.
4. Evaluation. CoNLL F1 (MUC + B³ + CEAF-φ4 average) on held-out set + manual cluster review on 20 documents.

Refuse LLM-only coref for documents over 2,000 tokens without sliding-window merge. Refuse any pipeline that runs coref without a mention-level precision-recall report. Flag gender-heuristic systems deployed in demographically diverse text.
```

## Exercícios

1. **Easy.**Execute o resolutor baseado em regras em `code/main.py`Medir a precisão da referência-ligação em relação à verdade básica.
2. **Medium.**Usar um modelo de núcleo neural pré-treinado em um artigo de notícias.
3. **Hard.**Construir um pipeline de NER reforçado: primeiro, NER, depois, fundir através de clusters.

## Termos-chave

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| Mention | A reference | A span of text that refers to an entity (name, pronoun, noun phrase). |
| Antecedent | What "it" refers to | The earlier mention a later one corefers with. |
| Cluster | The entity's mentions | Set of mentions that all refer to the same real-world entity. |
| Anaphora | Backward reference | Later mention refers to earlier ("he" → "John"). |
| Cataphora | Forward reference | Earlier mention refers to later ("When he arrived, John..."). |
| Bridging | Implicit reference | "I bought a car. The wheels were bad." (wheels of THAT car.) |
| CoNLL F1 | The number on leaderboards | Average of MUC, B³, CEAF-φ4 F1 scores. |

## Mais leitura

- [Jurafsky & Martin, SLP3 Ch. 26 — Coreference Resolution and Entity Linking](https://web.stanford.edu/~jurafsky/slp3/26.pdf) capítulo do livro de texto canônico.
- [Lee et al. (2017). End-to-end Neural Coreference Resolution](https://arxiv.org/abs/1707.07045) End-to-end baseado em span.
- [Joshi et al. (2020). SpanBERT](https://arxiv.org/abs/1907.10529)- Pre-treinamento que melhora o corpo.
- [Pradhan et al. (2012). CoNLL-2012 Shared Task](https://aclanthology.org/W12-4501/) o índice de referência.
- [Hobbs (1978). Resolving Pronoun References](https://www.sciencedirect.com/science/article/pii/0024384178900064)O clássico baseado em regras.
