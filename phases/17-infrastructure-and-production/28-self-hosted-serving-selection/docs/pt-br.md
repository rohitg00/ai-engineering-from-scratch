# Seleção de Serving Self-Hosted — llama.cpp, Ollama, TGI, vLLM, SGLang

> Quatro engines dominam inferência self-hosted em 2026. Escolha com base em hardware, escala e ecossistema. **llama.cpp** é o mais rápido em CPU — maior suporte a modelos, controle total sobre quantização e threading. **Ollama** é o instalador de um comando do laptop do dev, ~15-30% mais lento que o llama.cpp (Go + CGo + serialização HTTP), gap de throughput de 3x sob carga parecida com produção. **TGI entrou em modo de manutenção em 11 de dezembro de 2025** — só correções de bug, ~10% de throughput bruto menor que o vLLM mas historicamente top de observabilidade e integração com ecossistema HF. Esse status de manutenção o torna uma aposta arriscada a longo prazo — SGLang ou vLLM são padrões mais seguros para projetos novos. **vLLM** é o padrão de produção geral — v0.15.1 (fevereiro 2026) adiciona PyTorch 2.10, RTX Blackwell SM120, otimização H200. **SGLang** é o eespecificaçãoialista em multi-turn agentic / prefix-heavy — 400.000+ GPUs em produção (xAI, LinkedIn, Cursor, Oracle, GCP, Azure, AWS). Restrições de hardware: CPU-only → só llama.cpp. AMD / não-NVIDIA → só vLLM (TRT-LLM é travado na NVIDIA). Padrão de pipeline de 2026: dev = Ollama, staging = llama.cpp, prod = vLLM ou SGLang. Mesmos pesos GGUF/HF do começo ao fim.

**Tipo:** Aprender
**Linguagens:** Python (stdlib, caminhador de árvore de decisão de engines)
**Pré-requisitos:** Todas as aulas da Fase 17 que cobrem engines (04, 06, 07, 09, 18)
**Tempo:** ~45 minutos

## Objetivos de Aprendizado

- Escolher uma engine dada hardware (CPU / AMD / NVIDIA Hopper / Blackwell), escala (1 usuário / 100 / 10.000) e workload (chat geral / agente / longo contexto).
- Nomear o status de manutenção do TGI em 2026 (11 de dezembro de 2025) e por que isso inclina projetos novos para vLLM ou SGLang.
- Descrever o pipeline dev/staging/prod usando os mesmos pesos GGUF ou HF do começo ao fim.
- Explicar por que "só CPU" força llama.cpp e "AMD" exclui TRT-LLM.

## O Problema

Seu time começa um novo projeto de LLM self-hosted. Um engenheiro diz Ollama, outro diz vLLM, um terceiro diz "o TGI não funciona fora da caixa?" Os três estão certos pra contextos diferentes. Nenhum está certo pra todos.

Em 2026 a árvore de decisão importa: hardware primeiro, escala segundo, workload terceiro. E um evento eespecificaçãoífico de 2025 — TGI entrando em modo de manutenção em 11 de dezembro — muda o padrão pra projetos novos.

## O Conceito

### As cinco engines

| Engine | Melhor para | Notas |
|--------|-------------|-------|
| **llama.cpp** | CPU / edge / deps mínimas / maior suporte a modelos | Mais rápido em CPU, controle total |
| **Ollama** | Laptops de dev, um usuário, instalação de um comando | 15-30% mais lento que llama.cpp; gap de 3x em throughput de prod |
| **TGI** | Ecossistema HF, indústrias reguladas | **Modo de manutenção Dez 11, 2025** |
| **vLLM** | Produção geral, 100+ usuários | Padrão de produção amplo; v0.15.1 Fev 2026 |
| **SGLang** | Multi-turn agentic, workloads prefix-heavy | 400.000+ GPUs em produção |

### Decisão primeiro por hardware

**Só CPU** → llama.cpp. Ollama também funciona mas é mais lento. Nenhuma outra engine é competitiva em CPU.

**GPU AMD** → vLLM (suporte AMD ROCm). SGLang também funciona. TRT-LLM é travado na NVIDIA, então fica fora.

**NVIDIA Hopper (H100 / H200)** → vLLM ou SGLang ou TRT-LLM. Todos três top-tier.

**NVIDIA Blackwell (B200 / GB200)** → TRT-LLM é o líder de throughput (Fase 17 · 07). vLLM e SGLang logo atrás.

**Apple Silicon (série M)** → llama.cpp (Metal). Ollama encapsula isso.

### Decisão segundo por escala

**1 usuário / dev local** → Ollama. Um comando, primeiro token em segundos.

**10-100 usuários / time pequeno** → vLLM single-GPU.

**100-10k usuários / produção** → vLLM production-stack (Fase 17 · 18) ou SGLang.

**10k+ usuários / enterprise** → vLLM production-stack + disaggregated (Fase 17 · 17) + LMCache (Fase 17 · 18).

### Decisão terceira por workload

**Chat geral / Q&A** → vLLM ganha como padrão amplo.

**Multi-turn agentic (ferramentas, planejamento, memória)** → RadixAttention do SGLang (Fase 17 · 06) domina.

**RAG com alta reutilização de prefixo** → SGLang.

**Geração de código** → vLLM bom; SGLang levemente melhor em cache.

**Longo contexto (128K+)** → vLLM + prefill fragmentado; SGLang + KV em camadas.

### A armadilha do modo de manutenção do TGI

TGI do Hugging Face entrou em modo de manutenção em 11 de dezembro de 2025 — só correções de bug dali pra frente. Historicamente: observabilidade top-tier, integração melhor do ecossistema HF (model cards, ferramentas de segurança), levemente atrás do vLLM em throughput bruto.

Para projetos novos em 2026: padrão longe do TGI. Deploys existentes do TGI podem continuar mas devem migrar eventualmente. SGLang e vLLM são os padrões mais seguros.

### O padrão de pipeline

Dev (Ollama) → staging (llama.cpp) → prod (vLLM). Mesmos pesos GGUF ou HF do começo ao fim. Engenheiros iteram rápido nos laptops; staging espelha quantização de produção; prod é o target de serving.

### Reserva sobre Ollama

Ollama é ótimo para dev. Não é ótimo para produção compartilhada: serialização HTTP do Go adiciona overhead, gestão de concorrência é mais simples que vLLM, suporte a OpenTelemetry fica atrás. Use Ollama onde brilha — um usuário, um comando — e mude pra vLLM quando compartilhar.

### Self-hosted vs gerenciado é uma decisão separada

Fase 17 · 01 (hyperscalers gerenciados), · 02 (plataformas de inferência) cobrem gerenciado. Esta aula assume que você já decidiu self-hospedar. Razões pra self-hospedar: residência de dados, fine-tuning customo, custo total de posse em escala, modelo de domínio não disponível em hosted.

### Números pra lembrar

- TGI modo de manutenção: 11 de dezembro de 2025.
- vLLM v0.15.1: fevereiro 2026; PyTorch 2.10; suporte Blackwell SM120.
- Pegada de produção do SGLang: 400.000+ GPUs.
- Gap de throughput do Ollama vs llama.cpp: 15-30% mais lento; 3x sob carga de prod.

## Use

`code/main.py` é um caminhador de árvore de decisão: dado hardware + escala + workload, escolhe uma engine e explica por quê.

## Entregue

Esta aula produz `outputs/skill-engine-picker.md`. Dadas restrições, escolhe uma engine e escreve o plano de migração.

## Exercícios

1. Execute `code/main.py` com seu hardware / escala / workload. O output combina com sua intuição?
2. Sua infra tem 12 H100s e 8 MI300X AMD. Qual engine? Por que TRT-LLM fica fora da mesa?
3. Um time quer usar TGI em 2026 porque "é o que a gente conhece." Argumente o caso pra migração.
4. Do Ollama em dev pro vLLM em prod: o que muda em quantização, configuração e observabilidade?
5. Produto de RAG com P99 de tamanho de prefixo 8K e alta reutilização entre tenants. Escolha uma engine e combine com Fase 17 · 11 + 18.

## Termos Chave

| Termo | O que a gente diz | O que realmente significa |
|-------|-------------------|---------------------------|
| llama.cpp | "o de CPU" | Maior suporte a modelos, mais rápido em CPU |
| Ollama | "o do laptop" | Instalação de um comando, throughput de nível dev |
| TGI | "o serving do HF" | Modo de manutenção desde Dez 2025 |
| vLLM | "o padrão" | Baseline de produção ampla 2026 |
| SGLang | "o agentic" | Prefix-heavy, RadixAttention |
| TRT-LLM | "travado na NVIDIA" | Líder de throughput Blackwell, só NVIDIA |
| GGUF | "formato do llama.cpp" | Variantes K-quant empacotadas |
| Production-stack | "vLLM no K8s" | Deploy de referência da Fase 17 · 18 |
| Padrão de pipeline | "dev→stage→prod" | Ollama → llama.cpp → vLLM nos mesmos pesos |

## Leitura Complementar

- [AI Made Tools — vLLM vs Ollama vs llama.cpp vs TGI 2026](https://www.aimadetools.com/blog/vllm-vs-ollama-vs-llamacpp-vs-tgi/)
- [Morph — llama.cpp vs Ollama 2026](https://www.morphllm.com/comparisons/llama-cpp-vs-ollama)
- [n1n.ai — Comprehensive LLM Inference Engine Comparison](https://explore.n1n.ai/blog/llm-inference-engine-comparison-vllm-tgi-tensorrt-sglang-2026-03-13)
- [PremAI — 10 Best vLLM Alternatives 2026](https://blog.premai.io/10-best-vllm-alternatives-for-llm-inference-in-production-2026/)
- [TGI maintenance announcement](https://github.com/huggingface/text-generation-inference) — release notes.
- [vLLM v0.15.1 release notes](https://github.com/vllm-project/vllm/releases)
