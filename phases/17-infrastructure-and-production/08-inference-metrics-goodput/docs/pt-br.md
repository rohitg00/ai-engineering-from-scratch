# Métricas de Inferência — TTFT, TPOT, ITL, Goodput, P99

> Quatro métricas decidem se uma implantação de inferência está funcionando. TTFT é prefill mais fila mais rede. TPOT (equivalentemente ITL) é o custo de decode limitado por memória por token. Latência end-to-end é TTFT mais TPOT vezes o comprimento da saída. Throughput é tokens por segundo agregados pela frota. Mas a que importa para o produto é goodput — a fração de requests que atingiram todos os SLOs simultaneamente. Alto throughput com baixo goodput significa que você está processando tokens que nunca chegam aos usuários a tempo. Números de referência para Llama-3.1-8B-Instruct no TRT-LLM em 2026: TTFT médio 162 ms, TPOT médio 7,33 ms, E2E médio 1.093 ms. Sempre reporte P50, P90, P99 — nunca só a média. E cuidado com a armadilha de medição: GenAI-Perf exclui TTFT do cálculo de ITL, LLMPerf inclui; duas ferramentas discordam sobre TPOT no mesmo run.

**Tipo:** Aprendizado
**Linguagens:** Python (stdlib, calculadora de percentil toy e reporter de goodput)
**Pré-requisitos:** Fase 17 · 04 (Internals de Serving vLLM)
**Tempo:** ~60 minutos

## Objetivos de Aprendizado

- Definir TTFT, TPOT, ITL, E2E, throughput e goodput precisamente e nomear o componente que cada um mede.
- Explicar por que a média é a estatística errada para serving de LLM e como ler P50/P90/P99.
- Construir um SLO multi-restrição (ex. TTFT<500 ms E TPOT<15 ms E E2E<2 s) e computar goodput contra ele.
- Nomear duas ferramentas de benchmark que discordam sobre TPOT no mesmo run e explicar por quê.

## O Problema

"Nosso throughput é 15.000 tokens por segundo." E daí? Se 40% dos requests passaram de 2 segundos end-to-end, os usuários abandonaram a sessão. Throughput sozinho não te diz se o produto funciona.

Inferência tem múltiplos eixos de latência e cada um falha de um jeito. Prefill é limitado por compute e escala com o comprimento do prompt. Decode é limitado por memória e escala com o tamanho do batch. Atraso de fila é um problema operacional. Rede é um problema de distância física. Você precisa de métricas distintas para cada um, precisa de percentis e precisa de um composto único que diga "o usuário recebeu o que esperava" — esse é o goodput.

## O Conceito

### TTFT — time to first token

`TTFT = queue_time + network_request + prefill_time`

Prefill domina quando prompts são longos. No Llama-3.3-70B FP8 no H100, um prompt de 32k leva ~800 ms de puro prefill. Tempo de fila é comportamento do scheduler sob carga. Requisição de rede é o tempo da linha incluindo TLS. TTFT é a latência que o usuário vê antes de qualquer coisa começar a voltar.

### TPOT / ITL — inter-token latency

Muitos nomes para uma mesma quantidade. `TPOT` (time per output token), `ITL` (inter-token latency), `decode latency per token` — são todos a mesma coisa. É o tempo entre tokens de stream consecutivos após o primeiro.

`TPOT = (decode_forward_time + scheduler_overhead) / tokens_produced`

No mesmo stack Llama-3.3-70B H100 com chunked prefill, TPOT médio ~7 ms. Sem chunked prefill, durante um prefill longo em uma sequência vizinha, TPOT pode picotar a 50 ms. Observe P99, não a média.

### Latência E2E

`E2E = TTFT + TPOT * output_tokens + network_response`

Para saídas longas (>500 tokens), E2E é dominado por TPOT. Para saídas curtas com prompts longos, E2E é dominado por TTFT. Reporte E2E condicionado ao comprimento da saída.

### Throughput

`throughput = total_output_tokens / elapsed_time`

Métrica agregada. Te diz a eficiência da frota. Não te diz a saúde individual dos requests.

### Goodput — a métrica que você realmente se importa

`goodput = fração de requests atendendo (TTFT <= a) E (TPOT <= b) E (E2E <= c)`

O SLO é multi-restrição. Um request é "bom" só se cada restrição se manteve. Goodput é a parcela. Alto throughput a 60% de goodput é falha. Throughput menor a 99% de goodput é o alvo.

Em 2026, goodput é a métrica usada nas submissões do MLPerf Inference v6.0 e no rastreamento interno de SLA em provedores de plataforma de IA.

### Por que a média é a estatística errada

Distribuições de latência de LLM são enviesadas à direita. Um batch de decode com uma sequência vizinha de prefill longo pode enviar 500 tokens com TPOT ~7 ms e 20 tokens com TPOT ~60 ms. TPOT médio é 9 ms. TPOT P99 é 65 ms. Usuários batem no P99 regularmente — é por isso que eles saem.

Sempre reporte o trio (P50, P90, P99). Para experiência do usuário, P99 é o que você otimiza.

### Números de referência — Llama-3.1-8B-Instruct no TRT-LLM, 2026

- TTFT médio: 162 ms
- TPOT médio: 7,33 ms
- E2E médio: 1.093 ms
- P99 TPOT: varia 10-25 ms dependendo da configuração de chunked prefill.

Esses são os pontos de referência publicados da NVIDIA. Eles mudam com tamanho do modelo (70B mostraria 3-5x), hardware (H100 vs B200 ~3x) e carga.

### A armadilha de medição

Duas das ferramentas de benchmark mais usadas em 2026 discordam sobre TPOT no mesmo run:

- **NVIDIA GenAI-Perf**: exclui TTFT do cálculo de ITL. ITL começa do token 2.
- **LLMPerf**: inclui TTFT. ITL começa do token 1.

Para um request com TTFT 500 ms e 100 tokens de saída em 700 ms de decode total, GenAI-Perf reporta `ITL = 700/99 = 7,07 ms`, LLMPerf reporta `ITL = 1200/100 = 12,00 ms`. A escolha da ferramenta muda o número.

Sempre declare qual ferramenta. Sempre publique a definição.

### Construindo um SLO

Um SLO razoável voltado ao consumidor para um modelo de chat 70B em 2026:

- TTFT P99 <= 800 ms.
- TPOT P99 <= 25 ms.
- E2E P99 <= 3 s para saídas <300 tokens.
- Goodput alvo >= 99%.

SLOs enterprise apertam TTFT (200-400 ms) e relaxam E2E. O ponto é documentá-los, medir os três e rastrear goodput como um composto único.

### Como medir

- Rode tráfego real ou sintético realista (LLMPerf com `--mean-input-tokens 800 --stddev-input-tokens 300 --mean-output-tokens 150`).
- Alvo de 2x o pico de concorrência para o run de benchmark.
- Rode 30-50 iterações, pegue percentis da amostra combinada.
- Publique com nome da ferramenta, versão da ferramenta, modelo, hardware, concorrência, distribuição de prompts.

## Use

`code/main.py` é uma calculadora de goodput toy. Gera uma distribuição sintética de latência, aplica um SLO e computa goodput. Também mostra a diferença de TPOT GenAI-Perf vs LLMPerf no mesmo trace.

## Entregue

Esta aula produz `outputs/skill-slo-goodput-gate.md`. Dado um workload e SLO, produz uma receita de benchmark pronta para CI/CD que gateia deploys em goodput em vez de throughput.

## Exercícios

1. Execute `code/main.py`. Gere uma distribuição com pico de cauda de 1%. Como o goodput muda quando você aperta P99 TPOT de 30 ms para 15 ms?
2. Um vendor cota "15.000 tok/s no Llama 3.3 70B H100". Nomeie três perguntas a fazer antes de confiar.
3. Por que chunked prefill protege P99 TPOT mas não TPOT médio?
4. Construa um SLO para um assistente de voz (primeiro token é ouvido, não lido). Qual métrica é mais visível para o usuário?
5. Leia o README do LLMPerf e os docs do GenAI-Perf. Identifique três outras métricas onde as ferramentas discordam.

## Termos Chave

| Termo | O que as pessoas dizem | O que realmente significa |
|-------|----------------------|--------------------------|
| TTFT | "tempo até o primeiro token" | Fila + rede + prefill; dominado por prefill em prompts longos |
| TPOT | "tempo por token de saída" | Custo de decode limitado por memória por token após o primeiro |
| ITL | "latência entre tokens" | Mesmo que TPOT na maioria das ferramentas (não todas — ver GenAI-Perf) |
| E2E | "end to end" | TTFT + TPOT * output_len; rede do lado da resposta em cima |
| Throughput | "tok/s" | Eficiência da frota; inútil sem percentis de latência |
| Goodput | "taxa de SLO atingido" | Fração de requests atendendo todas as restrições de SLO simultaneamente |
| P99 | "cauda" | 1 em 100 piores casos de latência; a métrica de experiência do usuário |
| SLO multi-restrição | "a conjunta" | AND de todas as três limitações de latência; um request falha se qualquer uma for violada |
| GenAI-Perf vs LLMPerf | "a armadilha da ferramenta" | Ferramentas discordam se ITL inclui TTFT |

## Leitura Complementar

- [NVIDIA NIM — LLM Benchmarking Metrics](https://docs.nvidia.com/nim/benchmarking/llm/latest/metrics.html) — definição canônica de TTFT, ITL, TPOT.
- [Anyscale — LLM Serving Benchmarking Metrics](https://docs.anyscale.com/llm/serving/benchmarking/metrics) — definições alternativas e receita de medição.
- [BentoML — LLM Inference Metrics](https://bentoml.com/llm/inference-optimization/llm-inference-metrics) — medição aplicada em implantações reais.
- [LLMPerf](https://github.com/ray-project/llmperf) — benchmark open-source baseado em Ray.
- [GenAI-Perf](https://docs.nvidia.com/deeplearning/triton-inference-server/user-guide/docs/client/src/c++/perf_analyzer/genai-perf/README.html) — ferramenta de benchmark da NVIDIA.
- [MLPerf Inference](https://mlcommons.org/benchmarks/inference-datacenter/) — benchmark baseado em goodput aceito pela indústria.
