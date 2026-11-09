# Metricas de inferência  TTFT, TPOT, ITL, Goodput, P99

> Cinco métricas determinam se uma implantação de inferência está a funcionar. TTFT é pre-reempimento mais fila mais rede. TPOT (muitas vezes referido como ITL, embora as ferramentas discordam sobre se o ITL conta o primeiro token) é o custo de decodificação vinculado à memória por token. A latência de ponta a ponta é TTFT mais TPOT vezes comprimento de saída. O rendimento é de tokens por segundo agregados em toda a frota. Mas o que importa para o produto é o goodput  a fracção de pedidos que atenderam a cada SLO simultaneamente. Alta capacidade de produção em baixa potência significa que você está processando tokens que nunca chegam aos usuários a tempo. Números de referência para Llama-3.1-8B-Instruir sobre TRT-LLM em 2026: média TTFT 162 ms, média TPOT 7,33 ms, média E2E 1,093 ms. Sempre relatar P50, P90, P99  nunca apenas mal. E observe a armadilha de medição: a GenAI-Perf exclui o TTFT do cálculo do ITL, a LLMPerf o inclui; duas ferramentas discordam sobre o TPOT para a mesma execução.

**Type:** Learn
**Languages:** Python, TypeScript (stdlib, toy percentile calculator and goodput reporter)
**Prerequisites:** Phase 17 · 04 (Serving Engine Internals)
**Time:** ~60 minutes

## Objetivos de aprendizagem

- Defina com precisão o TTFT, o TPOT, o ITL, o E2E, o rendimento e o goodput e nome o componente que cada uma mede.
- Explique por que a média é a estatística errada para o serviço de LLM e como ler P50/P90/P99.
- Construa uma restrição múltipla SLO (por exemplo, TTFT < 500 ms E TPOT < 15 ms E E2E < 2 s) e computa o goodput contra ela.
- Cite duas ferramentas de referência que discordam sobre o TPOT para a mesma função e explique o porquê.

## O problema

"Nossa capacidade de transferência é de 15.000 tokens por segundo". Então, o que? Se 40% das solicitações passarem por 2 segundos de ponta a ponta, os usuários abandonam a sessão.

A inferência tem múltiplos eixos de latência e cada um falha de forma diferente. O preenchimento é computacional e as escalas têm um comprimento rápido. O decodificação é baseado na memória e as escalas são do tamanho do lote. O atraso na fila é um problema operacional. A rede é um problema de distância física. Precisamos de métricas distintas para cada uma, e precisamos de percentilhas, e precisamos de um único composto que diga "o usuário obteve o que esperava"

## O conceito

### TTFT  tempo para o primeiro token

`TTFT = queue_time + network_request + prefill_time`

Prefill domina quando os pedidos são longos. No Llama-3.3-70B FP8 no H100, um pedido de 32k leva ~800 ms de prefill puro. O tempo de fila é o comportamento do programador sob carga. A solicitação de rede é o tempo de fio, incluindo TLS. TTFT é a latência que o usuário vê antes de qualquer coisa voltar a fluir.

### TPOT / ITL  Latência entre tokens

Muitos nomes para uma quantidade.`TPOT`(tempo por token de saída), `ITL`(latencia entre tokens), `decode latency per token`É o tempo entre os tokens transmitidos consecutivos após o primeiro.

`TPOT = (decode_forward_time + scheduler_overhead) / tokens_produced`

Na mesma pilha Llama-3.3-70B H100 com preenchimento em pedaços, TPOT significa ~ 7 ms. Sem preenchimento em pedaços, durante um longo preenchimento em uma sequência vizinha, TPOT pode aumentar para 50 ms. Observe P99, não significa.

### Latência E2E

`E2E = TTFT + TPOT * output_tokens + network_response`

Para saídas longas (> 500 tokens), o E2E é dominado pela TPOT. Para saídas curtas com pedidos longos, o E2E é dominado pela TTFT. Relata o E2E condicionado pela extensão da saída.

### Transmissão

`throughput = total_output_tokens / elapsed_time`

A métrica agregada diz-te a eficiência da frota, não a saúde individual.

### O que é que você realmente quer saber?

`goodput = fraction of requests meeting (TTFT <= a) AND (TPOT <= b) AND (E2E <= c)`

O SLO é uma restrição múltipla. Uma solicitação é "boa" somente se cada restrição for realizada. Goodput é a participação. Alguns papéis e painéis de controle relatam goodput como uma taxa em vez disso: solicitações por segundo que atendem a cada SLO. Multiplica a participação pela taxa de solicitação para converter. Alta capacidade em 60% goodput é falha. Baixa capacidade em 99% goodput é o objetivo.

Em 2026, o goodput é a métrica usada nas submissões MLPerf Inference v6.0 e no rastreamento interno de SLA nos provedores de plataforma de IA.

### Por que a média é a estatística errada

As distribuições de latência LLM são distorcidas à direita. Um lote de decodificação com um vizinho de pre-preenchimento longo pode enviar 500 tokens com TPOT ~ 7 ms e 20 tokens com TPOT ~ 60 ms.

Sempre informe o triplo (P50, P90, P99). Para a experiência do usuário, P99 é o que você otimiza.

### Números de referência  Llama-3.1-8B-Instrução sobre TRT-LLM, 2026

- TTFT médio: 162 ms
- TPOT médio: 7,33 ms
- média E2E: 1.093 ms
- P99 TPOT: varia entre 10 e 25 ms, dependendo da configuração de preenchimento em pedaços.

Estes são os pontos de referência publicados da NVIDIA. Eles mudam com o tamanho do modelo (70B mostraria 3-5x), hardware (H100 vs. B200 ~ 3x), e carga.

### A armadilha de medição

Duas das ferramentas de referência mais utilizadas para 2026 discordam sobre o TPOT para a mesma execução:

- **NVIDIA GenAI-Perf**O ITL começa com o token 2.
- **LLMPerf**O ITL começa com o token 1.

Para uma solicitação com TTFT 500 ms e 100 tokens de saída em 700 ms total de decodificação, GenAI-Perf relata `ITL = 700/99 = 7.07 ms`, relatórios da LLMPerf `ITL = 1200/100 = 12.00 ms`A escolha da ferramenta muda o número.

Sempre indicar qual ferramenta.

### Construção de um SLO

Um SLO razoável para o consumidor para um modelo de chat 70B em 2026:

- TTFT P99 <= 800 ms.
- TPOT P99 <= 25 ms.
- E2E P99 <= 3 s para saídas de < 300 tokens.
- Objetivo de produção de energia >= 99%.

Os SLOs Enterprise apertam o TTFT (200-400 ms) e afrouxam o E2E. O ponto é anotá-los, medir os três e rastrear o goodput como um único composto.

### Como medir

- Execução de tráfego real ou realista sintético (LLMPerf com `--mean-input-tokens 800 --stddev-input-tokens 300 --mean-output-tokens 150`)).
- Objectivo 2x de simultaneidade máxima para a corrida de referência.
- Execute 30 a 50 iterações, pegue percentilhas da amostra combinada.
- Publicação com nome da ferramenta, versão da ferramenta, modelo, hardware, concurência, distribuição rápida.

```figure
throughput-latency
```

## Usá-lo

`code/main.py`É uma calculadora de bom desempenho de brinquedo. Gerar uma distribuição de latência sintética, aplicar um SLO e calcular o bom desempenho. Também mostra a diferença GenAI-Perf vs LLMPerf TPOT no mesmo rastro.

O [Inside an LLM Serving GPU](https://aiengineeringfromscratch.com/inside-an-llm-serving-gpu?users=1)A máquina mostra de onde vem o tempo por token de saída em uma NVIDIA L4.

## Envia-o

Esta lição produz`outputs/skill-slo-goodput-gate.md`- Tendo em conta a carga de trabalho e o SLO, produz uma receita de referência preta para a CI/CD que os portões utilizam em vez de emissão.

## Exercícios

1. Corra .`code/main.py`Como o goodput muda quando tens P99 TPOT de 30 ms para 15 ms?
2. Um vendedor cita "15.000 tok/s em Llama 3.3 70B H100". Cite três perguntas a fazer antes de confiar nele.
3. Por que o preenchimento em pedaços protege o P99 TPOT mas não o TPOT?
4. Construa um SLO de consumo para um assistente de voz (o primeiro token é ouvido, não lido). Qual métrica é mais visível ao usuário?
5. Leia o documento LLMPerf README e o documento GenAI-Perf. Identifique outras três métricas em que as ferramentas discordam.

## Termos-chave

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| TTFT | "time to first token" | Queue + network + prefill; dominated by prefill at long prompts |
| TPOT | "time per output token" | Memory-bound decode cost per token after first |
| ITL | "inter-token latency" | Same as TPOT in most tools (not all — see GenAI-Perf) |
| E2E | "end to end" | TTFT + TPOT * output_len; response-side network on top |
| Throughput | "tok/s" | Fleet efficiency; useless without latency percentiles |
| Goodput | "SLO-met rate" | Fraction of requests meeting every SLO constraint simultaneously |
| P99 | "tail" | 1-in-100 worst-case latency; the user experience metric |
| SLO multi-constraint | "the joint" | AND of all three latency bounds; a request fails if any one is violated |
| GenAI-Perf vs LLMPerf | "the tool trap" | Tools disagree on whether ITL includes TTFT |

## Mais leitura

- [NVIDIA NIM — LLM Benchmarking Metrics](https://docs.nvidia.com/nim/benchmarking/llm/latest/metrics.html) definição canónica do TTFT, ITL, TPOT.
- [Anyscale — LLM Serving Benchmarking Metrics](https://docs.anyscale.com/llm/serving/benchmarking/metrics) definições alternativas e receita de medição.
- [BentoML — LLM Inference Metrics](https://bentoml.com/llm/inference-optimization/llm-inference-metrics) medição aplicada em implantações reais.
- [LLMPerf](https://github.com/ray-project/llmperf) Referência de código aberto baseada em raios.
- [GenAI-Perf](https://github.com/triton-inference-server/perf_analyzer/blob/main/genai-perf/README.md) Ferramenta de referência da NVIDIA.
- [MLPerf Inference](https://mlcommons.org/benchmarks/inference-datacenter/) o índice de referência baseado em bons resultados aceito pela indústria.
