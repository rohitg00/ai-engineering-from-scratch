# Produção Servindo Stack  Descarga de KV e roteamento de cache-consciente

> Uma produção que serve roteador de fios em pilhas, motores e observabilidade em uma implantação Kubernetes  e trata o cache KV como um recurso que pode deixar a GPU. O descarregamento de KV extrai o cache KV da memória da GPU e reutiliza-o em consultas e motores (DRAM do CPU, em seguida, disco / Ceph). A pilha de produção do vLLM é a implantação de referência; LMCache é a camada de descarga. O conector de descarga de vLLM 0.11.0 KV (janeiro 2026) torna isso assíncrono e plugável através da API do conector (v0.9.0+). O caminho de descarga é geralmente oculto do caminho de solicitação, embora falhas de cache e promoções possam adicionar latência de ponta a ponta. LMCache é valioso mesmo sem prefixos compartilhados  quando uma GPU fica sem slots KV, pedidos preemptados podem ser restaurados da CPU em vez de recomputar prefill. Referências publicadas em 16x H100 (80 GB HBM) em 4 a3-highgpu-4g: quando o cache KV excede o HBM, tanto a descarga de CPU nativa quanto o LMCache melhoram substancialmente o throughput; em baixa pegada KV, todas as configurações correspondem à linha de base com pequenas despesas gerais.

**Type:** Learn
**Languages:** Python, TypeScript (stdlib, toy KV-spill simulator)
**Prerequisites:** Phase 17 · 04 (Serving Engine Internals), Phase 17 · 06 (SGLang/RadixAttention)
**Time:** ~60 minutes

## Objetivos de aprendizagem

- Diagrama das camadas de produção do vLLM: roteador, motores, descarga de KV, observabilidade.
- Explique a API do conector de descarga de KV (v0.9.0+) e como o caminho asincrono de 0.11.0 oculta a latência de descarga.
- Quantificar quando o LMCache CPU-DRAM ajuda (KV > HBM) vs adiciona gastos gerais (KV pequeno o suficiente para caber no HBM).
- Escolha entre o descarregamento de CPU vLLM nativo e o conector LMCache, dadas as restrições de implantação.

## O problema

Sua servidão vLLM mostra GPUs em 100% HBM com eventos de pré-empenho sempre que a concurrency sobe. As solicitações são despejadas, requisitadas e você re-preenche o mesmo prompt de 2K-token quatro vezes em um minuto.

Adicionar mais GPUs custa linearmente. Adicionar mais HBM não é possível. Mas o CPU DRAM é barato  uma tomada tem 512 GB + em ordens de latência de magnitude piores do que HBM, mas bem para "temporariamente quente" cache KV.

O LMCache extrai o cache KV para o DRAM da CPU para que as solicitações preemptadas se recuperem rapidamente, e prefixos repetidos em todos os motores compartilham o cache sem cada motor re-recarregando.

## O conceito

### Estação de produção de vLLM

`github.com/vllm-project/production-stack`é a implementação de referência Kubernetes:

- **Router** cache-consciente (fase 17 · 11). Consuma eventos de KV.
- **Engines** Trabalhadores de VLLM. Um por GPU ou por grupo TP/PP.
- **KV cache offload** Desdobramento de LMCache ou conector nativo.
- **Observability**- Prometheus raspadores, painéis de instrumentos Grafana, rastreamento OTel.
- **Control plane** Descoberta de serviços, configuração, atualizações em curso.

Enviado como operador de Helm Chart +.

### A API do conector de descarga de KV (v0.9.0+)

VLLM 0.9.0 introduziu uma API Connector para backends pluggable KV cache. Seu motor descarrega blocos para o conector; o conector os armazena (RAM, disco, armazenamento de objetos, LMCache).

VLLM 0.11.0 (janeiro 2026) adiciona um caminho de descarga assíncrono  descarga pode acontecer no fundo para que o motor não bloqueie no caso comum. A latência de ponta a ponta e o throughput ainda dependem da forma da carga de trabalho, da taxa de atropelação do cache KV e da pressão do sistema; as próprias notas do vLLM chamam a atenção para que a descarga do núcleo personalizado pode degradar o throughput em baixas taxas de atropelação e que a programação async tem problemas conhecidos de interação com a descodificação especulativa.

### Descarga de CPU nativa vs LMCache

**Native vLLM CPU offload**Mantenha blocos de KV na RAM do host. Rapido para implementar, zero salto de rede. Não cruza motores.

**LMCache connector**O bloco é acessível a qualquer motor. 16x H100 benchmarks publicados.

Selecione nativo quando um único motor tem pressão HBM. Selecione LMCache quando vários motores compartilham prefixos (RAG com instruções comuns do sistema, multi-tenant com modelos compartilhados).

### Comportamento de referência

O teste H100 de 16x (HBM de 80 GB) distribuído em 4 a3-highgpu-4g:

- Baixa pegada de KV (prompts curtos, baixa concurência): todas as configurações correspondem à linha de base, o LMCache adiciona ~ 3-5% de custos gerais.
- Impressão moderada: LMCache começa a ajudar na reutilização de prefixos em motores.
- KV excede HBM: descarga de CPU nativa e LMCache ambos melhoram substancialmente o throughput; LMCache ganha maior devido à partilha entre motores.

### Quando a LMCache é decisiva

- Serviço multi-arrendatário onde as instruções do sistema são compartilhadas entre os arrendatários.
- RAG onde os blocos de documentos repetem-se em consultas.
- Variantes de sintonia fina (LoRA) na mesma base em que a reutilização do modelo base KV reduz o trabalho redundante.
- Cargas de trabalho pesadas de preempção: restaurar a partir da CPU mais barato do que re-preencher.

### Quando não habilitar

- Pequena pressão HBM  pagas despesas gerais sem benefício.
- Contexto curto (tokens < 1K)  tempo de transferência > re-preencher.
- Carga de trabalho de inquilino único, de um único momento  não há reutilização para captura.

### Integração com a porção desagregada

Fase 17 · 17 servidor desagregado + compostos LMCache: transferências de KV do pré-enchimento do pool para decodificar o poço de terra no LMCache se não for usado; consultas subsequentes retiram do LMCache. Fase 17 · 11 roteador consciente de cache pode encaminhar para o motor cujo local OR LMCache-compartilhado cache coincide.

### Números que você deve lembrar

- VLLM 0.9.0: API do conector enviado.
- vLLM 0.11.0 (Jan 2026): caminho de descarga assíncrono; impacto de latência de ponta a ponta depende da carga de trabalho, taxa de impacto KV e pressão do sistema (não é uma garantia absoluta).
- 16x H100: LMCache ajuda quando a pegada de KV excede a HBM.
- Pressão de HBM pequena: 3-5% de custos gerais sem benefício.

```figure
zero-sharding
```

## Usá-lo

`code/main.py`Simula uma carga de trabalho pesada com e sem LMCache.

## Envia-o

Esta lição produz`outputs/skill-vllm-stack-decider.md`. Dada a forma da carga de trabalho e a implantação do vLLM, decide nativo vs LMCache vs nenhum.

## Exercícios

1. Corra .`code/main.py`A que tempo a LMCache começa a pagar?
2. Um inquilino compartilha um sistema de 6K-token de resposta em 200 consultas / hora. Calcule a economia esperada LMCache por inquilino.
3. O servidor LMCache é um único ponto de falha.
4. Para um KV de 4K-token com 70B FP8 (500 MB), qual é o tempo de leitura versus preenchimento?
5. Argumentar se o caminho asíncrono vLLM 0.11.0 é "livre"  onde se esconde a cabeça superior?

## Termos-chave

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| Production-stack | "the reference deployment" | vLLM's Kubernetes Helm chart + operator |
| Connector API | "KV backend interface" | vLLM 0.9.0+ pluggable KV store interface |
| Native CPU offload | "engine-local spill" | Store KV in host RAM of same engine |
| LMCache | "cluster KV cache" | Cross-engine KV cache server on CPU DRAM + disk |
| 0.11.0 async | "non-blocking offload" | Offload hidden behind engine stream |
| Preemption | "evict to make room" | KV cache shuffle when HBM full |
| Prefix reuse | "same system prompt" | Multiple queries share beginning; cache hit |
| Ceph tier | "disk tier" | Durable storage below DRAM in the cache hierarchy |

## Mais leitura

- [vLLM Blog — KV Offloading Connector (Jan 2026)](https://blog.vllm.ai/2026/01/08/kv-offloading-connector.html)
- [vLLM Production Stack GitHub](https://github.com/vllm-project/production-stack) Diagrama do capacete + operador.
- [LMCache for Enterprise-Scale LLM Inference (arXiv:2510.09665)](https://arxiv.org/html/2510.09665v2)
- [LMCache GitHub](https://github.com/LMCache/LMCache) Implementação do conector.
- [vLLM 0.11.0 release notes](https://github.com/vllm-project/vllm/releases) Detalhes de caminho assíncrono.
