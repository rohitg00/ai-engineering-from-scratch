---
name: skill-image-tensor-inspector
description: Inspecione qualquer tensor ou matriz em forma de imagem e relate o tipo, layout, intervalo e se parece bruto, normalizado ou padronizado
version: 1.0.0
phase: 4
lesson: 1
tags: [computer-vision, debugging, preprocessing, tensors]
---

# Inspetor de tensor de imagem

Uma habilidade de diagnóstico para qualquer ponto em um pipeline de visão onde você está segurando uma matriz em forma de imagem e precisa saber exatamente em que estado ela se encontra.

## Quando usar

- Um modelo pré-treinado retorna previsões de lixo e você suspeita do pré-processamento.
- A migração de um pipeline entre OpenCV e torchvision e a ordem dos canais não são claras.
- Empilhamento de camadas de múltiplas estruturas e o eixo do lote continua aparecendo no lugar errado.
- Depurando um loop de treinamento onde a perda está travada em `log(num_classes)`.

## Entradas

- `x`: qualquer array 2-D, 3-D ou 4-D (NumPy, PyTorch, JAX).
- Opcional `expected`: um ditado de invariantes para verificar, por exemplo. `{"layout": "CHW", "range": "standardized"}`.

## Etapas

1. **Resolver back-end** — detecte se `x` é NumPy, Torch ou JAX. Converta para NumPy para inspeção sem alterar o original.

2. **Classificar classificação**:
   - classificação 2 -> imagem de canal único (H, W).
   - classificação 3 -> `HWC` se o último eixo for 1, 3 ou 4 e for estritamente menor que os outros dois; caso contrário, `CHW`.
   - classificação 4 -> prefira `NCHW` se o eixo 1 estiver em {1, 3, 4} **e** o eixo 2 ou o eixo 3 for maior que 16; caso contrário, prefira `NHWC`. A verificação pura do eixo 1 classifica incorretamente lotes NHWC de imagens pequenas como `(3, 4, 224, 3)`.
   - Sempre sinalize casos ambíguos (por exemplo, `(1, 3, 3, 3)`) como `ambiguous` em vez de adivinhar; exigir que o chamador forneça `expected`.

3. **Classificar tipo e intervalo**:
   - `uint8` em [0, 255] -> `raw`.
   - `float*` com mínimo >= 0 e máximo <= 1,01 -> `normalized`.
   - `float*` com min < 0 e |mean| < 0,5 e 0,5 <= padrão <= 1,5 -> `standardized`.
   - Qualquer outra coisa -> `unusual`, imprima o histograma.

4. **Estatísticas por canal** — reporta média e padrão por canal. Compare com a média/padrão do ImageNet se a matriz parece padronizada e apresenta uma confiança de correspondência.

5. **Relatório** neste exato bloco:

```
[inspector]
  backend:   numpy | torch | jax
  rank:      2 | 3 | 4
  layout:    HW | HWC | CHW | NHWC | NCHW
  dtype:     <dtype>
  shape:     <shape>
  range:     raw | normalized | standardized | unusual
  min/max:   <min> / <max>
  per-channel mean: [ ... ]
  per-channel std:  [ ... ]
  likely source:    camera | PIL | OpenCV | torchvision | random init
  likely target:    display | training | inference
```

6. **Recomende a próxima ação** com base em `likely target`:
   - Para `display`: transponha para HWC, recorte, converta para uint8.
   - Para `training`: padronize com estatísticas do conjunto de dados, transponha para CHW, adicione eixo de lote.
   - Para `inference`: combine os invariantes exatos no cartão de modelo.

## Regras

- Nunca altere a entrada. Imprimir apenas diagnósticos.
- Se `expected` for fornecido, sinalize cada incompatibilidade com `[expected X got Y]`.
- Identifique os riscos de falha silenciosa quando o layout ou a ordem dos canais for ambíguo.
- Recomende uma ação de cada vez, não uma lista de opções.