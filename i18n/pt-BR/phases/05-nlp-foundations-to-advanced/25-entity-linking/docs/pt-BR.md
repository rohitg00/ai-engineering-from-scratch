# Entidade de ligação e desambiguação

> A NER encontrou "Paris". A entidade que liga decide: Paris, França? Paris Hilton? Paris, Texas? Paris (o príncipe troiano)? Sem ligar, o seu gráfico de conhecimento permanece ambíguo.

**Type:** Build
**Languages:** Python, TypeScript
**Prerequisites:** Phase 5 · 06 (NER), Phase 5 · 24 (Coreference Resolution)
**Time:** ~60 minutes

## O problema

Uma frase diz: "Jordan bateu a imprensa". O teu NER marca "Jordan" como PERSON.

- Michael Jordan (basquetebol)?
- Michael B. Jordan (actor)?
- Michael I. Jordan (professor de ML em Berkeley  sim, esta confusão é real nos trabalhos de ML)?
- Jordânia (o país)?
- Jordão (nome hebraico)?

A ligação de entidade (EL) resolve cada menção a uma entrada única em uma base de conhecimentos: Wikidata, Wikipedia, DBpedia ou seu domínio KB. Duas subtarefas:

1. **Candidate generation.**Dado "Jordan", quais são as entradas de KB plausíveis?
2. **Disambiguation.**Dado o contexto, qual candidato é o certo?

Os dois passos são apropriados. Ambos são marcados de referência. O gasoduto combinado tem sido estável há uma década.

## O conceito

![Entity linking pipeline: mention → candidates → disambiguated entity](../assets/entity-linking.svg)

**Candidate generation.**Dado o formulário de superfície de menção ("Jordan"), procure candidatos em um índice de alias.

**Disambiguation: three approaches.**

1. **Prior + context (Milne & Witten, 2008).** `P(entity | mention) × context-similarity(entity, text)`Funciona bem, rápido, sem treino.
2. **Embedding-based (ESS / REL / Blink).**Encode menção + contexto. Encode a descrição de cada candidato. Escolha max cosine. O padrão 2020-2024.
3. **Generative (GENRE, 2021; LLM-based, 2023+).**Decodificar o nome canônico da entidade token-by-token. Restringido a um trio de nomes de entidades válidas para que a saída seja garantida ser um ID KB válido.

**End-to-end vs pipeline.**Os modelos modernos (ELQ, BLINK, ExtEnD, GENRE) executam NER + geração candidata + desambiguação em um passe.

### As duas medidas

- **Mention recall (candidate gen).**A fração de ouro é mencionada onde a entrada KB correta aparece na lista de candidatos.
- **Disambiguation accuracy / F1.**Dados os candidatos corretos, com que frequência o primeiro é correto.

Um sistema com 99% de desambiguação em 80% de recall de candidatos é um pipeline de 80%.

```figure
gx-entity-linking
```

## Construí-lo

### Passo 1: criar um índice de alias a partir de redirecionamentos da Wikipédia

```python
alias_to_entities = {
    "jordan": ["Q41421 (Michael Jordan)", "Q810 (Jordan, country)", "Q254110 (Michael B. Jordan)"],
    "paris":  ["Q90 (Paris, France)", "Q663094 (Paris, Texas)", "Q55411 (Paris Hilton)"],
    "apple":  ["Q312 (Apple Inc.)", "Q89 (apple, fruit)"],
}
```

Dados alias da Wikipédia: ~ 18M (alias, entidade) pares. Descarregar de depósitos de Wikidata. Armazenar como índice invertido.

### Passo 2: Desambiguação baseada no contexto

```python
def disambiguate(mention, context, alias_index, entity_desc):
    candidates = alias_index.get(mention.lower(), [])
    if not candidates:
        return None, 0.0
    context_words = set(tokenize(context))
    best, best_score = None, -1
    for entity_id in candidates:
        desc_words = set(tokenize(entity_desc[entity_id]))
        union = len(context_words | desc_words)
        score = len(context_words & desc_words) / union if union else 0.0
        if score > best_score:
            best, best_score = entity_id, score
    return best, best_score
```

A sobreposição Jaccard é um brinquedo.`code/main.py`Passo 2 para a versão do transformador).

### Passo 3: baseado em embutidos (estilo BLINK)

```python
from sentence_transformers import SentenceTransformer
encoder = SentenceTransformer("sentence-transformers/all-MiniLM-L6-v2")

def embed_mention(text, mention_span):
    start, end = mention_span
    marked = f"{text[:start]} [MENTION] {text[start:end]} [/MENTION] {text[end:]}"
    return encoder.encode([marked], normalize_embeddings=True)[0]

def embed_entity(entity_id, description):
    return encoder.encode([f"{entity_id}: {description}"], normalize_embeddings=True)[0]
```

No tempo de índice, inserir cada entidade KB uma vez. No tempo de consulta, inserir a menção + contexto uma vez, ponto-produto contra o pool de candidatos, escolher máximo.

### Passo 4: ligação de entidades gerativas (conceito)

GENRE decodifica o título da Wikipédia da entidade caracter por caracter. A decodificação restrita (ver lição 20) garante que apenas títulos válidos possam ser emitidos. Integração estreita com um trio com suporte KB. O descendente moderno é REL-GEN e EL com saída estruturada.

```python
prompt = f"""Text: {text}
Mention: {mention}
List the best Wikipedia title for this mention.
Respond with JSON: {{"title": "..."}}"""
```

Combinado com uma lista branca (Outlines `choice`), este é o oleoduto EL mais simples a ser enviado em 2026.

### Passo 5: Avaliação da AIDA-CoNLL

A AIDA-CoNLL é o padrão de referência de EL: 1.393 artigos da Reuters, 34 mil menções, entidades da Wikipedia.`P@1`) e taxa de detecção de NIL fora do KB.

## Encurralagens

- **NIL handling.**Algumas menções não estão no KB (entidades emergentes, pessoas obscuras). Os sistemas devem prever o NIL em vez de adivinhar a entidade errada. Medido separadamente.
- **Mention boundary errors.**O NER upstream perde períodos parciais ("Bank of America" etiquetado apenas como "Bank").
- **Popularity bias.**Os sistemas treinados predizem demais as entidades frequentes.
- **Cross-lingual EL.**Mapear menções em texto chinês para entidades da Wikipédia em inglês. Requer um codificador multilingue ou um passo de tradução.
- **KB staleness.**Novas empresas, eventos, pessoas não estão no lixo da Wikipedia do ano passado.

## Usá-lo

A pilha de 2026:

| Situation | Pick |
|-----------|------|
| General-purpose English + Wikipedia | BLINK or REL |
| Cross-lingual, KB = Wikipedia | mGENRE |
| LLM-friendly, few mentions/day | Prompt Claude/GPT-4 with candidate list + constrained JSON |
| Domain-specific KB (medical, legal) | Custom BERT with KB-aware retrieval + fine-tune on domain AIDA-style set |
| Extremely low-latency | Exact-match prior only (Milne-Witten baseline) |
| Research SOTA | GENRE / ExtEnD / generative LLM-EL |

Padrão de produção que envia em 2026: NER → coref → EL em cada menção → clusters de colapso para uma entidade canônica por cluster.

## Envia-o

Salva como`outputs/skill-entity-linker.md`- Não .

```markdown
---
name: entity-linker
description: Design an entity linking pipeline — KB, candidate generator, disambiguator, evaluation.
version: 1.0.0
phase: 5
lesson: 25
tags: [nlp, entity-linking, knowledge-graph]
---

Given a use case (domain KB, language, volume, latency budget), output:

1. Knowledge base. Wikidata / Wikipedia / custom KB. Version date. Refresh cadence.
2. Candidate generator. Alias-index, embedding, or hybrid. Target mention recall @ K.
3. Disambiguator. Prior + context, embedding-based, generative, or LLM-prompted.
4. NIL strategy. Threshold on top score, classifier, or explicit NIL candidate.
5. Evaluation. Mention recall @ 30, top-1 accuracy, NIL-detection F1 on held-out set.

Refuse any EL pipeline without a mention-recall baseline (you cannot evaluate a disambiguator without knowing candidate gen surfaced the right entity). Refuse any pipeline using LLM-prompted EL without constrained output to valid KB ids. Flag systems where popularity bias affects minority entities (e.g. name-clashes) without domain fine-tuning.
```

## Exercícios

1. **Easy.**Implementar o desambiguador de contexto anterior em `code/main.py`Em 10 menções ambíguas (Paris, Jordânia, Apple).
2. **Medium.**Encode 50 menções ambíguas com um transformador de frases. Embed a descrição de cada candidato. Compare a desambiguação baseada em embutidos com a sobreposição do contexto Jaccard.
3. **Hard.**Construa um domínio de 1k de entidades (por exemplo, funcionários + produtos da sua empresa). Implemente NER + EL de ponta a ponta. Messa a precisão e recolle em 100 frases mantidas.

## Termos-chave

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| Entity linking (EL) | Link to Wikipedia | Map a mention to a unique KB entry. |
| Candidate generation | Who could it be? | Return a shortlist of plausible KB entries for a mention. |
| Disambiguation | Pick the right one | Score candidates using context, pick the winner. |
| Alias index | The lookup table | Map from surface form → candidate entities. |
| NIL | Not in KB | Explicit prediction that no KB entry matches. |
| KB | Knowledge base | Wikidata, Wikipedia, DBpedia, or your domain KB. |
| AIDA-CoNLL | The benchmark | 1,393 Reuters articles with gold entity links. |

## Mais leitura

- [Milne, Witten (2008). Learning to Link with Wikipedia](https://researchcommons.waikato.ac.nz/entities/publication/b9a0b520-abc5-47c5-a86a-da6c579893ab) a abordagem fundamental prévia+contexto.
- [Wu et al. (2020). Zero-shot Entity Linking with Dense Entity Retrieval (BLINK)](https://arxiv.org/abs/1911.03814) o cavalo de trabalho baseado em embutidos.
- [De Cao et al. (2021). Autoregressive Entity Retrieval (GENRE)](https://arxiv.org/abs/2010.00904) EL gerativo com decodificação restrita.
- [Hoffart et al. (2011). Robust Disambiguation of Named Entities in Text (AIDA)](https://www.aclweb.org/anthology/D11-1072.pdf) o documento de referência.
- [REL: An Entity Linker Standing on the Shoulders of Giants (2020)](https://arxiv.org/abs/2006.01969) a pilha de produção aberta.
