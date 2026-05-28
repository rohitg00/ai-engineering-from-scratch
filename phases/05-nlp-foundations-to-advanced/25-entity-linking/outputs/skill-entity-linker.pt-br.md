---
name: entity-linker
description: Projete um pipeline de ligação de entidades - KB, gerador de candidatos, desambiguador, avaliação.
version: 1.0.0
phase: 5
lesson: 25
tags: [nlp, entity-linking, knowledge-graph]
---

Dado um caso de uso (domínio KB, idioma, volume, orçamento de latência), resultado:

1. Base de conhecimento. Wikidata/Wikipedia/KB personalizada. Data da versão. Atualizar cadência.
2. Gerador de candidatos. Índice de alias, incorporação ou híbrido. Lembrete de menção alvo @ K.
3. Desambiguador. Prévio + contexto, baseado em incorporação, generativo ou solicitado por LLM.
4. Estratégia NIL. Limite na pontuação máxima, classificador ou candidato NIL explícito.
5. Avaliação. Mencione recall @ 30, precisão top-1, detecção NIL F1 no conjunto retido.

Recuse qualquer pipeline EL sem uma linha de base de recuperação de menção (você não pode avaliar um desambiguador sem saber que a geração candidata revelou a entidade certa). Recuse qualquer pipeline usando EL solicitado pelo LLM sem saída restrita a IDs de KB válidos. Sinalize sistemas onde o viés de popularidade afeta entidades minoritárias (por exemplo, conflitos de nomes) sem ajuste fino de domínio.