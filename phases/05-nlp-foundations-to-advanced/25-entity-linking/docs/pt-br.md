# Entity Linking e Desambiguação

> NER encontrou "Paris." Entity linking decide: Paris, França? Paris Hilton? Paris, Texas? Paris (o príncipe troiano)? Sem linking, seu grafo de conhecimento fica ambíguo.

**Tipo:** Construir
**Linguagens:** Python
**Pré-requisitos:** Fase 5 · 06 (NER), Fase 5 · 24 (Resolução de Coreferência)
**Tempo:** ~60 minutos

## O Problema

Uma frase diz: "Jordan beat the press." Seu NER rotula "Jordan" como PESSOA. Bom. Mas *qual* Jordan?

- Michael Jordan (basquete)?
- Michael B. Jordan (ator)?
- Michael I. Jordan (professor de ML em Berkeley — sim, essa confusão é real em papers de ML)?
- Jordânia (o país)?
- Jordan (nome próprio hebraico)?

Entity linking (EL) resolve cada menção pra uma entrada única em uma base de conhecimento: Wikidata, Wikipedia, DBpedia ou sua KB de domínio. Duas subtarefas:

1. **Geração de candidatos.** Dado "Jordan," quais entradas da KB são plausíveis?
2. **Desambiguação.** Dado o contexto, qual candidato é o certo?

Ambos os passos são aprendíveis. Ambos têm benchmarks. O pipeline combinado está estável há uma década — o que muda é a qualidade do desambiguador.

## O Conceito

![Pipeline de entity linking: menção → candidatos → entidade desambiguada](../assets/entity-linking.svg)

**Geração de candidatos.** Dada a forma superficial da menção ("Jordan"), busque candidatos num índice de alias. Dicionários de alias da Wikipedia cobrem a maioria das entidades nomeadas: "JFK" → John F. Kennedy, Jacqueline Kennedy, aeroporto JFK, JFK (filme). Índice típico retorna 10-30 candidatos por menção.

**Desambiguação: três abordagens.**

1. **Prior + contexto (Milne & Witten, 2008).** `P(entidade | menção) × similaridade-contexto(entidade, texto)`. Funciona bem, rápido, sem treino.
2. **Baseada em embedding (ESS / REL / Blink).** Codifique menção + contexto. Codifique a descrição de cada candidato. Pegue o máximo de cosseno. O padrão de 2020-2024.
3. **Generativa (GENRE, 2021; baseado em LLM, 2023+).** Decodifique o nome canônico da entidade token por token. Restrito a um trie de nomes válidos de entidades pra que a saída seja garantidamente um ID válido de KB.

**End-to-end vs pipeline.** Modelos modernos (ELQ, BLINK, ExtEnD, GENRE) rodam NER + geração de candidatos + desambiguação numa única passagem. Sistemas pipeline ainda dominam em produção porque você pode trocar componentes.

### As duas medições

- **Recall de menções (gen de candidatos).** Fração de menções douradas onde a entrada correta da KB aparece na lista de candidatos. Piso pra pipeline inteira.
- **Acurácia / F1 de desambiguação.** Dados candidatos corretos, com que frequência o top-1 está certo.

Sempre reporte os dois. Um sistema com 99% de desambiguação em 80% de recall de candidatos é um pipeline de 80%.

## Construindo

### Passo 1: construir um índice de alias a partir de redirecionamentos da Wikipedia

```python
alias_to_entities = {
    "jordan": ["Q41421 (Michael Jordan)", "Q810 (Jordan, country)", "Q254110 (Michael B. Jordan)"],
    "paris":  ["Q90 (Paris, France)", "Q663094 (Paris, Texas)", "Q55411 (Paris Hilton)"],
    "apple":  ["Q312 (Apple Inc.)", "Q89 (apple, fruit)"],
}
```

Dados de alias da Wikipedia: ~18M pares (alias, entidade). Baixe de dumps da Wikidata. Armazene como índice invertido.

### Passo 2: desambiguação baseada em contexto

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

A sobreposição de Jaccard é um brinquedo. Substitua por similaridade cosseno em embeddings (veja passo-2 em `code/main.py` pra versão transformer).

### Passo 3: baseada em embedding (estilo BLINK)

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

Na hora de indexar, embed cada entidade da KB uma vez. Na hora de consulta, embed a menção + contexto uma vez, produto escalar contra o pool de candidatos, pegue o máximo.

### Passo 4: entity linking generativo (conceito)

O GENRE decodifica o título da Wikipedia da entidade caractere por caractere. Decodificação restrita (ver lição 20) garante que apenas títulos válidos possam ser produzidos. Integração apertada com um trie apoiado por KB. O descendente moderno é REL-Gen e EL via prompting de LLM com saída estruturada.

```python
prompt = f"""Text: {text}
Mention: {mention}
List the best Wikipedia title for this mention.
Respond with JSON: {{"title": "..."}}"""
```

Combinado com uma lista branca (choice do Outlines), esse é o pipeline de EL mais simples pra disponibilizar em 2026.

### Passo 5: avaliar no AIDA-CoNLL

AIDA-CoNLL é o benchmark padrão de EL: 1.393 artigos Reuters, 34k menções, entidades da Wikipedia. Reporte acurácia in-KB (`P@1`) e taxa de detecção de NIL fora da KB.

## Armadilhas

- **Tratamento de NIL.** Algumas menções não estão na KB (entidades emergentes, pessoas obscuras). Sistemas devem prever NIL em vez de adivinhar a entidade errada. Medido separadamente.
- **Erros de limite de menção.** NER upstream perde spans parciais ("Bank of America" rotulado só como "Bank"). Recall de EL cai.
- **Viés de popularidade.** Sistemas treinados super-prevêem entidades frequentes. Uma menção de "Michael I. Jordan" num paper de ML frequentemente vincula ao Jordan do basquete.
- **EL cross-lingual.** Mapear menções em texto chinês pra entidades da Wikipedia em inglês. Requer um encoder multilíngue ou um passo de tradução.
- **Desatualização da KB.** Empresas, eventos e pessoas novos não estão no dump da Wikipedia do ano passado. Pipelines de produção precisam de um ciclo de atualização.

## Usar

A stack de 2026:

| Situação | Escolha |
|-----------|------|
| Inglês geral + Wikipedia | BLINK ou REL |
| Cross-lingual, KB = Wikipedia | mGENRE |
| Amigável a LLM, poucas menções/dia | Faça prompting de Claude/GPT-4 com lista de candidatos + JSON restrito |
| KB de domínio eespecificaçãoífico (médico, jurídico) | BERT customizado com retrieval awareness da KB + fine-tuning em conjunto AIDA de domínio |
| Latência extremamente baixa | Só prior por correspondência exata (baseline Milne-Witten) |
| SOTA em pesquisa | GENRE / ExtEnD / LLM-EL generativo |

Padrão de produção em 2026: NER → coref → EL em cada menção → colapse clusters em uma entidade canônica por cluster. Saída: um ID de KB por entidade no documento, não um por menção.

## Entregar

Salve como `outputs/skill-entity-linker.md`:

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

1. **Fácil.** Implemente o desambiguador prior+contexto em `code/main.py` em 10 menções ambíguas (Paris, Jordan, Apple). Rotule manualmente a entidade correta. Meça acurácia.
2. **Médio.** Codifique 50 menções ambíguas com um sentence transformer. Embed a descrição de cada candidato. Compare desambiguação baseada em embedding com sobreposição de contexto Jaccard.
3. **Difícil.** Construa uma KB de domínio de 1k entidades (ex: funcionários + produtos da sua empresa). Implemente NER + EL de ponta a ponta. Meça precisão e recall em 100 frases de validação.

## Termos Chave

| Termo | O que as pessoas dizem | O que significa de verdade |
|------|-----------------|-----------------------|
| Entity linking (EL) | Vincular à Wikipedia | Mapear uma menção pra uma entrada única da KB. |
| Geração de candidatos | Quem poderia ser? | Retornar uma shortlist de entradas plausíveis da KB pra uma menção. |
| Desambiguação | Escolha a certa | Pontue candidatos usando contexto, escolha o vencedor. |
| Índice de alias | A tabela de busca | Mapeamento de forma superficial → entidades candidatas. |
| NIL | Não está na KB | Predição explícita de que nenhuma entrada da KB corresponde. |
| KB | Base de conhecimento | Wikidata, Wikipedia, DBpedia ou sua KB de domínio. |
| AIDA-CoNLL | O benchmark | 1.393 artigos Reuters com links de entidade dourados. |

## Leitura Complementar

- [Milne, Witten (2008). Learning to Link with Wikipedia](https://www.cs.waikato.ac.nz/~ihw/papers/08-DM-IHW-LearningToLinkWithWikipedia.pdf) — a abordagem fundamental prior+contexto.
- [Wu et al. (2020). Zero-shot Entity Linking with Dense Entity Retrieval (BLINK)](https://arxiv.org/abs/1911.03814) — o workhorse baseado em embedding.
- [De Cao et al. (2021). Autoregressive Entity Retrieval (GENRE)](https://arxiv.org/abs/2010.00904) — EL generativo com decodificação restrita.
- [Hoffart et al. (2011). Robust Disambiguation of Named Entities in Text (AIDA)](https://www.aclweb.org/anthology/D11-1072.pdf) — o paper do benchmark.
- [REL: An Entity Linker Standing on the Shoulders of Giants (2020)](https://arxiv.org/abs/2006.01969) — a stack de produção aberta.
