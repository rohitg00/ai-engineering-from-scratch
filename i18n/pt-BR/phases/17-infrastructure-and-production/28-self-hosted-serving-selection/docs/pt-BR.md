# Seleção de serviço auto-hosted  Motor de correspondência para hardware e escala

> A seleção do motor é uma função de hardware, escala e ecossistema  não uma leitura de classificação. Quatro motores dominam a inferência auto-hostada em 2026: llama.cpp, Ollama, vLLM, SGLang, com TGI atrasado no modo de manutenção. **llama.cpp**é mais rápido em CPU  mais amplo suporte de modelo, controle total sobre quantização e threading. **Ollama**é a instalação de comando único de dev-laptop, ~ 15-30% mais lenta do que llama.cpp (serialização Go + CGo + HTTP), 3x diferença de throughput sob carga prod-like. **TGI entered maintenance mode December 11, 2025** apenas corrigem bugs, ~ 10% mais lento do que o vLLM, mas historicamente a observabilidade e a integração do ecossistema HF são superiores.**vLLM**é o padrão de produção de finalidade geral  v0.15.1 (fevereiro 2026) adiciona PyTorch 2.10, RTX Blackwell SM120, otimização H200. **SGLang**é o especialista em multi-turn / prefixo agencial pesado  400.000+ GPUs em produção (xAI, LinkedIn, Cursor, Oracle, GCP, Azure, AWS). Constraensões de hardware: CPU-first → llama.cpp. AMD / não NVIDIA → vLLM é o caminho mais forte-apoiado (TRT-LLM é bloqueado por NVIDIA). 2026 padrão de canalização: dev = Ollama, estagização = llama.cpp, prod = vLLM ou SGLang. Os motores assumem diferentes formatos de peso  GGUF para a família llama.cpp, HF safetensores para os motores GPU  para que uma conversão de formato possa ficar entre as etapas.

**Type:** Learn
**Languages:** Python, TypeScript (stdlib, engine-decision tree walker)
**Prerequisites:** All Phase 17 lessons covering engines (04, 06, 07, 09, 18)
**Time:** ~45 minutes

## Objetivos de aprendizagem

- Escolha um motor dado hardware (CPU / AMD / NVIDIA Hopper / Blackwell), escala (1 usuário / 100 / 10,000), e carga de trabalho (chat geral / agente / longo contexto).
- Cite o status de modo de manutenção TGI 2026 (11 de dezembro de 2025) e por que ele desvia novos projetos para vLLM ou SGLang.
- Descrever o processo de desenvolvimento/estagem/produtor, incluindo onde uma conversão de formato GGUF em safetensores se situa entre as fases.
- Explique por que "CPU-first" aponta para llama.cpp e "AMD" exclui TRT-LLM.

## O problema

A sua equipe inicia um novo projeto de LLM auto-anfitrião. Um engenheiro diz Ollama, outro diz vLLM, um terceiro diz "o TGI não funciona fora da caixa?" Todos os três são adequados para diferentes contextos. Nenhum é adequado para todos.

Em 2026, a árvore de escolha importa: hardware primeiro, escala segunda, carga de trabalho terceira. E um evento específico de 2025  TGI entrando no modo de manutenção 11 de dezembro  altera o padrão para novos projetos.

## O conceito

### Os cinco motores

| Engine | Best for | Notes |
|--------|----------|-------|
| **llama.cpp** | CPU / edge / minimal deps / widest model support | Fastest on CPU, full control |
| **Ollama** | Dev laptops, single user, one-command install | 15-30% slower than llama.cpp; 3x prod throughput gap |
| **TGI** | HF ecosystem, regulated industries | **Maintenance mode Dec 11, 2025** |
| **vLLM** | General-purpose production, 100+ users | Broad production default; v0.15.1 Feb 2026 |
| **SGLang** | Agentic multi-turn, prefix-heavy workloads | 400,000+ GPUs in production |

### Decisão de primeira aplicação

**CPU-first**→ llama.cpp. Ollama também funciona, mas é mais lento. Nenhum outro motor é competitivo na CPU.

**AMD GPU**→ vLLM é o caminho mais forte suportado (suporte AMD ROCm). SGLang também funciona. TRT-LLM é bloqueado pela NVIDIA, então está fora.

**NVIDIA Hopper (H100 / H200)**→ VLLM ou SGLang ou TRT-LLM.

**NVIDIA Blackwell (B200 / GB200)**→ TRT-LLM é o líder de transmissão (Fase 17 · 07). vLLM e SGLang seguem-no de perto.

**Apple Silicon (M-series)**Ollama envolve isto.

### Decisão de segunda escala

**1 user / local dev**Um comando, primeiro sinal em segundos.

**10-100 users / small team**→ VLLM single-GPU.

**100-10k users / production**→ VLLM produção-pilha (fase 17 · 18) ou SGLang.

**10k+ users / enterprise**→ VLLM produção-pilha + desagregada (Fase 17 · 17) + LMCache (Fase 17 · 18).

### Terceira decisão sobre a carga de trabalho

**General chat / Q&A**→ VLLM ganha em padrão amplo.

**Agentic multi-turn (tools, planning, memory)**→ A RadixAttention (Fase 17 · 06) de SGLang é a dominante.

**RAG with heavy prefix reuse**→ SGLang.

**Code generation**→ VLLM bem; SGLang um pouco melhor no cache.

**Long context (128K+)**→ VLLM + preenchimento em pedaços; SGLang + KV em camadas.

### A armadilha de manutenção TGI

Hugging Face TGI entrou em modo de manutenção em 11 de dezembro de 2025  apenas corrigem bugs para o futuro. Historicamente: observabilidade de nível superior, melhor integração do ecossistema HF (modelo de cartões, ferramentas de segurança), ligeiramente atrás do vLLM em throughput bruto.

Para novos projetos em 2026: desvio por defeito da TGI. As implementações existentes de TGI podem continuar, mas devem eventualmente migrar.

### O padrão de oleoduto

Dev (Ollama) → stage (llama.cpp) → prod (vLLM). Os motores assumem diferentes formatos de peso  GGUF para a família llama.cpp, HF safetensores para os motores GPU  para que uma conversão de formato possa estar entre as fases. Os engenheiros iteram rapidamente em laptops; espetáculos de fase quantizam a produção; prod é o alvo de serviço.

### Aviso Ollama

Ollama é ótimo para dev. Não é ótimo para produção compartilhada: serialização HTTP Go adiciona gastos, gerenciamento de concurência é mais simples do que vLLM, OpenTelemetry suporta lags. Use Ollama onde brilha  um usuário, um comando  e mudar para vLLM para compartilhado.

### Auto-hosted vs. gerenciado é uma decisão separada

Fase 17 · 01 (hiperscalers gerenciados), · 02 (platformas de inferência) cobertura gerenciada. Esta lição assume que você já decidiu auto-host. Razões para auto-host: residência de dados, ajuste personalizado, total custo de propriedade em escala, modelo de domínio não disponível no hospedado.

### Números que você deve lembrar

- Modo de manutenção TGI: 11 de dezembro de 2025.
- VLLM v0.15.1: Fevereiro 2026; PyTorch 2.10; suporte Blackwell SM120.
- Impressão de produção SGLang: 400.000+ GPUs.
- O diferencial de transmissão Ollama vs llama.cpp: 15-30% mais lento; 3x abaixo da carga de prod.

```figure
data-parallel
```

## Usá-lo

`code/main.py`é um caminhador de árvore de decisão: dado hardware + escala + carga de trabalho, escolhe um motor e explica o porquê.

## Envia-o

Esta lição produz`outputs/skill-engine-picker.md`Com restrições, escolhe um motor e escreve o plano de migração.

## Exercícios

1. Corra .`code/main.py`O resultado coincide com a sua intuição?
2. O teu infra é 12 H100s e 8 MI300X AMD.
3. Uma equipa quer usar o TGI em 2026 porque "é o que sabemos".
4. Ollama dev para vLLM prod: quais são as mudanças na quantização, configuração e observabilidade?
5. Produto RAG com comprimento de prefixo P99 8K e alta reutilização entre os inquilinos.

## Termos-chave

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| llama.cpp | "the CPU one" | Widest model support, fastest on CPU |
| Ollama | "the laptop one" | One-command install, dev-grade throughput |
| TGI | "HF's serving" | Maintenance mode since Dec 2025 |
| vLLM | "the default" | Broad production baseline 2026 |
| SGLang | "the agentic one" | Prefix-heavy, RadixAttention |
| TRT-LLM | "NVIDIA-locked" | Blackwell throughput leader, NVIDIA only |
| GGUF | "llama.cpp format" | Bundled K-quant variants |
| Production-stack | "vLLM K8s" | Phase 17 · 18 reference deployment |
| Pipeline pattern | "dev→stage→prod" | Ollama → llama.cpp → vLLM; weight formats differ per engine |

## Mais leitura

- [AI Made Tools — vLLM vs Ollama vs llama.cpp vs TGI 2026](https://www.aimadetools.com/blog/vllm-vs-ollama-vs-llamacpp-vs-tgi/)
- [Morph — llama.cpp vs Ollama 2026](https://www.morphllm.com/comparisons/llama-cpp-vs-ollama)
- [n1n.ai — Comprehensive LLM Inference Engine Comparison](https://explore.n1n.ai/blog/llm-inference-engine-comparison-vllm-tgi-tensorrt-sglang-2026-03-13)
- [PremAI — 10 Best vLLM Alternatives 2026](https://blog.premai.io/10-best-vllm-alternatives-for-llm-inference-in-production-2026/)
- [TGI maintenance announcement](https://github.com/huggingface/text-generation-inference)- Notas de liberação.
- [vLLM v0.15.1 release notes](https://github.com/vllm-project/vllm/releases)
