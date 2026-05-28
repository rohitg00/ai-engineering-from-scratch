# AI Gateways — LiteLLM, Portkey, Kong AI Gateway, Bifrost

> Um gateway fica entre seus apps e providers de modelo. Funcionalidades centrais são roteamento de providers, fallback, retries, rate limits, referências de secrets, observabilidade, guardrails. Divisão do mercado em 2026: **LiteLLM** é OSS MIT com 100+ providers, compatível com OpenAI, mas desmorona em torno de ~2000 RPS (8 GB de memória, falhas em cascata em benchmarks publicados); melhor para Python, <500 RPS, dev/prototipagem. **Portkey** posicionado como control-plane (guardrails, redação de PII, detecção de jailbreak, trilhas de auditoria), virou open-source Apache 2.0 em março 2026, 20-40 ms de overhead de latência, tier de produção a $49/mês. **Kong AI Gateway** construído sobre Kong Gateway — benchmark próprio do Kong em 12 CPUs equivalentes: 228% mais rápido que Portkey, 859% mais rápido que LiteLLM; pricing de $100/modelo/mês (máx 5 no tier Plus); se encaixa em enterprise se você já usa Kong. **Bifrost** (Maxim AI) — retries automáticos com backoff configurável, reserva para Anthropic em 429 da OpenAI. **Cloudflare / Vercel AI Gateways** — gerenciados, zero-ops, retry básico. Residência de dados é o que força a decisão de self-host; Portkey e Kong ficam no meio com OSS + gerenciado opcional.

**Tipo:** Aprender
**Linguagens:** Python (stdlib, simulador de gateway-routing)
**Pré-requisitos:** Fase 17 · 01 (Plataformas LLM Gerenciadas), Fase 17 · 16 (Roteamento de Modelo)
**Tempo:** ~60 minutos

## Objetivos de Aprendizado

- Enumerar as seis funcionalidades centrais de gateway (roteamento, fallback, retries, rate limits, secrets, observabilidade, guardrails).
- Mapear quatro gateways de 2026 (LiteLLM, Portkey, Kong AI, Bifrost) para tetos de escala e casos de uso.
- Citar o benchmark do Kong (228% vs Portkey, 859% vs LiteLLM) e explicar por que isso importa para >500 RPS.
- Escolher self-hosted vs gerenciado dada residência de dados e orçamento de ops.

## O Problema

Seu produto chama OpenAI, Anthropic e um Llama self-hosted. Cada provider tem um SDK diferente, modelo de erro, rate limit e esquema de auth. Você quer failover (se OpenAI der 429, tente Anthropic), um store de credenciais unificado, observabilidade unificada e rate limits por tenant.

Reinventar isso na camada da aplicação acopla cada serviço a cada provider. Uma camada gateway consolida em um processo com uma API (tipicamente compatível com OpenAI) que distribui para os providers.

## O Conceito

### Seis funcionalidades centrais

1. **Roteamento de providers** — OpenAI, Anthropic, Gemini, self-hosted, etc. atrás de uma API.
2. **Fallback** — em 429, 5xx ou falha de qualidade, tente em outro lugar.
3. **Retries** — backoff exponencial, tentativas limitadas.
4. **Rate limits** — por-tenant, por-key, por-modelo.
5. **Referências de secrets** — puxe credenciais do vault em runtime (nunca no app).
6. **Observabilidade** — OTel + atributos GenAI (Fase 17 · 13) + atribuição de custo.
7. **Guardrails** — redação de PII, detecção de jailbreak, filtros de tópicos permitidos.

### LiteLLM — OSS MIT, Python

- 100+ providers, compatível com OpenAI, config de router, fallback, observabilidade básica.
- Desmorona em torno de 2000 RPS no benchmark do Kong; footprint de 8 GB, falhas em cascata sob carga sustentada.
- Melhor caso: app Python, <500 RPS, gateways dev/staging, roteamento experimental.
- Custo: $0 para OSS; existe tier grátis na cloud.

### Portkey — posicionamento de control-plane

- Apache 2.0 OSS desde março 2026. Guardrails, redação de PII, detecção de jailbreak, trilhas de auditoria.
- 20-40 ms de overhead de latência por request.
- $49/mês para tier de produção com retenção + SLA.
- Melhor caso: indústrias reguladas precisando de guardrails + observabilidade empacotados.

### Kong AI Gateway — o jogo da escala

- Construído sobre Kong Gateway (produto maduro de API gateway, lua+OpenResty).
- Benchmark próprio do Kong em equivalente de 12 CPUs: 228% mais rápido que Portkey, 859% mais rápido que LiteLLM.
- Pricing: $100/modelo/mês, máx 5 no tier Plus.
- Melhor caso: já usa Kong; >1000 RPS; disposto a licenciar.

### Bifrost (Maxim AI)

- Retries automáticos com backoff configurável.
- Fallback para Anthropic em 429 da OpenAI é uma receita canônica.
- Entrante mais novo; comercial.

### Cloudflare AI Gateway / Vercel AI Gateway

- Gerenciados, zero-ops. Retry e observabilidade básicos.
- Melhor caso: apps JavaScript servindo na edge via Cloudflare/Vercel.
- Limitados comparados a Kong/Portkey em guardrails e rate limits.

### Self-hosted vs gerenciado

Residência de dados é o que força a decisão. Saúde e finanças defaultam para self-host (LiteLLM ou Portkey OSS ou Kong). Produtos consumidor defaultam para gerenciado (Cloudflare AI Gateway) ou tier intermediário (Portkey gerenciado). Híbrido: self-hosted para tenant regulado, gerenciado para os outros.

### Orçamento de latência

- LiteLLM: 5-15 ms de overhead típico.
- Portkey: 20-40 ms de overhead.
- Kong: 3-8 ms de overhead.
- Cloudflare/Vercel: 1-3 ms de overhead (vantagem de edge).

Overhead de gateway adiciona diretamente ao TTFT. Para TTFT P99 < 100 ms SLA, Kong ou Cloudflare. Para P99 < 500 ms, qualquer.

### Semântica de rate limits importa

Token-bucket simples funciona até escala moderada. Multi-tenant requer sliding-window + burst allowance + tiering por-tenant. LiteLLM entrega token-bucket; Kong entrega sliding-window; Portkey entrega com tiers.

### Gateway + observabilidade + roteamento compõem

Fase 17 · 13 (observabilidade) + 16 (roteamento de modelo) + 19 (gateways) são a mesma camada em produção. Escolha uma ferramenta que cubra todas as três ou conecte com cuidado: a maioria dos deployments de 2026 combina Helicone (observabilidade) ou Portkey (guardrails) com Kong (escala) em papéis separados.

### Números que você deve lembrar

- LiteLLM: desmorona em ~2000 RPS, 8 GB de memória.
- Portkey: 20-40 ms de overhead; Apache 2.0 desde março 2026.
- Kong: 228% mais rápido que Portkey, 859% mais rápido que LiteLLM.
- Pricing Kong: $100/modelo/mês, máx 5 no tier Plus.
- Cloudflare/Vercel: 1-3 ms de overhead na edge.

## Use

`code/main.py` simula roteamento de gateway com reserva entre 3 providers sob injeção de 429/5xx. Reporta latência, taxa de retry e taxa de hit de fallback.

## Entregue

Esta aula produz `outputs/skill-gateway-picker.md`. Dados escala, postura de ops, conformidade, orçamento de latência, escolhe um gateway.

## Exercícios

1. Execute `code/main.py`. Configure reserva OpenAI→Anthropic→self-hosted. Qual é a taxa de hit esperada com 5% de taxa de erro do provider?
2. Seu SLA é TTFT P99 < 200 ms em baseline de 300 ms. Quais gateways ficam dentro do orçamento?
3. Um cliente de saúde requer self-hosted + redação de PII + auditoria. Escolha Portkey OSS ou Kong.
4. Compare LiteLLM vs Kong: em que teto de RPS um time deveria migrar?
5. Projete uma política de rate limits para um SaaS multi-tenant: tier gratuito, tier de trial, tier pago. Token-bucket ou sliding-window?

## Termos-Chave

| Termo | O que as pessoas dizem | O que realmente significa |
|-------|----------------------|--------------------------|
| Gateway | "broker de API" | Processo entre apps e providers |
| LiteLLM | "o MIT" | OSS Python, 100+ providers, desmorona em 2K RPS |
| Portkey | "gateway de guardrails" | Control-plane + observabilidade, Apache 2.0 |
| Kong AI Gateway | "o de escala" | Construído sobre Kong Gateway, líder em benchmarks |
| Bifrost | "gateway da Maxim" | Retries + receita de reserva Anthropic |
| Cloudflare AI Gateway | "edge gerenciado" | Gateway gerenciado na edge, zero-ops |
| Redação PII | "limpeza de dados" | Máscara Regex + NER antes de enviar ao modelo |
| Detecção de jailbreak | "guard de prompt injection" | Classificador no input do usuário |
| Trilha de auditoria | "log regulatório" | Registro imutável de cada chamada LLM |
| Token-bucket | "rate limit simples" | Rate limiter baseado em reabastecimento |
| Sliding-window | "rate limit preciso" | Rate limiter com janela de tempo; melhor justiça |

## Leituras Adicionais

- [Benchmark Kong AI Gateway](https://konghq.com/blog/engineering/ai-gateway-benchmark-kong-ai-gateway-portkey-litellm)
- [TrueFoundry — Comparação de AI Gateways 2026](https://www.truefoundry.com/blog/a-definitive-guide-to-ai-gateways-in-2026-competitive-landscape-comparison)
- [Techsy — Top Ferramentas LLM Gateway 2026](https://techsy.io/en/blog/best-llm-gateway-tools)
- [GitHub LiteLLM](https://github.com/BerriAI/litellm)
- [GitHub Portkey](https://github.com/Portkey-AI/gateway)
- [Docs Kong AI Gateway](https://docs.konghq.com/gateway/latest/ai-gateway/)
