# Resolução de Coreferência

> "Ela ligou pra ele. Ele não atendeu. O médico estava no almoço." Três referências pra duas pessoas e ninguém é nomeado. Resolução de coreferência descobre quem é quem.

**Tipo:** Aprender
**Linguagens:** Python
**Pré-requisitos:** Fase 5 · 06 (NER), Fase 5 · 07 (POS & Parsing)
**Tempo:** ~60 minutos

## O Problema

Extraia cada menção da Apple Inc. de um artigo de 300 palavras. Fácil quando o artigo diz "Apple." Difícil quando diz "a empresa", "eles", "o gigante da tecnologia de Cupertino" ou "a firma de Jobs." Sem resolver essas menções pra uma mesma entidade, seu pipeline de NER perde 60-80% das menções.

Resolução de coreferência vincula cada expressão que se refere à mesma entidade do mundo real num cluster. É a cola entre NLP de nível superficial (NER, parsing) e semântica downstream (IE, QA, resumo, KG).

Por que importa em 2026:

- Resumo: "O CEO anunciou..." vs "Tim Cook anunciou..." — o resumo deve nomear o CEO.
- Question answering: "Quem ela ligou?" precisa resolver "ela."
- Extração de informação: um grafo de conhecimento com "PER1 fundou a Apple" e "Jobs fundou a Apple" como entradas separadas está errado.
- IE multi-documento: mesclar menções entre artigos sobre o mesmo evento é coreferência cross-documento.

## O Conceito

![Clustering de coreferência: menções → entidades](../assets/coref.svg)

**A tarefa.** Entrada: um documento. Saída: um clustering de menções (spans) onde cada cluster se refere a uma entidade.

**Tipos de menção.**

- **Entidade nomeada.** "Tim Cook"
- **Nominal.** "o CEO", "a empresa"
- **Pronominal.** "ele", "ela", "eles", "isso"
- **Apositiva.** "Tim Cook, o CEO da Apple,"

**Arquiteturas.**

1. **Baseada em regras (Hobbs, 1978).** Resolução de pronomes baseada em árvore sintática usando regras gramaticais. Bom baseline. Surpreendentemente difícil de superar em pronomes.
2. **Classificador de par de menções.** Pra cada par de menções (m_i, m_j), prevê se coreferem. Cluster por fechamento transitivo. Padrão pré-2016.
3. **Ranking de menções.** Pra cada menção, ranqueia antecedentes candidatos (incluindo "sem antecedente"). Pega o topo.
4. **End-to-end baseada em spans (Lee et al., 2017).** Encoder transformer. Enumera todos os spans candidatos até um limite de comprimento. Prevê escores de menção. Prevê probabilidade de antecedente pra cada span. Cluster gananciosamente. O padrão moderno.
5. **Generativa (2024+).** Faça prompting num LLM: "List every pronoun in this text and its antecedent." Funciona bem em casos fáceis, struggled em documentos longos e referentes raros.

**Métricas de avaliação.** Cinco métricas padrão (MUC, B³, CEAF, BLANC, LEA) porque nenhuma métrica única captura qualidade de clustering. Reporte a média das três primeiras como F1 do CoNLL. Estado da arte em 2026 no CoNLL-2012: ~83 F1.

**Casos difíceis conhecidos.**

- Descrições definidas referindo-se a entidades introduzidas páginas antes.
- Anafora de ponte ("as rodas" → um carro mencionado antes).
- Anafora zero em idiomas como chinês e japonês.
- Catafora (pronome antes do referente): "When **she** walked in, Mary smiled."

## Construindo

### Passo 1: coreferência neural pré-treinada (AllenNLP / spaCy-experimental)

```python
import spacy
nlp = spacy.load("en_coreference_web_trf")   # experimental model
doc = nlp("Apple announced new products. The company said they would ship soon.")
for cluster in doc._.coref_clusters:
    print(cluster, "->", [m.text for m in cluster])
```

Num documento maior, você obtém algo como:
- Cluster 1: [Apple, The company, they]
- Cluster 2: [new products]

### Passo 2: resolvedor de pronomes baseado em regras (didático)

Veja `code/main.py` pra uma implementação com stdlib apenas:

1. Extraia menções: entidades nomeadas (spans maiúsculos), pronomes (busca em dicionário), descrições definidas ("the X").
2. Pra cada pronome, olhe as K menções anteriores e pontue-as por:
   - concordância de gênero/número (heurística)
   - recência (mais próximo vence)
   - papel sintático (sujetos preferidos)
3. Vincule o antecedente com maior pontuação.

Não competitivo com modelos neurais. Mas mostra o espaço de busca e as decisões que um modelo de ponta a ponta precisa tomar.

### Passo 3: usando LLMs pra coreferência

```python
prompt = f"""Text: {text}

List every pronoun and noun phrase that refers to a person or company.
Cluster them by what they refer to. Output JSON:
[{{"entity": "Apple", "mentions": ["Apple", "the company", "it"]}}, ...]
"""
```

Dois modos de falha pra observar. Primeiro, LLMs super-mesclam ("him" e "her" referindo-se a duas pessoas distintas). Segundo, LLMs silenciosamente descartam menções em documentos longos. Sempre verifique com checagens de offset de span.

### Passo 4: avaliação

O script padrão conll-2012 calcula MUC, B³, CEAF-φ4 e reporta a média. Pra uma avaliação interna, comece com precisão e recall em nível de span no conjunto de teste anotado, depois adicione F1 de vinculação de menções.

## Armadilhas

- **Explosão de singletons.** Alguns sistemas reportam cada menção como seu próprio cluster. B³ é leniente. MUC pune isso. Sempre verifique as três métricas.
- **Pronomes em contexto longo.** Performance cai ~15 F1 em documentos com mais de 2.000 tokens. Chunk com cuidado.
- **Pressupostos de gênero.** Regras de gênero hard-coded quebram em referentes não-binários, organizações, animais. Use modelos aprendidos ou pontuação neutra.
- **Drift de LLM em documentos longos.** Uma única chamada de API não consegue clustering confiável de menções em 50+ parágrafos. Use janela deslizante + merge.

## Usar

A stack de 2026:

| Situação | Escolha |
|-----------|------|
| Inglês, documento único | `en_coreference_web_trf` (spaCy-experimental) ou coref neural do AllenNLP |
| Multilíngue | SpanBERT / XLM-R treinado em OntoNotes ou Multilingual CoNLL |
| Coref de evento cross-documento | Modelos de ponta a ponta eespecificaçãoializados (SOTA 2025–26) |
| Baseline rápida com LLM | GPT-4o / Claude com prompt de coref de saída estruturada |
| Sistemas de diálogo em produção | Fallback baseado em regras + primário neural + revisão manual pra slots críticos |

O padrão de integração que roda em 2026: rode NER primeiro, rode coref, una clusters de coref em entidades NER. Tarefas downstream veem uma entidade por cluster, não uma entidade por menção.

## Entregar

Salve como `outputs/skill-coref-picker.md`:

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

1. **Fácil.** Rode o resolvedor baseado em regras em `code/main.py` em 5 parágrafos feitos à mão. Meça acurácia de vinculação de menções contra ground truth.
2. **Médio.** Use um modelo de coref neural pré-treinado num artigo de notícias. Compare clusters contra sua própria anotação manual. Onde ele falhou?
3. **Difícil.** Construa um pipeline de NER melhorado com coref: NER primeiro, depois merge via clusters de coref. Meça melhoria de cobertura de entidades vs só NER em 100 artigos.

## Termos Chave

| Termo | O que as pessoas dizem | O que significa de verdade |
|------|-----------------|-----------------------|
| Menção | Uma referência | Um span de texto que se refere a uma entidade (nome, pronome, frase nominal). |
| Antecedente | O que "isso" se refere | A menção anterior com a qual uma posterior corefere. |
| Cluster | As menções da entidade | Conjunto de menções que todas se referem à mesma entidade do mundo real. |
| Anafora | Referência pra trás | Menção posterior se refere à anterior ("ele" → "João"). |
| Catafora | Referência pra frente | Menção anterior se refere à posterior ("When he arrived, John..."). |
| Ponte | Referência implícita | "I bought a car. The wheels were bad." (rodas DESSE carro.) |
| F1 CoNLL | O número nos rankings | Média dos F1 de MUC, B³, CEAF-φ4. |

## Leitura Complementar

- [Jurafsky & Martin, SLP3 Ch. 26 — Coreference Resolution and Entity Linking](https://web.stanford.edu/~jurafsky/slp3/26.pdf) — capítulo canônico de livro didático.
- [Lee et al. (2017). End-to-end Neural Coreference Resolution](https://arxiv.org/abs/1707.07045) — de ponta a ponta baseada em spans.
- [Joshi et al. (2020). SpanBERT](https://arxiv.org/abs/1907.10529) — pré-treinamento que melhora coref.
- [Pradhan et al. (2012). CoNLL-2012 Shared Task](https://aclanthology.org/W12-4501/) — o benchmark.
- [Hobbs (1978). Resolving Pronoun References](https://www.sciencedirect.com/science/article/pii/0024384178900064) — o clássico baseado em regras.
