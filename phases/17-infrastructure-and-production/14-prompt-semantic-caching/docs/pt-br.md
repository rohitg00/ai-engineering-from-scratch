# Prompt Caching e Economia de Cache Semântico

> **Snapshot de preços datado de 2026-04.** Os valores numéricos abaixo refletem as tabelas de preços dos vendors capturadas na publicação desta aula; verifique nos docs vinculados antes de citá-los.

> Cache acontece em duas camadas. L2 (no nível do provider) prompt/prefix caching reutiliza attention KV para prefixos repetidos — os docs de prompt caching do Anthropic anunciam até 90% de redução de custo e 85% de redução de latência em prompts longos; para Claude 3.5 Sonnet, leituras de cache custam $0.30/M vs $3.00/M fresh com TTL de 5 minutos e premium de escrita de 2x para a opção de TTL de 1 hora (docs.anthropic.com, 2026-04). O prompt caching da OpenAI se aplica automaticamente para prompts ≥1024 tokens e cobra entrada cached com desconto de ~90% vs fresh (platform.openai.com, 2026-04); a taxa exata por modelo depende da tabela de preços vigente. L1 (no nível do app) cache semântico pula o LLM inteiramente em hits de similaridade de embedding. A afirmação de "95% de acurácia" dos vendors se refere à correção do match, não à taxa de hit — taxas de hit em produção variam de 10% (chat aberto) até 70% (FAQ estruturada); nenhum publicador oferece baseline oficial, então trate isso como telemetria da comunidade e não como garantia. As armadilhas de produção: paralelismo mata o cache (N requests paralelos emitidos antes do primeiro write de cache podem inflar gastos várias vezes), e conteúdo dinâmico dentro do prefixo impede hits de cache completamente. ProjectDiscovery relatou ir de 7% para 74% de hit rate (2025-11) ao mover texto dinâmico para fora do prefixo cacheável.

**Tipo:** Aprender
**Linguagens:** Python (stdlib, simulador de cache de duas camadas)
**Pré-requisitos:** Fase 17 · 04 (Internals do vLLM Serving), Fase 17 · 06 (SGLang RadixAttention)
**Tempo:** ~60 minutos

## Objetivos de Aprendizado

- Distinguir L2 prompt/prefix caching (reuso de KV no provider) de L1 cache semântico (bypass do LLM em prompts similares).
- Explicar a marcação explícita `cache_control` do Anthropic e as duas opções de TTL (5 minutos vs 1 hora) com seus multiplicadores de preço.
- Calcular a economia mensal esperada dada taxa de hit, mix prompt/resposta e preços por token.
- Nomear o anti-padrão de paralelismo que infla contas em 5-10x e o anti-padrão de conteúdo dinâmico que colapsa a taxa de hit.

## O Problema

Você adiciona prompt caching ao seu serviço de RAG. A conta continua igual. Você mede a taxa de hit; é 7%. Seus prompts parecem estáticos mas não são — o system prompt inclui a data atual formatada ao minuto, um request ID e um reorder randômico de exemplos para diversidade. Todo request escreve uma nova entrada de cache, lê zero.

Separadamente, seu agente faz dez chamadas paralelas de ferramentas por pergunta do usuário. As dez chegam ao provider antes do primeiro write de cache completar. Dez escritas, zero leituras. Sua conta é 5-10x o que "com cache" deveria custar.

Cache é um protocolo, não uma flag. Duas camadas, dois modos de falha diferentes.

## O Conceito

### L2 — prompt/prefix caching do provider

Provider armazena o attention KV para um prefixo cacheável e reutiliza no próximo request que combina o prefixo. Você paga o custo de escrita uma vez, leituras praticamente grátis.

**Anthropic (Claude 3.5 / 3.7 / 4 series)**: marca explícita `cache_control` no request. Você marca quais blocos são cacheáveis. TTL: 5 minutos (escrita custa 1.25x base) ou 1 hora (escrita custa 2x base). Leituras de cache: $0.30/M no Claude 3.5 Sonnet vs $3.00/M fresh — 10x mais barato (docs.anthropic.com, até 2026-04). Taxas diferem por modelo (Opus/Haiku publicados separadamente); sempre confira a página de preços vigente.

**OpenAI**: cache automático para prompts ≥1024 tokens (platform.openai.com, 2026-04). Sem flag explícita. Entrada cached é ~10x mais barata que fresh nas atuais tabelas gpt-4o/gpt-5. Nem docs nem release notes publicam baseline oficial de hit-rate; relatos da comunidade se agrupam entre 30-60% com design cuidadoso de prompts. Monitore `usage.cached_tokens` para medir o seu próprio.

**Google (Gemini)**: context caching via API explícita; contexto de 1M tokens significa que caching rende ainda mais.

**Self-hosted (vLLM, SGLang)**: Fase 17 · 06 cobre RadixAttention — mesmo padrão no seu próprio compute.

### L1 — cache semântico no nível do app

Antes de chamar o LLM, hash o prompt, faça embedding e procure um request cached similar (similaridade cosseno acima do threshold, tipicamente 0.95+). Em hit, retorne a resposta cached. Em miss, chame o LLM e cache o resultado.

Open-source: Redis Vector Similarity, GPTCache, Qdrant. Comercial: Portkey Cache, Helicone Cache.

A afirmação de acurácia dos vendors se refere a com que frequência a resposta cached retornada era semanticamente adequada — não a com que frequência você acerta. Taxas de hit em produção:

- Chat aberto: 10-15%.
- FAQ estruturada / suporte: 40-70%.
- Perguntas sobre código: 20-30% (variantes pequenas matam hits).
- Agentes de voz repetindo prompts: 50-80% (conjunto fixo de normalização de voz).

### O anti-padrão de paralelismo

Seu agente faz 10 chamadas de ferramentas em paralelo. Todas as 10 têm o mesmo system prompt de 4K tokens. Escritas de cache do Anthropic são por-request; a primeira escrita de cache completa em torno de 300 ms depois que o provider vê o prompt. Requests 2-10 chegam na mesma janela de milissegundo e cada um vê cache miss. Você paga 10 preços de escrita, 0 descontos de leitura.

Correção: em lote com sequencial-first — faça o request 1 sozinho, depois dispare 2-10 depois que o cache de 1 tiver populado. Adiciona 300 ms à primeira chamada de ferramenta; economiza 5-10x na conta.

### O anti-padrão de conteúdo dinâmico

Seu system prompt parece:

```
Você é um assistente útil. A hora atual é 14:32:17.
ID do usuário: abc123. Hoje é terça-feira...
```

Todo request é único. Todo request escreve. Zero hits.

Correção: mova tudo que é realmente estático para o prefixo cacheável; anexe o conteúdo dinâmico após a fronteira de cache:

```
[cacheável]
Você é um assistente útil. [regras, exemplos, instruções]
[/cacheável]
[dinâmico, não cacheado]
Hora atual: 14:32:17. Usuário: abc123.
```

ProjectDiscovery moveu de 7% para 74% de hit rate dessa forma e publicou a anatomia.

### Empilhe batch + cache para workloads noturnos

Batch APIs (Fase 17 · 15) dão 50% de desconto com turnaround de 24 horas. Input cached em cima disso te dá ~10x adicional. Workloads de classificação, rotulagem e geração de relatórios noturnos podem cair para ~10% do custo síncrono-uncached ao empilhar.

### Números que você deve lembrar

Os pontos de preço foram capturados em 2026-04 dos docs vinculados dos vendors e flutuam a cada poucos meses — reconfie antes de depender deles.

- Leitura cached Anthropic: $0.30/M no Claude 3.5 Sonnet, ~10x mais barato que entrada fresh (docs.anthropic.com).
- Premium de escrita Anthropic: 1.25x (TTL 5 min) ou 2x (TTL 1 hora).
- Cache automático OpenAI: aplica-se a prompts ≥1024 tokens; entrada cached a ~10% do preço de entrada fresh nas atuais tabelas (platform.openai.com).
- Taxa de hit de cache semântico (relato da comunidade): ~10% chat aberto; até ~70% FAQ estruturada. Não é baseline documentada pelo vendor.
- ProjectDiscovery: 7% → 74% de hit rate ao mover dinâmico para fora do prefixo (blog do projeto, 2025-11).
- Anti-padrão de paralelismo: relatos típicos de inflação de 5-10x na conta quando N requests paralelos perdem o primeiro write de cache.

## Use

`code/main.py` simula caching L1 + L2 em workloads mistos. Reporta taxas de hit, custo e mostra a penalidade de paralelismo.

## Entregue

Esta aula produz `outputs/skill-cache-auditor.md`. Dado template de prompt e tráfego, audita cacheabilidade e recomenda reestruturação.

## Exercícios

1. Execute `code/main.py`. Toggle a flag de paralelismo. Quanto muda a conta?
2. Seu system prompt tem uma data. Mova-a. Mostre a matemática antes/depois da taxa de hit.
3. Calcule o break-even para TTL de 1 hora (escrita 2x) vs TTL de 5 minutos (escrita 1.25x) dada sua taxa de chegada de requests.
4. Cache semântico no threshold 0.95 acerta 20%. No 0.85 acerta 50% mas você vê respostas cached incorretas. Escolha o threshold certo e justifique.
5. Você loteia 10 sub-queries paralelas por pergunta do usuário. Reescreva para ser cache-friendly sem adicionar latência end-to-end.

## Termos-Chave

| Termo | O que as pessoas dizem | O que realmente significa |
|-------|----------------------|--------------------------|
| L2 prompt cache | "prefix cache" | Provider armazena KV para prefixo repetido |
| `cache_control` | "marca de cache Anthropic" | Atributo explícito marcando blocos cacheáveis |
| Premium de escrita | "imposto de escrita" | Custo extra na primeira miss-to-cache (1.25x ou 2x) |
| L1 cache semântico | "embedding cache" | Hash-and-embed no nível do app antes de chamar LLM |
| GPTCache | "lib de cache LLM" | Biblioteca popular OSS de cache L1 |
| Taxa de hit | "hits / total" | Fração de requests servidos do cache |
| Anti-padrão de paralelismo | "a armadilha do N-write" | N requests paralelos perdem cache N vezes |
| Armadilha de conteúdo dinâmico | "a armadilha do time-in-prompt" | Bytes dinâmicos no prefixo matam taxa de hit |
| RadixAttention | "cache intra-réplica" | Implementação de prefix-cache do SGLang |

## Leituras Adicionais

- [Prompt Caching do Anthropic](https://docs.anthropic.com/en/docs/build-with-claude/prompt-caching) — semântica oficial `cache_control` e TTLs.
- [Prompt Caching da OpenAI](https://platform.openai.com/docs/guides/prompt-caching) — comportamento de cache automático e elegibilidade.
- [TianPan — Cache Semântico para LLMs em Produção](https://tianpan.co/blog/2026-04-10-semantic-caching-llm-production)
- [ProjectDiscovery — Reduzindo Custos LLM 59% com Prompt Caching](https://projectdiscovery.io/blog/how-we-cut-llm-cost-with-prompt-caching)
- [DigitalOcean / Anthropic — Prompt Caching](https://www.digitalocean.com/blog/prompt-caching-with-digital-ocean)
