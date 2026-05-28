# Load Testing de APIs LLM — Por que o k6 e o Locust Mentem

> Testadores de carga tradicionais não foram projetados para respostas em streaming, tamanhos de output variáveis, métricas em nível de token ou saturação de GPU. Dois problemas mordem a maioria dos times. O problema do GIL: a medição em nível de token do Locust roda tokenização sob o GIL do Python, que compete com geração de requests sob alta concorrência; atraso de tokenização então infla a latência inter-token reportada — seu cliente é o gargalo, não o servidor. O problema da uniformidade de prompts: prompts idênticos em loop testam um ponto na distribuição de tokens; tráfego real tem tamanho variável e prefixos diversos. LLMPerf resolve isso com `--mean-input-tokens` + `--stddev-input-tokens`. Mapeamento de ferramentas em 2026: especializados em LLM (GenAI-Perf, LLMPerf, LLM-Locust, guidellm) para acurácia em nível de token; **k6 v2026.1.0** + **k6 Operator 1.0 GA (Set 2025)** — aware de streaming, Kubernetes-native distribuído via CRDs TestRun/PrivateLoadZone, melhor para gates de CI/CD; Vegeta para saturação de taxa constante em Go; Locust 2.43.3 só com extensão LLM-Locust para streaming. Padrões de carga: estado estável, rampa, spike (teste de autoscaling), soak (memory leaks).

**Tipo:** Construir
**Linguagens:** Python (stdlib, gerador brincadeira de prompts realistas + coletor de latência)
**Pré-requisitos:** Fase 17 · 08 (Métricas de Inferência), Fase 17 · 03 (Autoscaling de GPU)
**Tempo:** ~75 minutos

## Objetivos de Aprendizado

- Explicar os dois anti-padrões (problema do GIL, problema da uniformidade de prompts) que fazem testadores de carga genéricos mentirem para APIs LLM.
- Escolher uma ferramenta pra um propósito: LLMPerf (run de benchmark), k6 + extensão de streaming (gate de CI), guidellm (sintético em larga escala), GenAI-Perf (referência NVIDIA).
- Projetar quatro padrões de carga (estável, rampa, spike, soak) e nomear o modo de falha que cada um pega.
- Construir uma distribuição realista de prompts usando média + stddev de tokens de entrada em vez de tamanho fixo.

## O Problema

Você testou com k6 seu endpoint LLM com 500 usuários concorrentes. Aguentou. Você lançou. Em produção com 200 usuários reais o serviço caiu — TTFT P99 explodiu, GPUs travaram.

Duas coisas aconteceram. Primeiro, o k6 enviou 500 prompts idênticos — sua consolidação de requests e cache de prefixo fizeram parecer que você estava lidando com 500 decodificações concorrentes quando na verdade estava lidando com uma só. Segundo, o k6 não rastreia latência inter-token em respostas de streaming como o olho humano percebe; ele vê uma conexão HTTP, não 500 tokens chegando em intervalos variáveis.

Load testing de LLMs é uma disciplina própria.

## O Conceito

### O problema do GIL (Locust)

Locust usa Python e roda tokenização no lado do cliente sob o GIL. Sob alta concorrência, o tokenizer entra na fila atrás da geração de requests. Latência inter-token reportada inclui atraso de tokenização do lado do cliente. Você acha que o servidor é lento; é o harness de teste.

Solução: extensão LLM-Locust move tokenização para processos separados, ou use um harness em linguagem compilada (k6, LLMPerf usando tokenizers.rs).

### O problema da uniformidade de prompts

Todos os testadores de carga conhecidos permitem configurar um prompt. Em loop de 10.000 iterações, o mesmo prompt é enviado cada vez. Servidor vê o mesmo prefixo toda vez — hits do prefix cache se aproximam de 100%, throughput parece ótimo.

Solução: amostragem de uma distribuição de prompts. LLMPerf usa `--mean-input-tokens 500 --stddev-input-tokens 150` — tamanhos diversos, conteúdos diversos.

### Quatro padrões de carga

1. **Estado estável** — RPS constante por 30-60 min. Pega: regressões de performance de baseline.
2. **Rampa** — aumento linear de RPS de 0 ao alvo em 15 min. Pega: ponto de quebra de capacidade, anomalias de warm-up.
3. **Spike** — multiplicador súbito de 3-10x RPS por 2 min e volta. Pega: latência de autoscaling, saturação de fila, impacto de cold-start.
4. **Soak** — estado estável por 4-8 horas. Pega: memory leaks, deriva de connection pool, overflow de observabilidade.

### Mapeamento de ferramentas 2026

**LLMPerf** (Anyscale) — Python mas tokenização em Rust. Prompts com média/stddev. Aware de streaming. Melhor padrão para runs de performance.

**NVIDIA GenAI-Perf** — referência da NVIDIA. Usa cliente Triton; cobertura abrangente de métricas. Nota: seu ITL exclui TTFT; o do LLMPerf inclui. Duas ferramentas produzem TPOT diferente no mesmo servidor.

**LLM-Locust** (TrueFoundry) — extensão Locust que corrige o problema do GIL. DSL familiar do Locust + métricas de streaming.

**guidellm** — benchmarking sintético em larga escala.

**k6 v2026.1.0** + **k6 Operator 1.0 GA (Set 2025)**:
- O próprio k6 (Go, compilado, sem GIL) adicionou métricas aware de streaming.
- k6 Operator usa CRDs TestRun / PrivateLoadZone para teste distribuído nativo do Kubernetes.
- Melhor para gates de CI/CD e teste de SLA.

**Vegeta** — Go, mais simples que k6. Saturação HTTP de taxa constante. Não é aware de LLM mas bom para teste de gateway / rate-limit.

**Locust 2.43.3 stock** — tem o problema do GIL para LLM. Só com extensão LLM-Locust.

### Gate SLA no CI

Rode k6 no PR com:

- 30-50 iterações cada no baseline RPS.
- Gate: TTFT P50/P95, 5xx < 5%, TPOT abaixo do threshold.
- Quebre o build na violação.

### Distribuição realista de prompts

Construa a partir de amostras de tráfego real (se tiver) ou de distribuições publicadas (ex: prompts ShareGPT para chat, HumanEval para código). Alimente média + stddev no LLMPerf. Evite loop com um único prompt a todo custo.

### Números pra lembrar

- k6 Operator 1.0 GA: setembro 2025.
- k6 v2026.1.0: métricas aware de streaming.
- Run típico de LLMPerf: 100-1000 requests em concorrência X.
- Gate de CI típico: 30-50 iterações por PR.
- Quatro padrões: estável, rampa, spike, soak.

## Use

`code/main.py` simula um load test com distribuição realista de prompts, mede TPOT efetivo e demonstra o problema do prompt uniforme.

## Entregue

Esta aula produz `outputs/skill-load-test-plan.md`. Dado workload e SLA, escolhe ferramenta e projeta os quatro padrões de carga.

## Exercícios

1. Execute `code/main.py`. Compare distribuição uniforme vs realista — onde está o gap?
2. Escreva o script k6 para um gate de CI: TTFT P95 < 800 ms em 100 concorrentes, tempo de execução 5 minutos.
3. Seu teste soak mostra memória crescendo 50 MB/hora. Nomeie três causas e a instrumentação pra diferenciar.
4. Spike test de 10 RPS para 100 RPS. Qual é o tempo esperado de recuperação se Karpenter + vLLM production-stack estiverem no lugar (Fase 17 · 03 + 18)?
5. GenAI-Perf reporta TPOT=6ms; LLMPerf reporta TPOT=11ms no mesmo servidor. Explique.

## Termos Chave

| Termo | O que a gente diz | O que realmente significa |
|-------|-------------------|---------------------------|
| LLMPerf | "o harness do LLM" | Ferramenta de benchmark da Anyscale, aware de streaming |
| GenAI-Perf | "ferramenta NVIDIA" | Harness de referência NVIDIA |
| LLM-Locust | "Locust pra LLMs" | Extensão Locust que corrige problema do GIL |
| guidellm | "benchmark sintético" | Ferramenta sintética em larga escala |
| k6 Operator | "K8s do k6" | k6 distribuído baseado em CRDs |
| Problema do GIL | "overhead do cliente Python" | Atraso de tokenização infla latência reportada |
| Problema da uniformidade | "mentira de prompt único" | Loop com mesmo prompt acerta cache, infla throughput |
| Estado estável | "carga constante" | RPS flat por N minutos |
| Rampa | "subida linear" | 0 ao alvo ao longo da duração |
| Spike | "teste de burst" | Multiplicador súbito e volta |
| Soak | "teste longo" | Horas para detecção de leaks |

## Leitura Complementar

- [TianPan — Load Testing LLM Applications](https://tianpan.co/blog/2026-03-19-load-testing-llm-applications)
- [PremAI — Load Testing LLMs 2026](https://blog.premai.io/load-testing-llms-tools-metrics-realistic-traffic-simulation-2026/)
- [NVIDIA NIM — Introduction to LLM Inference Benchmarking](https://docs.nvidia.com/nim/large-language-models/1.0.0/benchmarking.html)
- [TrueFoundry — LLM-Locust](https://www.truefoundry.com/blog/llm-locust-a-tool-for-benchmarking-llm-performance)
- [LLMPerf](https://github.com/ray-project/llmperf)
- [k6 Operator](https://github.com/grafana/k6-operator)
