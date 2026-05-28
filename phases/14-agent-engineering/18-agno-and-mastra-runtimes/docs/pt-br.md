# Agno e Mastra: Runtimes de Produção

> Agno (Python) e Mastra (TypeScript) são o par de runtimes de produção de 2026. Agno mira em instantânea de agente em microssegundos e backends FastAPI stateless. Mastra entrega agents, tools, workflows, roteamento unificado de modelos e storage composto sobre o substrato do Vercel AI SDK.

**Tipo:** Aprender
**Linguagens:** Python, TypeScript
**Pré-requisitos:** Fase 14 · 01 (Agent Loop), Fase 14 · 13 (LangGraph)
**Tempo:** ~45 minutos

## Objetivos de Aprendizado

- Identificar os alvos de performance do Agno e quando eles importam.
- Nomear os três primitivos do Mastra — Agents, Tools, Workflows — e os server adapters suportados.
- Explicar por que um backend FastAPI stateless com escopo de sessão é o caminho recomendado de produção pro Agno.
- Escolher entre Agno e Mastra pra uma stack específica (Python-first vs TypeScript-first).

## O Problema

LangGraph, AutoGen, CrewAI são frameworks pesados. Times que querem "só o agent loop, rápido, no meu runtime" recorrem ao Agno (Python) ou Mastra (TypeScript). Ambos trocam parte dos primitivos gerenciados pelo framework por velocidade bruta e encaixe mais apertado na stack ao redor.

## O Conceito

### Agno

- Runtime Python, anteriormente Phi-data.
- "Sem graphs, chains ou padrões complicados — só python puro."
- Alvos de performance da documentação: ~2μs de instantânea de agente, ~3.75 KiB de memória por agente, ~23 providers de modelo.
- Caminho de produção: backend FastAPI stateless com escopo de sessão. Cada request cria um agente novo; estado da sessão vive no DB.
- Multimodal nativo (texto, imagem, áudio, vídeo, arquivo) e RAG agêntico.

Os alvos de performance importam quando você tem milhares de agentes de curta duração por segundo (chat fan-in, pipelines de avaliação). Importam menos quando um agente roda por 10 minutos.

### Mastra

- TypeScript, construído sobre o Vercel AI SDK.
- Três primitivos: **Agents**, **Tools** (tipadas com Zod), **Workflows**.
- Unified Model Router — 3.300+ modelos em 94 providers (março de 2026).
- Storage composto: memória, workflows, observabilidade pra backends diferentes; ClickHouse recomendado pra observabilidade em escala.
- Apache 2.0 com diretórios `ee/` sob licença source-available enterprise.
- Server adapters pra Express, Hono, Fastify, Koa; integração first-class com Next.js e Astro.
- Entrega Mastra Studio (localhost:4111) pra debug.
- 22k+ estrelas no GitHub, 300k+ downloads semanais no npm na 1.0 (janeiro de 2026).

### Posicionamento

Nenhum tenta ser o LangGraph. Eles competem em:

- **Encaixe de linguagem.** Agno pra times Python-first; Mastra pra times TypeScript-first.
- **Ergonomia do runtime.** Agno = overhead próximo de zero; Mastra = integrado com o ecossistema Vercel.
- **Observabilidade.** Ambos integram com Langfuse/Phoenix/Opik (Aula 24) mas o Mastra Studio é first-party.

### Quando escolher cada

- **Agno** — backend Python, muitos agentes de curta duração, requisitos fortes de performance, time que usa FastAPI.
- **Mastra** — backend TypeScript, deploy Next.js / Vercel, roteamento multi-provider unificado, tools tipadas com Zod.
- **LangGraph** (Aula 13) — quando estado durável e raciocínio explícito em graf importam mais que velocidade bruta.
- **OpenAI / Claude Agent SDK** — quando você quer o formato productizado do provider (Aulas 16–17).

### Onde esse pattern dá errado

- **Perf por perf.** Escolher Agno porque "2μs" soa bonito quando o workload é uma chamada de agente lenta por request. Overhead não é o gargalo.
- **Lock-in de ecossistema.** A integração estilo Vercel do Mastra é um plus no Vercel, um minus em outros lugares.
- **Confusão de licença enterprise.** Os diretórios `ee/` do Mastra são source-available, não Apache 2.0. Leia as licenças se planeja forkar.

## Construa

Essa aula é primariamente comparativa — nenhum artefato de código único faria justiça aos dois frameworks. Veja `code/main.py` pra um toy lado a lado: um fluxo mínimo "roda um agente, faz stream do output, persiste a sessão" implementado duas vezes (um no formato Agno, outro no formato Mastra).

Execute:

```
python3 code/main.py
```

Dois traces estruturalmente diferentes mas funcionalmente equivalentes.

## Use

- **Agno** — backend Python que precisa de velocidade e formato FastAPI.
- **Mastra** — backend TypeScript com muitos providers e primitivos de workflow.
- Ambos entregam hooks de observabilidade first-party. Ambos integram com Langfuse.

## Entregue

`outputs/skill-runtime-picker.md` escolhe entre Agno, Mastra, LangGraph ou um SDK de provider baseado na stack, orçamento de latência e formato operacional.

## Exercícios

1. Leia a documentação do Agno. Porte o loop ReAct stdlib (Aula 01) pro Agno. O que sumiu? O que ficou?
2. Leia a documentação do Mastra. Porte o mesmo loop pro Mastra. O que mudou na tipagem de tools (Zod vs nada)?
3. Benchmark: meça a latência de instantânea de agente na sua stack. A marca de 2μs do Agno importa pro seu workload?
4. Projete uma migração: se você vinha usando CrewAI em Python, o que quebra se migrar pro Agno?
5. Leia os termos de licença `ee/` do Mastra. Quais restrições afetariam um fork open-source?

## Termos Chave

| Termo | O que as pessoas dizem | O que realmente significa |
|-------|----------------------|--------------------------|
| Agno | "Agentes Python rápidos" | Runtime de agente stateless com escopo de sessão |
| Mastra | "Agentes TypeScript no Vercel AI SDK" | Agents + Tools + Workflows + Model Router |
| Unified Model Router | "Acesso multi-provider" | Cliente único pra 3.300+ modelos em 94 providers |
| Composite storage | "Múltiplos backends" | Memória/workflows/observabilidade cada um num store diferente |
| Mastra Studio | "Debugger local" | Interface localhost:4111 pra introspecção de agentes |
| Source-available | "Não é OSS" | Licença permite leitura do fonte mas restringe uso comercial |

## Leitura Complementar

- [Agno Agent Framework docs](https://www.agno.com/agent-framework) — alvos de performance, integração FastAPI
- [Mastra docs](https://mastra.ai/docs) — primitivos, server adapters, Model Router
- [LangGraph overview](https://docs.langchain.com/oss/python/langgraph/overview) — a alternativa stateful-graph
- [Comet Opik](https://www.comet.com/site/products/opik/) — comparações de observabilidade citadas nas integrações do Mastra
