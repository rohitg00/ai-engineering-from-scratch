---
name: gradient-accumulation
description: Treine em um lote efetivo maior que a memória do dispositivo, dimensionando as perdas de microlotes e acelerando o otimizador uma vez por janela.
version: 1.0.0
phase: 19
lesson: 46
tags: [training, batch-size, distributed, scaling]
---

## Quando usar

O lote efetivo é a alavanca que suaviza o gradiente e corresponde ao cronograma da taxa de aprendizagem. Quando você não pode pagar em uma única passagem para frente, esta é a receita.

## Receita

1. Escolha `micro_batch` como o maior tamanho que cabe na memória e satura o acelerador.
2. Escolha `effective_batch` na programação da taxa de aprendizagem.
3. Defina `accum_steps = effective_batch // (micro_batch * world_size)` e confirme que ele se divide uniformemente.
4. Por microlote: `loss = criterion(model(x), y) / accum_steps; loss.backward()`.
5. Em micros não finais, insira `model.no_sync()` para pular a redução total do gradiente no DDP.
6. Após o último microlote, execute `optimizer.step()` uma vez. Zero gradientes antes da próxima janela.
7. O estado do otimizador avança uma vez por lote efetivo; a programação da taxa de aprendizagem marca uma vez por lote efetivo.

## Registro

Emita um pequeno registro JSON por etapa efetiva com `samples_per_sec`, `median_step_ms`, `sync_calls`, `accum_steps`, `effective_batch`. Sem isso, o comércio de custos é invisível.

## Modos de falha

- Esquecendo a escala `/ accum_steps`: os gradientes explodem em N.
- Pisando no meio da janela: desvio de parâmetros.
- Sincronização em cada microlote: ligação à rede sem ganho estatístico.
- Misturando isso com descalcificação de precisão mista: dimensione apenas a perda não escalonada.