---
name: skill-residual-block-reviewer
description: Revise um bloco residual PyTorch para verificar a correção da conexão de salto, posicionamento do BN, ordem de ativação e alinhamento da forma
version: 1.0.0
phase: 4
lesson: 3
tags: [computer-vision, resnet, code-review, pytorch]
---

# Revisor de bloco residual

Um revisor focado para qualquer PyTorch `nn.Module` que afirma implementar um bloco residual. Captura os quatro erros responsáveis ​​por quase todas as reescritas quebradas do ResNet.

## Quando usar

- Alguém escreveu um BasicBlock ou Bottleneck personalizado e a perda é NaN ou a precisão está travada.
- Você está portando um bloco de um framework para outro e deseja verificar a equivalência.
- Você está revisando um PR que altera os componentes internos do ResNet (pré-ativação, compressão-excitação, anti-alias).
- Um modelo funciona bem na entrada de tamanho CIFAR, mas trava na resolução ImageNet porque o atalho está errado.

## Entradas

- Uma definição de classe PyTorch, como texto fonte ou um caminho importável.
- Opcional `variant`: `basic` | `bottleneck` | `preact` | `seblock`.

## Quatro verificações

### 1. Alinhamento da forma do atalho

Para qualquer bloco com `stride != 1` ou `in_channels != out_channels`, o caminho de atalho **deve** ser um módulo de correspondência de forma - normalmente uma conversão 1x1 mais BN. Um `nn.Identity()` simples neste caso é um erro de incompatibilidade de forma garantido no tempo de encaminhamento.

Diagnóstico:
```
[shortcut]
  detected:  nn.Identity | 1x1 Conv + BN | 1x1 Conv + BN + ReLU | other
  required:  shape-matching Conv if (stride != 1 or in_c != out_c) else Identity
  verdict:   ok | wrong | unnecessarily heavy
```

### 2. Colocação do BN em relação à adição

A adição `out + shortcut(x)` deve acontecer **antes** do ReLU final (pós-ativação, ResNet original) ou o ReLU final deve estar totalmente ausente (ResNet v2 pré-ativação). Um bloco que aplica ReLU no branch principal e depois adiciona um atalho bruto produz uma faixa de ativação assimétrica que prejudica o treinamento.

Diagnóstico:
```
[activation order]
  pattern:  post-act (conv-BN-ReLU-conv-BN-add-ReLU) | pre-act (BN-ReLU-conv-BN-ReLU-conv-add) | other
  verdict:  ok | suspect
```

### 3. Viés nas camadas de conversão

As conversões seguidas imediatamente por BatchNorm devem ter `bias=False`. O beta do BN já parametriza o viés, portanto, um viés de conv extra desperdiça parâmetros e pode retardar a convergência.

Diagnóstico:
```
[bias]
  convs with BN and bias=True: <count>
  recommended fix: set bias=False on those layers
```

### 4. ReLU e autograd no local

`nn.ReLU(inplace=True)` no tensor que será adicionado ao atalho substitui valores que ainda podem ser necessários para a adição residual. Sinalize qualquer `inplace=True` que não seja seguido por uma camada que produza um novo tensor antes da adição.

Diagnóstico:
__CODE_BLOCO_3__

## Relatório

```
[block-review]
  variant:       basic | bottleneck | preact | se | other
  shortcut:      ok | wrong | heavy
  activation:    ok | suspect
  bias-bn:       ok | <N> convs need bias=False
  in-place:      ok | <N> risky ops
  summary:       one sentence
```

## Regras

- Não reescreva o bloco. Somente relatório.
- Se o bloco estiver correto, diga `ok` em todos os lugares e pare. Sem sugestões.
- Se várias coisas estiverem erradas, liste-as na ordem acima (atalho primeiro porque é a causa mais comum de travamentos).
- Nunca sinalize uma variante de pré-ativação deliberada ou de compressão e excitação como errada quando o usuário a tiver especificado.