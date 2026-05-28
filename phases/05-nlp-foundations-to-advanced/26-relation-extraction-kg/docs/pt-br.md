# Extração de Relações e Construção de Grafo de Conhecimento

> NER encontrou as entidades. Entity linking as ancorou. Extração de relações encontra as arestas entre elas. Um grafo de conhecimento é a soma de nós, arestas e sua procedência.

**Tipo:** Construir
**Linguagens:** Python
**Pré-requisitos:** Fase 5 · 06 (NER), Fase 5 · 25 (Entity Linking)
**Tempo:** ~60 minutos

## O Problema

Um analista lê: "Tim Cook became CEO of Apple in 2011." Quatro fatos:

- `(Tim Cook, role, CEO)`
- `(Tim Cook, employer, Apple)`
- `(Tim Cook, start_date, 2011)`
- `(Apple, type, Organization)`

Extração de Relações (RE) transforma texto livre em triplos estruturados `(sujeito, relação, objeto)`. Agregue em um corpus e você tem um grafo de conhecimento. Agregue e consulte e você tem uma base de raciocínio pra RAG, analytics ou auditorias de compliance.

O problema de 2026: LLMs extraem relações entusiasticamente. De mais. Eles alucinam triplos que o texto fonte não suporta. Sem procedência, você não consegue distinguir triplos reais de ficção plausível. A resposta de 2026 são pipelines estilo AEVS de ancoragem-e-verificação.

## O Conceito

![Texto → triplos → grafo de conhecimento](../assets/relation-extraction.svg)

**Forma do triplo.** `(entidade_sujeito, tipo_relacao, entidade_objeto)`. Relações vêm de uma ontologia fechada (propriedades da Wikidata, FIBO, UMLS) ou um conjunto aberto (estilo OpenIE, vale tudo).

**Três abordagens de extração.**

1. **Baseada em regras/padrões.** Padrões Hearst: "X such as Y" → `(Y, isA, X)`. Mais regex feitas à mão. Frágil, preciso, explicável.
2. **Classificador supervisionado.** Dadas duas menções de entidade numa frase, prevê a relação de um conjunto fixo. Treinado em TACRED, ACE, KBP. Padrão 2015–2022.
3. **LLM generativo.** Faça o modelo emitir triplos. Funciona fora da caixa. Precisa de procedência, ou alucina lixo com cara plausível.

**AEVS (Anchor-Extraction-Verification-Supplement, 2026).** O framework atual de mitigação de alucinação:

- **Ancorar.** Identifique cada span de entidade e span de frase-relação com posições exatas.
- **Extrair.** Gere triplos vinculados a spans âncora.
- **Verificar.** Volte cada elemento do triplo pro texto fonte; rejeite qualquer coisa não suportada.
- **Suplementar.** Uma passagem de cobertura garante que nenhum span âncora seja descartado.

Alucinações caem drasticamente. Requer mais compute mas é auditável.

**O tradeoff aberto-vs-fechado.**

- **Ontologia fechada.** Lista fixa de propriedades (ex: 11.000+ propriedades da Wikidata). Previsível. Consultável. Difícil de inventar.
- **Open IE.** Qualquer frase verbal vira uma relação. Alto recall. Baixa precisão. Bagunça pra consultar.

KGs de produção geralmente misturam: Open IE pra descoberta, depois canonicize relações numa ontologia fechada antes de mesclar no grafo principal.

## Construindo

### Passo 1: extração baseada em padrões

```python
PATTERNS = [
    (r"(?P<s>[A-Z]\\w+) (?:is|was) (?:a|an|the) (?P<o>[A-Z]?\\w+)", "isA"),
    (r"(?P<s>[A-Z]\\w+) (?:is|was) born in (?P<o>\\w+)", "bornIn"),
    (r"(?P<s>[A-Z]\\w+) works? (?:at|for) (?P<o>[A-Z]\\w+)", "worksAt"),
    (r"(?P<s>[A-Z]\\w+) founded (?P<o>[A-Z]\\w+)", "founded"),
]
```

Veja `code/main.py` pro extrator de brinquedo completo. Padrões Hearst ainda são usados em pipelines de domínio específico porque são debugáveis.

### Passo 2: classificação de relações supervisionada

```python
from transformers import AutoTokenizer, AutoModelForSequenceClassification

tok = AutoTokenizer.from_pretrained("Babelscape/rebel-large")
model = AutoModelForSequenceClassification.from_pretrained("Babelscape/rebel-large")

text = "Tim Cook was born in Alabama. He later became CEO of Apple."
encoded = tok(text, return_tensors="pt", truncation=True)
output = model.generate(**encoded, max_length=200)
triples = tok.batch_decode(output, skip_special_tokens=False)
```

REBEL é um extrator de relações seq2seq: texto entra, triplos saem, já em IDs de propriedade da Wikidata. Fine-tuned em dados de supervisão distante. Baseline padrão de pesos abertos.

### Passo 3: extração via prompting de LLM com ancoragem

```python
prompt = f"""Extract (subject, relation, object) triples from the text.
For each triple, include the exact character span in the source text.

Text: {text}

Output JSON:
[{{"subject": {{"text": "...", "span": [start, end]}},
   "relation": "...",
   "object": {{"text": "...", "span": [start, end]}}}}, ...]

Only include triples fully supported by the text. No inference beyond what is stated.
"""
```

Verifique cada span retornado contra a fonte. Rejeite qualquer coisa onde `text[start:end] != triple_entity`. Esse é o passo "verificar" do AEVS na sua forma minimal.

### Passo 4: canonicizar numa ontologia fechada

```python
RELATION_MAP = {
    "is the CEO of": "P169",       # "chief executive officer"
    "was born in":   "P19",         # "place of birth"
    "founded":        "P112",       # "founded by" (inverted subject/object)
    "works at":       "P108",       # "employer"
}


def canonicalize(relation):
    rel_low = relation.lower().strip()
    if rel_low in RELATION_MAP:
        return RELATION_MAP[rel_low]
    return None   # drop unmapped open relations or route to manual review
```

Canonicização frequentemente é 60-80% do trabalho de engenharia. Orçamente.

### Passo 5: construir um grafo pequeno e consultar

```python
triples = extract(text)
graph = {}
for s, r, o in triples:
    graph.setdefault(s, []).append((r, o))


def neighbors(node, relation=None):
    return [(r, o) for r, o in graph.get(node, []) if relation is None or r == relation]


print(neighbors("Tim Cook", relation="P108"))    # -> [(P108, Apple)]
```

Esse é o átomo de todo sistema RAG-over-KG. Escale com stores RDF (Blazegraph, Virtuoso), grafos de propriedade (Neo4j) ou stores vetoriais augmentados com grafo.

## Armadilhas

- **Coreferência antes de RE.** "He founded Apple" — RE precisa saber quem é "ele." Rode coref primeiro (lição 24).
- **Canonicização de entidade.** "Apple Inc" e "Apple" devem resolver pro mesmo nó. Entity linking primeiro (lição 25).
- **Triplos alucinados.** LLMs emitem triplos que o texto não suporta. Imponha verificação de span.
- **Drift de canonicização de relação.** Relações de Open IE são inconsistentes ("was born in," "came from," "is a native of"). Colapse pra IDs canônicos ou o grafo fica não-consultável.
- **Erros temporais.** "Tim Cook is CEO of Apple" — verdade agora, falso em 2005. Muitas relações são delimitadas no tempo. Use qualificadores (`P580` hora início, `P582` hora fim na Wikidata).
- **Incompatibilidade de domínio.** REBEL treinou em Wikipedia. Textos jurídicos, médicos e científicos frequentemente precisam de modelos RE fine-tuned em domínio.

## Usar

A stack de 2026:

| Situação | Escolha |
|-----------|------|
| Produção rápida, domínio geral | REBEL ou LlamaPred com canonicização Wikidata |
| Domínio específico (biomed, jurídico) | Fine-tuning de domínio estilo SciREX + ontologia customizada |
| Via prompting de LLM, saída auditada | Pipeline AEVS: ancorar → extrair → verificar → suplementar |
| IE de notícias em alto volume | Híbrido baseado em padrões + supervisionado |
| Construindo KG do zero | Open IE + passagem de canonicização manual |
| KG temporal | Extração com qualificadores (hora início/fim, ponto no tempo) |

O padrão de integração: NER → coref → entity linking → extração de relações → mapeamento de ontologia → carga no grafo. Cada etapa é um potencial gate de qualidade.

## Entregar

Salve como `outputs/skill-re-designer.md`:

```markdown
---
name: re-designer
description: Design a relation extraction pipeline with provenance and canonicalization.
version: 1.0.0
phase: 5
lesson: 26
tags: [nlp, relation-extraction, knowledge-graph]
---

Given a corpus (domain, language, volume) and downstream use (KG-RAG, analytics, compliance), output:

1. Extractor. Pattern-based / supervised / LLM / AEVS hybrid. Reason tied to precision vs recall target.
2. Ontology. Closed property list (Wikidata / domain) or open IE with canonicalization pass.
3. Provenance. Every triple carries source char-span + doc id. Non-negotiable for audit.
4. Merge strategy. Canonical entity id + relation id + temporal qualifiers; dedup policy.
5. Evaluation. Precision / recall on 200 hand-labelled triples + hallucination-rate on LLM-extracted sample.

Refuse any LLM-based RE pipeline without span verification (source provenance). Refuse open-IE output flowing into a production graph without canonicalization. Flag pipelines with no temporal qualifier on time-bounded relations (employer, spouse, position).
```

## Exercícios

1. **Fácil.** Rode o extrator de padrões em `code/main.py` em 5 frases de artigos de notícias. Verifique a precisão manualmente.
2. **Médio.** Use REBEL (ou um LLM pequeno) nas mesmas frases. Compare triplos. Qual extrator tem maior precisão? Maior recall?
3. **Difícil.** Construa o pipeline AEVS: extraia com LLM + verifique spans contra a fonte. Meça taxa de alucinação antes vs depois do passo de verificação em 50 frases estilo Wikipedia.

## Termos Chave

| Termo | O que as pessoas dizem | O que significa de verdade |
|------|-----------------|-----------------------|
| Triplo | Sujeito-relação-objeto | Tupla `(s, r, o)` que é a unidade atômica de um KG. |
| Open IE | Extraia qualquer coisa | Frases-relação de vocabulário aberto; alto recall, baixa precisão. |
| Ontologia fechada | Schema fixo | Conjunto delimitado de tipos de relação (Wikidata, UMLS, FIBO). |
| Canonicização | Normalize tudo | Mapear nomes/superficiais e relações pra IDs canônicos. |
| AEVS | Extração fundamentada | Pipeline Anchor-Extraction-Verification-Supplement (2026). |
| Procedência | Link de fonte-verdade | Cada triplo carrega um ID de doc + span de caractere pra sua fonte. |
| Supervisão distante | Rótulos baratos | Alinhe texto com um KG existente pra criar dados de treino. |

## Leitura Complementar

- [Mintz et al. (2009). Distant supervision for relation extraction without labeled data](https://www.aclweb.org/anthology/P09-1113.pdf) — o paper de supervisão distante.
- [Huguet Cabot, Navigli (2021). REBEL: Relation Extraction By End-to-end Language generation](https://aclanthology.org/2021.findings-emnlp.204.pdf) — workhorse seq2seq de RE.
- [Wadden et al. (2019). Entity, Relation, and Event Extraction with Contextualized Span Representations (DyGIE++)](https://arxiv.org/abs/1909.03546) — IE conjunta.
- [AEVS — Anchor-Extraction-Verification-Supplement framework](https://www.mdpi.com/2073-431X/15/3/178) — design de 2026 de mitigação de alucinação.
- [Wikidata SPARQL tutorial](https://www.wikidata.org/wiki/Wikidata:SPARQL_tutorial) — consultas de grafo canônicas.
