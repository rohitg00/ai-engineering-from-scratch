# Relação Extração e Grafico de Conhecimento Construção

> A NER encontrou as entidades. A entidade que liga as ancorou. A extração de relações encontra as bordas entre elas. Um gráfico de conhecimento é a soma de nós, bordas e sua proveniência.

**Type:** Build
**Languages:** Python, TypeScript
**Prerequisites:** Phase 5 · 06 (NER), Phase 5 · 25 (Entity Linking)
**Time:** ~60 minutes

## O problema

Um analista diz: "Tim Cook tornou-se CEO da Apple em 2011". Quatro fatos:

- `(Tim Cook, role, CEO)`
- `(Tim Cook, employer, Apple)`
- `(Tim Cook, start_date, 2011)`
- `(Apple, type, Organization)`

Relação Extração (RE) transforma texto livre em triples estruturados `(subject, relation, object)`- Agregar em um corpo e você tem um gráfico de conhecimento. Agregar e consulta e você tem um substrato de raciocínio para RAG, análise ou auditorias de conformidade.

O problema de 2026: LLM extraem relações com entusiasmo. Muito entusiasmo. Eles alucinam triples que o texto fonte não suporta. Sem proveniência, você não pode distinguir triples reais da ficção plausível. A resposta de 2026 é o estilo AEVS-ancorar e verificar pipelines.

## O conceito

![Text → triples → knowledge graph](../assets/relation-extraction.svg)

**Triple form.** `(subject_entity, relation_type, object_entity)`Relações vêm de uma ontologia fechada (propriedades de Wikidata, FIBO, UMLS) ou de um conjunto aberto (estilo OpenIE, qualquer coisa pode acontecer).

**Three extraction approaches.**

1. **Rule / pattern-based.**Padrões Hearst: "X como Y" → `(Y, isA, X)`Além de regex feito à mão, frágil, preciso, explicável.
2. **Supervised classifier.**Dadas duas menções de entidade em uma frase, prever a relação a partir de um conjunto fixo.
3. **Generative LLM.**Faça com que o modelo emite triples, funciona fora da caixa, precisa de origem ou alucina lixo de aparência plausível.

**AEVS (Anchor-Extraction-Verification-Supplement, 2026).**O quadro atual de atenuação das alucinações:

- **Anchor.**Identificar cada espaço de entidades e espaço de frases de relação com posições exatas.
- **Extract.**Gerenciar triples ligados a espaços de âncora.
- **Verify.**Combine cada elemento triplo com o texto fonte; rejeite qualquer coisa não suportada.
- **Supplement.**Um passe de cobertura garante que não seja deixada cair a faixa ancorada.

As alucinações caem drasticamente, requer mais computação, mas é auditable.

**The open-vs-closed tradeoff.**

- **Closed ontology.**Lista fixa de propriedades (por exemplo, 11 mil propriedades do Wikidata). Prediível. Querável. Difícil de inventar.
- **Open IE.**Qualquer frase verbal torna-se uma relação, alta memória, baixa precisão, confuso para fazer perguntas.

Os KGs de produção geralmente misturam: abrem IE para descoberta, depois canonizam as relações em uma ontologia fechada antes de se fundir no gráfico principal.

```figure
relation-triples
```

## Construí-lo

### Passo 1: extracção baseada em padrões

```python
PATTERNS = [
    (r"(?P<s>[A-Z]\w+) (?:is|was) (?:a|an|the) (?P<o>[A-Z]?\w+)", "isA"),
    (r"(?P<s>[A-Z]\w+) (?:is|was) born in (?P<o>\w+)", "bornIn"),
    (r"(?P<s>[A-Z]\w+) works? (?:at|for) (?P<o>[A-Z]\w+)", "worksAt"),
    (r"(?P<s>[A-Z]\w+) founded (?P<o>[A-Z]\w+)", "founded"),
]
```

Veja .`code/main.py`Os padrões Hearst ainda são enviados em canais específicos de domínio porque são depuráveis.

### Passo 2: extracção de relações sequenciais supervisionadas

```python
from transformers import AutoTokenizer, AutoModelForSeq2SeqLM

tok = AutoTokenizer.from_pretrained("Babelscape/rebel-large")
model = AutoModelForSeq2SeqLM.from_pretrained("Babelscape/rebel-large")

text = "Tim Cook was born in Alabama. He later became CEO of Apple."
encoded = tok(text, return_tensors="pt", truncation=True)
output = model.generate(**encoded, max_length=200)
decoded = tok.batch_decode(output, skip_special_tokens=False)
```

O REBEL é um extrator de relações seq2seq baseado em BART: gera triples em vez de classificar pares de entidades.`<triplet>`- Não .`<subj>`E ...`<obj>`marcadores, então dividir-se sobre eles (como o parser do modelo de cartão faz) para obter `(subject, relation, object)`Registros, ajustados a dados de vigilância remota, base de peso aberto padrão.

### Passo 3: Extração com Mestrado em Direito Jurídico com ancoragem

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

Verifique cada volta contra a fonte.`text[start:end] != triple_entity`Este é o passo de "verificação" do AEVS na sua forma mínima.

### Passo 4: canonizar em ontologia fechada

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

A canonização é frequentemente 60-80% do trabalho de engenharia.

### Passo 5: criar um pequeno gráfico e consulta

```python
triples = extract(text)
graph = {}
for s, r, o in triples:
    graph.setdefault(s, []).append((r, o))


def neighbors(node, relation=None):
    return [(r, o) for r, o in graph.get(node, []) if relation is None or r == relation]


print(neighbors("Tim Cook", relation="P108"))    # -> [(P108, Apple)]
```

Este é o átomo de cada sistema RAG-over-KG. Escala-o com lojas triplo RDF (Blazegraph, Virtuoso), gráficos de propriedade (Neo4j), ou lojas de gráficos aumentados por vetores.

## Encurralagens

- **Coreference before RE.**"Ele fundou a Apple"  RE precisa saber quem é "ele".
- **Entity canonicalization.**"Apple Inc" e "Apple" devem resolver no mesmo nó.
- **Hallucinated triples.**Os LLM emitem triples que o texto não suporta.
- **Relation canonicalization drift.**Relações de IE aberta são inconsistentes ("nasceu em, " " veio de, " " é um nativo de").
- **Temporal errors.**"Tim Cook é CEO da Apple"  verdade agora, falsa em 2005.`P580`hora de início, `P582`tempo de encerramento em Wikidata).
- **Domain mismatch.**O texto jurídico, médico e científico muitas vezes precisa de modelos RE ajustados para o domínio.

## Usá-lo

A pilha de 2026:

| Situation | Pick |
|-----------|------|
| Fast production, general domain | REBEL or LlamaPred with Wikidata canonicalization |
| Domain-specific (biomed, legal) | SciREX-style domain fine-tune + custom ontology |
| LLM-prompted, audited output | AEVS pipeline: anchor → extract → verify → supplement |
| High-volume news IE | Pattern-based + supervised hybrid |
| Building a KG from scratch | Open IE + manual canonicalization pass |
| Temporal KG | Extract with qualifiers (start/end time, point in time) |

O padrão de integração: NER → coref → entidade ligando → extração de relações → mapeamento ontológico → carga gráfica. Cada etapa é um portão de qualidade potencial.

## Envia-o

Salva como`outputs/skill-re-designer.md`- Não .

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

1. **Easy.**Alimenta o extrator de padrões .`code/main.py`5 frases de artigos de notícias.
2. **Medium.**Use REBEL (ou um pequeno LLM) nas mesmas frases. Comparar triples. Qual extractor tem maior precisão?
3. **Hard.**Construir o pipeline AEVS: extrair com LLM + verificar intervalos em relação à fonte. Medir a taxa de alucinação antes vs após o passo de verificação em 50 frases do estilo Wikipedia.

## Termos-chave

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| Triple | Subject-relation-object | `(s, r, o)` tuple that is the atomic unit of a KG. |
| Open IE | Extract anything | Open-vocabulary relation phrases; high recall, low precision. |
| Closed ontology | Fixed schema | Bounded set of relation types (Wikidata, UMLS, FIBO). |
| Canonicalization | Normalize everything | Map surface names / relations to canonical ids. |
| AEVS | Grounded extraction | Anchor-Extraction-Verification-Supplement pipeline (2026). |
| Provenance | Source-of-truth link | Every triple carries a doc id + char-span to its source. |
| Distant supervision | Cheap labels | Align text with an existing KG to create training data. |

## Mais leitura

- [Mintz et al. (2009). Distant supervision for relation extraction without labeled data](https://www.aclweb.org/anthology/P09-1113.pdf) o papel de supervisão à distância.
- [Huguet Cabot, Navigli (2021). REBEL: Relation Extraction By End-to-end Language generation](https://aclanthology.org/2021.findings-emnlp.204.pdf)- Seq2seq RE.
- [Wadden et al. (2019). Entity, Relation, and Event Extraction with Contextualized Span Representations (DyGIE++)](https://arxiv.org/abs/1909.03546) IE comum.
- [AEVS — Anchor-Extraction-Verification-Supplement framework](https://www.mdpi.com/2073-431X/15/3/178) 2026 design de alucinação-mitigação.
- [Wikidata SPARQL tutorial](https://www.wikidata.org/wiki/Wikidata:SPARQL_tutorial) consultas de gráficos canônicos.
