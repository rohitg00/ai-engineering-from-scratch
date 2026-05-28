---
name: re-designer
description: Projete um pipeline de extração de relação com proveniência e canonização.
version: 1.0.0
phase: 5
lesson: 26
tags: [nlp, relation-extraction, knowledge-graph]
---

Dado um corpus (domínio, idioma, volume) e uso downstream (KG-RAG, análise, conformidade), resultado:

1. Extrator. Híbrido baseado em padrões / supervisionado / LLM / AEVS. Razão ligada à precisão vs alvo de recall.
2. Ontologia. Lista de propriedades fechada (Wikidata/domínio) ou IE aberto com passe de canonização.
3. Proveniência. Cada triplo carrega fonte char-span + doc id. Não negociável para auditoria.
4. Mesclar estratégia. ID de entidade canônica + ID de relação + qualificadores temporais; política de desduplicação.
5. Avaliação. Precisão/recall em 200 triplos rotulados à mão + taxa de alucinação na amostra extraída do LLM.

Recuse qualquer pipeline de RE baseado em LLM sem verificação de extensão (proveniência da fonte). Recuse a saída do IE aberto fluindo para um gráfico de produção sem canonização. Sinalize pipelines sem qualificador temporal em relações com limite de tempo (empregador, cônjuge, cargo).