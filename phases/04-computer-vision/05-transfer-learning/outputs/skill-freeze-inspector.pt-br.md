---
name: skill-freeze-inspector
description: Relate quais parâmetros são treináveis, quais camadas BatchNorm estão em modo de avaliação e se o otimizador está realmente consumindo os parâmetros treináveis
version: 1.0.0
phase: 4
lesson: 5
tags: [computer-vision, transfer-learning, debugging, pytorch]
---

# Inspetor de congelamento

Os bugs de aprendizagem por transferência se escondem em três lugares: parâmetros que deveriam ser congelados, mas não são, parâmetros que deveriam ser treináveis, mas não são, e otimizadores que foram construídos antes da mudança do estado de congelamento. Esta habilidade revela todos os três em uma única passagem.

## Quando usar

- Logo após definir `requires_grad` em um subconjunto de parâmetros.
- Antes da primeira etapa de treinamento de uma corrida de ajuste fino.
- Depois de chamar `freeze_bn_stats` ou qualquer ajudante que mude o modo BN.
- Quando a precisão do val fica presa aleatoriamente e você suspeita que nada está realmente treinando.

## Entradas

- `model`: um PyTorch `nn.Module`.
- `optimizer`: o otimizador prestes a ser usado para treinamento.
- Opcional `expected_frozen_prefixes`: lista de prefixos de nomes de parâmetros que devem ser congelados (por exemplo, `["conv1", "bn1", "layer1"]`).

## Etapas

1. **Parâmetros de caminhada.** Para cada `(name, param)`:
   - registro `requires_grad`
   - registro `shape` e `numel`

2. **Módulos Walk.** Para cada módulo:
   - se for BatchNorm, registre se está em modo eval e se seus parâmetros afins são treináveis.

3. **Inspecione o otimizador.** Para cada grupo de parâmetros:
   - achate seu `params` em um conjunto de `id(p)`.
   - compare com o conjunto de todos os `id(p)` para parâmetros onde `requires_grad == True`.

4. **Detecte os quatro modos de falha:**
   - `leaked_train`: um parâmetro possui `requires_grad=True` mas não aparece no otimizador (o gradiente é calculado, mas nunca aplicado).
   - `ghost_train`: um parâmetro aparece no otimizador, mas tem `requires_grad=False` (o estado do otimizador é desperdiçado; também pode causar bugs se você reativar o require_grad posteriormente).
   - `bn_mismatch`: ou (a) uma camada BN está em modo de treinamento (acumula estatísticas de execução) enquanto seus parâmetros afins (`weight`, `bias`) estão congelados, ou (b) uma camada BN está em modo de avaliação (estatísticas congeladas) enquanto seus parâmetros afins são treináveis. Ambos os estados são inconsistentes e quase sempre um bug.
   - `expected_vs_actual`: qualquer prefixo listado em `expected_frozen_prefixes` ainda possui um parâmetro treinável.

## Relatório

```
[freeze-inspector]
  model trainable params: <N>
  model frozen params:    <N>
  batchnorm layers in eval mode: <count>
  batchnorm layers in train mode: <count>

[optimizer coverage]
  trainable params fed to optimizer: <M> of <N>
  leaked_train: <list of names> (trainable but not in optimizer)
  ghost_train:  <list of names> (in optimizer but frozen)

[bn audit]
  mismatched layers: <list of names>

[expectations]
  expected_frozen_prefixes: <...>
  violating params:         <list>

[verdict]
  ok | <one-line summary of the most severe issue>
```

## Regras

- Reportar apenas nomes de parâmetros; nunca imprima os pesos sozinhos.
- Classifique todas as listas em ordem alfabética por nome de parâmetro.
- Se a cobertura do otimizador for 100% e não houver incompatibilidades, retorne `ok` e pare.
- Para `leaked_train`, sempre recomende reconstruir o otimizador após a alteração do estado de congelamento.
- Para `ghost_train`, recomendamos remover o grupo de parâmetros ou definir `requires_grad=True` se a intenção era treiná-lo.