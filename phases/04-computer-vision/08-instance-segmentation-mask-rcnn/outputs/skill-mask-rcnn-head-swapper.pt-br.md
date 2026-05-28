---
name: skill-mask-rcnn-head-swapper
description: Gere o código exato para trocar as cabeças da caixa e da máscara em uma máscara torchvision R-CNN para um num_classes personalizado
version: 1.0.0
phase: 4
lesson: 8
tags: [computer-vision, mask-rcnn, fine-tuning, torchvision]
---

# Trocador de cabeça de máscara R-CNN

Produz o padrão de troca de cabeçote especificamente para Mask R-CNN. O modelo abaixo assume `model.roi_heads.box_predictor` e `model.roi_heads.mask_predictor`, que existem apenas em `maskrcnn_resnet50_fpn` e `maskrcnn_resnet50_fpn_v2`. O Faster R-CNN possui um preditor de caixa, mas nenhum preditor de máscara; RetinaNet usa `RetinaNetHead` e não tem `roi_heads` – ambos exigem habilidades diferentes.

## Quando usar

- Ajuste fino de `maskrcnn_resnet50_fpn` ou `maskrcnn_resnet50_fpn_v2` em um conjunto de classes personalizado.
- Portando um ponto de verificação Mask R-CNN treinado em COCO para uma contagem de classes não COCO.
- Depurando uma execução de treinamento Mask R-CNN que falha na incompatibilidade de `cls_score.out_features` ou `mask_predictor`.

## Fora do escopo

- `fasterrcnn_*` — sem máscara_predictor. Trocar apenas `box_predictor`; use uma receita separada de troca de cabeçote Faster R-CNN.
- `retinanet_*` — não `roi_heads`; classificador + cabeças de regressão residem em `model.head.classification_head` e `model.head.regression_head`. Use uma habilidade específica do RetinaNet.
- `keypointrcnn_*` — usa `keypoint_predictor` em vez de `mask_predictor`.

## Entradas

- `model_name`: construtor do modelo de detecção torchvision, por ex. `maskrcnn_resnet50_fpn_v2`.
- `num_classes`: incluindo plano de fundo. Um conjunto de dados de classe de 4 objetos significa `num_classes=5`.
- `freeze`: um de `backbone`, `backbone_fpn`, `none`.

## Etapas

1. Importe o construtor do modelo e as duas classes preditoras (`FastRCNNPredictor`, `MaskRCNNPredictor`).
2. Carregue o modelo pré-treinado de pesos padrão.
3. Substitua `model.roi_heads.box_predictor` por um novo `FastRCNNPredictor(in_features, num_classes)`.
4. Substitua `model.roi_heads.mask_predictor` por um novo `MaskRCNNPredictor(in_features_mask, hidden_layer=256, num_classes)`.
5. Aplique a política de congelamento solicitada.
6. Imprima um bloco de confirmação listando parâmetros treináveis ​​por módulo.

## Modelo de código de saída

```python
from torchvision.models.detection import {MODEL_NAME}, {MODEL_WEIGHTS}
from torchvision.models.detection.faster_rcnn import FastRCNNPredictor
from torchvision.models.detection.mask_rcnn import MaskRCNNPredictor

def build_model(num_classes={NUM_CLASSES}):
    model = {MODEL_NAME}(weights={MODEL_WEIGHTS}.DEFAULT)
    in_features = model.roi_heads.box_predictor.cls_score.in_features
    model.roi_heads.box_predictor = FastRCNNPredictor(in_features, num_classes)
    in_features_mask = model.roi_heads.mask_predictor.conv5_mask.in_channels
    model.roi_heads.mask_predictor = MaskRCNNPredictor(in_features_mask, 256, num_classes)

    {FREEZE_BLOCK}

    return model
```

Onde `{FREEZE_BLOCK}` está:

- `none` -> vazio
- `backbone` ->
  ```python
  for p in model.backbone.parameters():
      p.requires_grad = False
  ```
- `backbone_fpn` ->
  ```python
  for p in model.backbone.parameters():
      p.requires_grad = False
  # FPN parameters live inside backbone.fpn
  ```

## Relatório

__CODE_BLOCO_3__

## Regras

- Nunca recomende `num_classes` sem o background incluído; sempre lembre o usuário.
- Sempre use as variantes `_v2` dos modelos de detecção torchvision quando disponíveis; eles têm pesos pré-treinados melhores do que os legados.
- Não instancie o modelo dentro desta habilidade — produza o bloco de código e deixe o usuário executá-lo.
- Se o usuário solicitar `freeze backbone` em um conjunto de dados com mais de 10.000 imagens, sugira que ele também considere fazer o ajuste fino do backbone.