# vLLM Production Stack com LMCache KV Offloading

> A production-stack do vLLM é o deploy de referência no Kubernetes — router, engines e observabilidade conectados juntos. LMCache é a camada de offloading que extrai KV cache da memória GPU e reutiliza entre queries e engines (CPU DRAM, depois disk/Ceph). O vLLM 0.11.0 KV Offloading Connector (Janeiro 2026) torna isso assíncrono e plugável via Connector API (v0.9.0+). Latência de offloading não é visível ao usuário. LMCache é valioso mesmo sem prefixos compartilhados — quando uma GPU fica sem slots de KV, requests preemptados podem ser restaurados da CPU ao invés de recomputar prefill. Benchmarks publicados em 16x H100 (80GB HBM) espalhados por 4 a3-highgpu-4g: quando KV cache excede HBM, tanto o offloading CPU nativo quanto o LMCache melhoram substancialmente o throughput; com footprint KV baixo, todas as configs combinam com baseline com pequeno overhead.

**Tipo:** Aprender
**Linguagens:** Python (stdlib, simulador de KV-spill)
**Pré-requisitos:** Fase 17 · 04 (Internals do vLLM Serving), Fase 17 · 06 (SGLang/RadixAttention)
**Tempo:** ~60 minutos

## Objetivos de Aprendizado

- Diagramar as camadas da production-stack do vLLM: router, engines, KV offload, observabilidade.
- Explicar a Connector API de KV Offloading (v0.9.0+) e como o caminho assíncrono do 0.11.0 esconde a latência de offload.
- Quantificar quando LMCache CPU-DRAM ajuda (KV > HBM) vs adiciona overhead (KV pequeno o suficiente para caber em HBM).
- Escolher entre offloading CPU nativo do vLLM e o connector LMCache dadas as restrições de deploy.

## O Problema

Seu serving vLLM mostra GPUs a 100% de HBM com eventos de preemption quando a concorrência sobe. Requests são evicted, reenfileirados e você refaz prefill do mesmo prompt de 2K tokens quatro vezes em um minuto. Compute da GPU é gasto em prefills redundantes; goodput está bem abaixo do throughput bruto.

Adicionar mais GPUs custa linearmente. Adicionar mais HBM não é possível. Mas CPU DRAM é barato — um socket tem 512 GB+ com latência ordens de magnitude pior que HBM mas ok para KV cache "temporariamente quente."

LMCache extrai KV cache para CPU DRAM para que requests preemptados恢复 rápido, e prefixos repetidos entre engines compartilham cache sem cada engine refazer prefill.

## O Conceito

### vLLM production-stack

`github.com/vllm-project/production-stack` é o deploy de referência no Kubernetes:

- **Router** — cache-aware (Fase 17 · 11). Consome eventos KV.
- **Engines** — workers do vLLM. Um por GPU ou por grupo TP/PP.
- **KV cache offload** — deploy do LMCache ou connector nativo.
- **Observabilidade** — scrape Prometheus, dashboards Grafana, traces OTel.
- **Control plane** — service discovery, config, rolling updates.

Entregue como Helm chart + operator.

### A Connector API de KV Offloading (v0.9.0+)

vLLM 0.9.0 introduziu uma Connector API para backends de KV cache plugáveis. Sua engine descarrega blocos no connector; connector armazena (RAM, disco, object storage, LMCache). Request precisa de um bloco, connector carrega de volta.

vLLM 0.11.0 (Janeiro 2026) adiciona um caminho assíncrono de offload — offload pode acontecer em background para que a engine não bloqueie nele no caso comum. Latência e throughput end-to-end ainda dependem da forma do workload, taxa de hit do KV cache e pressão do sistema; as notas do próprio vLLM destacam que offloading com kernel customizado pode degradar throughput em baixas taxas de hit e que agendamento assíncrono tem issues de interação conhecidas com speculative decoding.

### Offloading CPU nativo vs LMCache

**Offloading CPU nativo do vLLM**: local da engine. Armazena blocos KV na RAM do host. Rápido de implementar, zero hop de rede. Não cruza entre engines.

**Connector LMCache**: escala de cluster. Armazena blocos num servidor LMCache compartilhado (CPU DRAM + tier Ceph/S3). Blocos acessíveis a qualquer engine. 16x H100 com benchmarks publicados.

Escolha nativo quando uma única engine tem pressão de HBM. Escolha LMCache quando múltiplas engines compartilham prefixos (RAG com system prompts comuns, multi-tenant com templates compartilhados).

### Comportamento nos benchmarks

O teste com 16x H100 (80 GB HBM) espalhados por 4 a3-highgpu-4g:

- Footprint KV baixo (prompts curtos, baixa concorrência): todas as configs combinam com baseline, LMCache adiciona ~3-5% de overhead.
- Footprint moderado: LMCache começa a ajudar no reuso de prefixos entre engines.
- KV excede HBM: offloading CPU nativo e LMCache melhoram substancialmente throughput; LMCache ganho maior por compartilhamento cross-engine.

### Quando LMCache é decisivo

- Serving multi-tenant onde system prompts são compartilhados entre tenants.
- RAG onde chunks de documento se repetem entre queries.
- Variantes fine-tuned (LoRA) no mesmo base onde reuso de KV do modelo base reduz trabalho redundante.
- Workloads pesados em preemption: restaurar da CPU é mais barato que refazer prefill.

### Quando NÃO habilitar

- Pressão de HBM pequena — você paga overhead sem benefício.
- Contextos curtos (<1K tokens) — tempo de transferência > re-prefill.
- Workload single-tenant single-prompt — sem reuso para capturar.

### Integração com serving desagregado

Serving desagregado da Fase 17 · 17 + LMCache se potencializa: transferências de KV do pool de prefill para o pool de decode caem no LMCache se não usadas; queries subsequentes puxam do LMCache. Cache-aware router da Fase 17 · 11 pode rotear para a engine cujo cache local OU LMCache compartilhado corresponde.

### Números que você deve lembrar

- vLLM 0.9.0: Connector API lançada.
- vLLM 0.11.0 (Jan 2026): caminho assíncrono de offload; impacto de latência end-to-end depende do workload, taxa de hit de KV e pressão do sistema (não é garantia absoluta).
- Benchmark 16x H100: LMCache ajuda quando footprint KV excede HBM.
- Pressão de HBM pequena: 3-5% de overhead sem benefício.

## Use

`code/main.py` simula um workload pesado em preemption com e sem LMCache. Reporta prefills refeitos evitados, ganho de throughput e o ponto de equilíbrio de utilização de HBM.

## Entregue

Esta aula produz `outputs/skill-vllm-stack-decider.md`. Dada forma do workload e deploy do vLLM, decide entre nativo vs LMCache vs nenhum.

## Exercícios

1. Execute `code/main.py`. Em que utilização de HBM o LMCache começa a compensar?
2. Um tenant compartilha um system prompt de 6K tokens entre 200 queries/hora. Calcule a economia esperada do LMCache por tenant.
3. O servidor LMCache é um ponto único de falha. Projete a estratégia de HA (réplicas, fallback para nativo).
4. LMCache armazena em Ceph em disco giratório. Para KV de 4K tokens em 70B FP8 (500 MB), qual é o tempo de leitura vs re-prefill?
5. Argumente se o caminho assíncrono do vLLM 0.11.0 é "gratuito" — onde o overhead se esconde?

## Termos-Chave

| Termo | O que as pessoas dizem | O que realmente significa |
|-------|----------------------|--------------------------|
| Production-stack | "o deploy de referência" | Helm chart + operator Kubernetes do vLLM |
| Connector API | "interface de backend KV" | Interface plugável de KV store do vLLM 0.9.0+ |
| Offloading CPU nativo | "spill local da engine" | Armazenar KV na RAM host da mesma engine |
| LMCache | "KV cache de cluster" | Servidor de KV cache cross-engine em CPU DRAM + disco |
| 0.11.0 async | "offload não-bloqueante" | Offload escondido atrás do stream da engine |
| Preemption | "evict para liberar espaço" | Shuffle de KV cache quando HBM está cheia |
| Reuso de prefixo | "mesmo system prompt" | Múltiplas queries compartilham início; cache hit |
| Tier Ceph | "tier de disco" | Armazenamento durável abaixo de DRAM na hierarquia de cache |

## Leituras Adicionais

- [Blog vLLM — KV Offloading Connector (Jan 2026)](https://blog.vllm.ai/2026/01/08/kv-offloading-connector.html)
- [GitHub vLLM Production Stack](https://github.com/vllm-project/production-stack) — Helm chart + operator.
- [LMCache para Inferência LLM em Escala Enterprise (arXiv:2510.09665)](https://arxiv.org/html/2510.09665v2)
- [GitHub LMCache](https://github.com/LMCache/LMCache) — implementação do connector.
- [Release notes vLLM 0.11.0](https://github.com/vllm-project/vllm/releases) — detalhes do caminho assíncrono.
