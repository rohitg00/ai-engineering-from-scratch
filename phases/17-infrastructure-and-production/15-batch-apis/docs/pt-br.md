# Batch APIs — o Desconto de 50% como Padrão da Indústria

> Todo provider grande oferece uma batch API async com 50% de desconto e turnaround de ~24 horas. OpenAI, Anthropic, Google e a maioria das plataformas de inferência (tier batch do Fireworks, batch da Together) implementam o mesmo padrão. Empilhe batch com prompt caching e pipelines noturnos caem para ~10% do custo síncrono-uncached. A regra é brutalmente simples: se não é interativo, pertence ao batch. Pipelines de geração de conteúdo, classificação de documentos, extração de dados, geração de relatórios, rotulagem em massa, tag de catálogo — qualquer coisa tolerante a 24h de latência é dinheiro deixado na mesa até migrar para batch. O padrão de produção de 2026 é triar cada novo workload LLM em três faixas: interativo (síncrono com cache), semi-interativo (fila async com fallback), batch (noturno, input cached empilhado). Workloads que fingem ser interativos mas toleram minutos de latência desperdiçam mais.

**Tipo:** Aprender
**Linguagens:** Python (stdlib, simulador de custo batch-vs-sync)
**Pré-requisitos:** Fase 17 · 14 (Prompt e Cache Semântico)
**Tempo:** ~45 minutos

## Objetivos de Aprendizado

- Nomear as três batch APIs dos providers (OpenAI, Anthropic, Google) e os descontos de 50% + turnaround de 24h em comum.
- Calcular o custo de empilhar batch + input cached num workload noturno de classificação e comparar com o baseline síncrono-uncached.
- Triar um workload em interativo / semi-interativo / batch e justificar a faixa.
- Nomear as duas armadilhas: parcial-interatividade (usuário espera mais rápido que 24h) e drift de output-schema (formato de arquivo batch difere por provider).

## O Problema

Seu time lança um pipeline de geração de relatórios noturnos. 50.000 documentos, resumir cada um, clusterizar os resumos, redigir um briefing executivo. Rodando síncrono leva 4 horas a $2.000/noite. Você ouve falar das batch APIs.

O batch te dá 50% de desconto. Você também habilita prompt caching no system prompt (compartilhado entre todas as 50k chamadas). Empilhado, a conta cai para $180/noite — ~9% do baseline. Mesmo pipeline, três mudanças de config.

Batch é a alavanca mais barata no kit de custo LLM que ninguém puxa. O motivo é maioritariamente organizações: times pensam "tempo real" quando o SLA na verdade é "de manhã." Esta aula é sobre não deixar 90% da conta na mesa.

## O Conceito

### As três batch APIs

**Batch API da OpenAI**: upload de arquivo JSONL com lista de requests. Promete turnaround de 24 horas (geralmente ~2-8 horas na prática). 50% de desconto em tokens de input e output. Endpoint `/v1/batches`. Inputs elegíveis a cache também recebem pricing de input cached em cima.

**Message Batches do Anthropic**: upload JSONL. Turnaround de 24 horas. 50% de desconto. Suporta `cache_control` — escritas de cache são explícitas, leituras acontecem automaticamente dentro do batch.

**Batch Prediction do Google Vertex AI**: input via BigQuery ou GCS. Desconto similar de 50% para Gemini. Integra com Vertex pipelines.

### Semântico: assíncrono, não lento

Batch é "eu prometo retornar dentro de 24 horas" — não "isso vai levar 24 horas." P50 típico é 2-6 horas. Provider agenda seu batch durante janelas off-peak quando a GPU está subutilizada.

### Empilhe com cache

Uma summarização de 50k documentos com o mesmo system prompt de 4K tokens:

- Síncrono uncached: 50000 × ($input × 4000 + $output × 200) em taxas cheias.
- Síncrono cached: system prompt cacheado após primeira escrita; os 49999 restantes recebem input 10x mais barato.
- Batch cached: tudo o mais plus 50% de desconto tanto em leitura quanto escrita.

O empilho: batch + cache = ~10% da conta síncrona uncached. Qualquer workload que roda de noite e tem um system prompt compartilhado deveria usar isso.

### Triagem de workload

**Interativo** — usuário espera pela resposta. TTFT importa. Chamada síncrona com prompt caching. Não dá para batch.

**Semi-interativo** — usuário submete uma tarefa, volta em minutos. Fila async com fallback síncrono se batch não disponível. Pense em indexação RAG de volume moderado.

**Batch** — usuário espera resultados "de manhã" ou "próxima hora." Pipelines de conteúdo, classificação em escala, análise offline. Sempre batch, sempre empilhar cache.

Erro comum: classificar tudo como interativo porque o pipeline é produção. Produção não é uma especificação de latência — SLA é.

### A armadilha da parcial-interatividade

Algumas features parecem interativas mas toleram 5-10 minutos. Exemplo: um relatório noturno de saúde do cliente com botão de "atualizar." Usuário clica em atualizar; esperar 10 minutos tá ok. Time lança como síncrono. 50 refreshes concorrentes custam 10x o que batched-e-entregue-por-email custaria.

A pergunta a fazer: "O que 24 horas significa para esse usuário?" Se a resposta é "ele não notaria", use batch.

### A armadilha do output-schema

Formatos de arquivo batch diferem por provider:

- OpenAI: JSONL, um request por linha.
- Anthropic: JSONL, uma mensagem por linha; formato de resposta embarcado.
- Vertex: tabela BigQuery ou prefixo GCS com TFRecord.

Escrever "um client de batch" para todos os providers significa código adaptador por provider. Gateways que anunciam batch multi-provider (Portkey, LiteLLM em alguns tiers) ainda fazem wrap fino do formato bruto.

### Números que você deve lembrar

- Desconto batch entre providers: 50% fixo em input + output.
- SLA de turnaround: 24 horas garantido, P50 típico de 2-6 horas.
- Batch empilhado + input cached: ~10% do custo síncrono uncached.
- Regra de triagem: se latência de 24h é aceitável, sempre batch.

## Use

`code/main.py` calcula custos entre síncrono, síncrono+cache, batch e batch+cache para um workload de 50k documentos. Reporta economia em $ e percentual.

## Entregue

Esta aula produz `outputs/skill-batch-triager.md`. Dadas características do workload, tria em interativo/semi/batch e estima economia.

## Exercícios

1. Execute `code/main.py`. Para um pipeline de 100k documentos com system prompt de 3K tokens e output de 500 tokens, calcule a economia do stack completo (batch + cache) vs baseline síncrono.
2. Escolha três features num produto real que você conheça. Trie cada uma em interativo/semi/batch.
3. Um usuário reclama que seu relatório levou 3 horas. Foi um batch mal-triado ou um interativo legítimo? Escreva o critério de decisão.
4. Sua batch API tem SLA de retorno de 24h mas P99 de 20 horas. Como você comunica isso ao usuário — qual é o comportamento do sistema downstream no caso extremo?
5. Calcule break-even: em que comprimento de prefixo compartilhado batch + cache fica mais barato que rodar de noite na sua GPU reservada?

## Termos-Chave

| Termo | O que as pessoas dizem | O que realmente significa |
|-------|----------------------|--------------------------|
| Batch API | "desconto async" | 50% off com turnaround de 24h |
| JSONL | "formato batch" | Um request JSON por linha; padrão OpenAI/Anthropic |
| Message Batches | "batch Anthropic" | Nome do produto batch da Anthropic |
| Batch prediction | "batch do Vertex" | Produto batch do Vertex AI |
| SLA de turnaround | "promessa de 24h" | Garantia, não típico; típico é 2-6h |
| Triagem de workload | "decisão de interatividade" | Decisão de roteamento interativo / semi / batch |
| Schema de output | "formato de resposta" | Layout JSONL por-provider; não é portável |
| Desconto empilhado | "batch + cache" | ~10% da conta síncrona uncached quando ambos se aplicam |

## Leituras Adicionais

- [Batch API da OpenAI](https://platform.openai.com/docs/guides/batch) — formato JSONL e semântica `/v1/batches`.
- [Message Batches do Anthropic](https://docs.anthropic.com/en/docs/build-with-claude/batch-processing) — formato batch e interação com `cache_control`.
- [Batch Prediction do Vertex AI](https://cloud.google.com/vertex-ai/generative-ai/docs/model-reference/batch-prediction) — semântica batch do Gemini.
- [Finout — Comparação de Preços OpenAI vs Anthropic 2026](https://www.finout.io/blog/openai-vs-anthropic-api-pricing-comparison)
- [Zen Van Riel — Comparação de Custos LLM API 2026](https://zenvanriel.com/ai-engineer-blog/llm-api-cost-comparison-2026/)
