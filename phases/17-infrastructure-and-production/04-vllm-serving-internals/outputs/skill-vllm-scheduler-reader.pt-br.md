---
name: vllm-scheduler-reader
description: Diagnostique uma configuração de serviço vLLM lendo os botões no nível do agendador e identificando quais PagedAttention, lote contínuo e pré-preenchimento fragmentado são o gargalo.
version: 1.0.0
phase: 17
lesson: 04
tags: [vllm, paged-attention, continuous-batching, chunked-prefill, serving, scheduler]
---

Dada uma configuração de serviço vLLM (modelo, dtype, hardware, `--gpu-memory-utilization`, `--max-num-batched-tokens`, `--enable-chunked-prefill`, `--speculative-model` ou `--speculative-config`, simultaneidade máxima e um conjunto de métricas observadas de média de TTFT/P99, média de ITL/P99, taxa de transferência tok/s), produza um diagnóstico em nível de agendador.

Produzir:

1. Leitura de configuração. Para cada sinalizador, nomeie o comportamento do agendador que ele controla e o padrão 2026. Sinalize qualquer sinalizador definido com um valor não padrão e explique o porquê.
2. Identificação de gargalos. Classifique o gargalo como um dos seguintes: PagedAttention subprovisionado (falta de bloco KV), paralisação de lote contínuo (crescimento da fila WAITING), pré-preenchimento em partes mal dimensionado (pico de cauda TTFT), decodificação vinculada à computação (piso ITL) ou vinculada ao HBM (não cabe no lote). Justifique com as métricas relatadas.
3. Recomendações de botões. Ações específicas e ordenadas – qual sinalizador inverter, qual valor tentar e qual métrica observar. Não sugira "experimentar mais GPUs" sem antes esgotar o ajuste no nível do agendador.
4. Verificação de compatibilidade. Especificamente para vLLM v0.18.0: sinalize a combinação `--enable-chunked-prefill` + `--speculative-model` como uma incompatibilidade total. Recomende a decodificação especulativa de GPU N-gram em V1 como a exceção documentada se ambas forem desejadas.
5. O que ler a seguir. Aponte para uma das notas de versão do vLLM v0.18.0, o documento PagedAttention ou o passo a passo do agendador Aleksa Gordic V1, dependendo do que o diagnóstico surgiu.

Rejeições difíceis:
- Diagnosticar sem as quatro métricas principais (TTFT, ITL, rendimento, simultaneidade). Recuse e peça o conjunto de métricas.
- Recomendar `--enable-chunked-prefill` sem verificar a configuração de decodificação especulativa.
- Tratar `DCGM_FI_DEV_GPU_UTIL` como um sinal de escala. vLLM pré-aloca KV; os números do ciclo de trabalho são enganosos.

Regras de recusa:
- Se a taxa de transferência relatada for inferior a 100 tok/s em um H100, o gargalo provavelmente não é vLLM — verifique o tokenizer no lado do cliente, Python GIL ou serialização em nível de solicitação.
- Se `--gpu-memory-utilization` estiver definido abaixo de 0,7, recuse-se a ajustar mais — o operador optou por deixar o HBM na mesa e a solução é aumentar o teto antes de inverter os sinalizadores do agendador.
- Se o operador solicitar uma receita de decodificação especulativa + pré-preenchimento fragmentado na especulação do modelo de rascunho, recuse e nomeie a incompatibilidade v0.18.0. Em vez disso, aponte para EAGLE-3 na Fase 17 · 05.

Saída: um diagnóstico do agendador de uma página listando sinalizadores, gargalos, recomendações ordenadas, notas de compatibilidade e um ponteiro para a próxima leitura. Termine com um parágrafo "o que medir a seguir" nomeando P99 ITL, taxa de alocação de bloco ou profundidade da fila WAITING, dependendo do gargalo identificado.