# APIs de teste de carga LLM  Por que K6 e Locust mentem

> Os testadores de carga tradicionais não foram projetados para respostas de streaming, comprimentos de saída variáveis, métricas de nível de token ou saturação de GPU. Duas armadilhas mordem a maioria das equipes. A armadilha do GIL: A medição de nível de tokens do Locust executa a tokenização sob o Python GIL, que compete com a geração de solicitações sob alta concurência; o backlog da tokenização então infla a latência entre tokens relatada. A armadilha de uniformitade de prompt: as mesmas instruções em um loop testam um ponto na distribuição do token; o tráfego real tem comprimento variável e diferentes correspondências de prefixos. A LLMPerf resolve isto com `--mean-input-tokens`+ `--stddev-input-tokens`. Mapeamento de ferramentas em 2026: especializado em LLM (GenAI-Perf, LLMPerf, LLM-Locust, guidellm) para a precisão de tokens; **k6 v2026.1.0**+ **k6 Operator 1.0 GA (Sept 2025)** streaming-consciente, Kubernetes-nativo distribuído através de testRun/PrivateLoadZone CRDs, melhor para portões CI/CD; Vegeta for Go saturação de taxa constante; Locust 2.43.3 apenas com extensão LLM-Locust para streaming. padrões de carga: estádio, rampa, pico (test de autoescalação), remoção (vazes de memória).

**Type:** Build
**Languages:** Python, TypeScript (stdlib, toy realistic-prompt generator + latency collector)
**Prerequisites:** Phase 17 · 08 (Inference Metrics), Phase 17 · 03 (GPU Autoscaling)
**Time:** ~75 minutes

## Objetivos de aprendizagem

- Explique os dois padrões anti-patrões (trampa GIL, armadilha de uniformidade de ponta) que fazem os testadores de carga genéricos mentir para as API de LLM.
- Escolha uma ferramenta para um determinado propósito: LLMPerf (exercício de referência), extensão de streaming k6 + (gate CI), guidellm (sintetico em larga escala), GenAI-Perf (referência NVIDIA).
- Desenhe quatro padrões de carga (estabilização, rampa, ponta, remoção) e nomeie o modo de falha de cada captura.
- Construir uma distribuição realista de prompt usando média + stddev de tokens de entrada em vez de comprimento fixo.

## O problema

Você testou o seu endpoint LLM em 500 usuários simultâneos. Ele funcionou. Você enviou. Na produção em 200 usuários reais o serviço caiu sobre P99 TTFT explodiu, GPUs fixados.

Dois coisas aconteceram. Primeiro, k6 enviou 500 instruções idênticas  a sua coleta de solicitações e o cache de prefixos fizeram parecer que você estava a lidar com 500 decódios simultâneos quando você estava realmente a lidar com um. Segundo, k6 não rastreia a latência entre tokens nas respostas de streaming da maneira como o olho a experimenta; vê uma conexão HTTP, não 500 tokens chegando em intervalos variados.

O teste de carga para LLM é sua própria disciplina.

## O conceito

### A armadilha do GIL (Locust)

Locust usa Python e executa o lado do cliente de tokenização sob o GIL. Em alta concurência, as filas de tokenização por trás da geração de solicitações. A latência entre tokens relatada inclui o backlog de tokenização do lado do cliente. Você acha que o servidor é lento; é o teste de uso.

Correção: A extensão LLM-Locust muda a tokenization para processos separados, ou usa um harness compilado de linguagem (k6, LLMPerf usando tokenizers.rs).

### A armadilha da uniformidade rápida

Todos os testadores de carga conhecidos permitem configurar um prompt. Em um teste de loop de 10.000 iterações, o mesmo prompt exatamente é enviado cada vez. O servidor vê o mesmo prefixo cada vez que o prefixo  bate no cache perto de 100%, o throughput parece ótimo.

Fix: amostra de uma distribuição rápida.`--mean-input-tokens 500 --stddev-input-tokens 150` Diversos comprimentos, conteúdo diversificado.

### Quatro padrões de carga

1. **Steady-state** RPS constante durante 30 a 60 minutos.
2. **Ramp** aumentar linearmente o RPS de 0 para o objectivo durante 15 minutos.
3. **Spike**- Repentinamente 3-10x RPS durante 2 minutos e depois de volta.
4. **Soak**- estado de estabilidade durante 4-8 horas. Captura: vazamentos de memória, deriva do pool de ligação, sobreposição de observabilidade.

### 2026 mapeamento de ferramentas

**LLMPerf**(Anyscale) Python mas tokenization com Rust. Mean/stddev prompts. Streaming-consciente. Melhor padrão para executar desempenho.

**NVIDIA GenAI-Perf** Referência da NVIDIA. Utiliza o cliente Triton; cobertura métrica abrangente. Observe que sua ITL exclui TTFT; LLMPerf inclui. Duas ferramentas produzem diferentes TPOT para o mesmo servidor.

**LLM-Locust**Extensão de Locus que corrige a armadilha GIL.

**guidellm** Compartilhamento de dados sintéticos em larga escala.

**k6 v2026.1.0**+ **k6 Operator 1.0 GA (Sept 2025)**- Não .
- k6 (Go, compilado, sem GIL) adicionou métricas de streaming.
- k6 O operador utiliza CRDs TestRun / PrivateLoadZone para testes distribuídos nativos Kubernetes.
- Melhor para testes de CI/CD e SLA.

**Vegeta** Vai, mais simples do que k6. Saturação HTTP constante. Não LLM-consciente, mas bom para testes de gateway / limite de taxa.

**Locust 2.43.3 stock** tem a armadilha GIL para LLM. Somente com extensão LLM-Locust.

### Porta SLA em CI

- Executar o PR com:

- 30-50 iterações cada uma no RPS de linha de base.
- Porta: P50/P95 TTFT, 5xx < 5%, TPOT abaixo do limiar.
- - Desligar a construção.

### Distribuição realista de tempo

Construir a partir de amostras reais de tráfego (se você tem) ou de distribuições publicadas (por exemplo, ShareGPT prompts para chat, HumanEval para código).

### Números que você deve lembrar

- k6 Operador 1.0 GA: Setembro 2025.
- K6 v2026.1.0: métricas de streaming conscientes.
- Tópico curso LLMPerf: 100 a 1000 solicitações na simultânea X.
- Portão de CI típico: 30-50 iterações por PR.
- Quatro padrões: constante, rampa, ponta, remoção.

```figure
load-pattern-waves
```

## Usá-lo

`code/main.py`Simula um ensaio de carga com uma distribuição realista de velocidade rápida, mede a TPOT eficaz e demonstra a armadilha de velocidade uniforme.

## Envia-o

Esta lição produz`outputs/skill-load-test-plan.md`Considerando a carga de trabalho e o SLA, escolhe a ferramenta e desenha os quatro padrões de carga.

## Exercícios

1. Corra .`code/main.py`Comparar distribuição uniforme vs realista. Onde está a diferença?
2. Escreva o script k6 para um portão CI: TTFT P95 < 800 ms a 100 concurrent, runtime 5 minutos.
3. O teste de remoção mostra que a memória cresce 50 MB/hora.
4. Teste de ponta de 10 RPS a 100 RPS. Qual é o tempo de recuperação esperado se a pilha de produção Karpenter + vLLM estiver em funcionamento (fase 17 · 03 + 18)?
5. A GenAI-Perf relata TPOT=6ms; LLMPerf relata TPOT=11ms no mesmo servidor.

## Termos-chave

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| LLMPerf | "the LLM harness" | Anyscale benchmark tool, streaming-aware |
| GenAI-Perf | "NVIDIA tool" | NVIDIA reference harness |
| LLM-Locust | "Locust for LLMs" | Locust extension fixing GIL trap |
| guidellm | "synthetic benchmark" | Large-scale synthetic tool |
| k6 Operator | "K8s k6" | CRD-based distributed k6 |
| GIL trap | "Python client overhead" | Tokenization backlog inflates reported latency |
| Prompt-uniformity trap | "single-prompt lie" | Loop with same prompt hits cache, inflates throughput |
| Steady-state | "constant load" | Flat RPS for N minutes |
| Ramp | "linear up" | 0 to target over duration |
| Spike | "burst test" | Sudden multiplier then revert |
| Soak | "long test" | Hours for leak detection |

## Mais leitura

- [TianPan — Load Testing LLM Applications](https://tianpan.co/blog/2026-03-19-load-testing-llm-applications)
- [PremAI — Load Testing LLMs 2026](https://blog.premai.io/load-testing-llms-tools-metrics-realistic-traffic-simulation-2026/)
- [NVIDIA NIM — Introduction to LLM Inference Benchmarking](https://docs.nvidia.com/nim/large-language-models/1.0.0/benchmarking.html)
- [TrueFoundry — LLM-Locust](https://www.truefoundry.com/blog/llm-locust-a-tool-for-benchmarking-llm-performance)
- [LLMPerf](https://github.com/ray-project/llmperf)
- [k6 Operator](https://github.com/grafana/k6-operator)
