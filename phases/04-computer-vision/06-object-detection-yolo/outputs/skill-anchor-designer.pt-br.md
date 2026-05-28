---
name: skill-anchor-designer
description: Dado um conjunto de dados de caixas de verdade, execute k-means em (w, h) e retorne conjuntos de âncoras por nível FPN mais estatísticas de cobertura
version: 1.0.0
phase: 4
lesson: 6
tags: [computer-vision, detection, anchors, kmeans]
---

# Designer de âncora

As âncoras são o hiperparâmetro mais específico do conjunto de dados em um detector baseado em âncora. As âncoras COCO padrão apresentam desempenho inferior em imagens de cultura celular, blocos de satélite ou vigilância de pequenos objetos. Essa habilidade deriva âncoras que realmente correspondem aos dados de destino.

## Quando usar

- Antes de um primeiro treinamento executado em um novo conjunto de dados.
- Quando a recuperação de objetos muito pequenos ou muito grandes é fraca em um modelo saudável.
- Após uma grande expansão do conjunto de dados em que a distribuição do tamanho das caixas pode ter mudado.

## Entradas

- `boxes`: matriz numpy de formato (N, 4) no formato `(cx, cy, w, h)` ou `(x1, y1, x2, y2)`; pelo menos 1000 caixas positivas recomendadas.
- `num_anchors_per_level`: geralmente 3.
- `num_fpn_levels`: geralmente 3 (P3, P4, P5) ou 4.
- `input_size`: resolução de treinamento HxW.
- Opcional `strides`: passadas por nível; quando omitido, pegue as primeiras entradas `num_fpn_levels` de `[8, 16, 32, 64]`. Passe explicitamente uma matriz mais longa ou mais curta se o FPN do detector tiver avanços diferentes.

## Etapas

1. **Normalize as caixas** para `(w, h)` pares em unidades de pixel em `input_size`. Elimine qualquer um com w ou h <2 pixels.

2. **Execute k-means** em pares `(w, h)`, com `k = num_anchors_per_level * num_fpn_levels`. Use `1 - IoU(box, cluster)` como a função de distância, não a distância euclidiana - a euclidiana em `(w, h)` recolhe caixas altas e finas e caixas quadradas juntas. Todas as caixas contribuem igualmente (sem peso); se você tiver um conjunto de dados desequilibrado de classe e quiser recuperar caixas maiores, repita caixas de classes raras na matriz de entrada em vez de passar um vetor de peso.

3. **Classifique os clusters por área** em ordem crescente. Divida em `num_fpn_levels` grupos de `num_anchors_per_level`. As áreas menores vão para o nível de resolução mais alto (passo menor).

4. **Estatísticas de cobertura de cálculo** por nível:
   - `median IoU` de cada caixa de verdade para sua melhor âncora naquele nível.
   - `recall@IoU=0.5` — porcentagem de caixas cuja melhor âncora possui IoU >= 0,5.
   - `area coverage` — fração de caixas cuja área está dentro de `[anchor_min_area / 4, anchor_max_area * 4]` do nível.

5. **Relatório de âncoras por nível** e níveis de sinalização onde `recall@IoU=0.5 < 0.9`; as âncoras desse nível não correspondem bem aos dados e devem ser reajustadas ou o número de âncoras por nível aumentado.

## Formato do relatório

```
[anchor-designer]
  total boxes:         <N>
  clusters:            <k>
  distance metric:     1 - IoU

[level P3  stride=8]
  anchors (w, h):      [(A, B), (C, D), (E, F)]
  median IoU:          <X>
  recall@IoU=0.5:      <X>
  coverage:            <X>
  flag:                ok | retune

[level P4  stride=16]
  ...

[summary]
  overall recall@IoU=0.5: <X>
  smallest anchor:        <w x h>
  largest anchor:         <w x h>
  recommendation:         <one sentence if any level flagged>
```

## Regras

- Utilize sempre distância baseada em IoU; As médias k euclidianas produzem âncoras visualmente razoáveis, mas empiricamente piores.
- Classifique os clusters por área e atribua-os aos níveis em ordem crescente.
- Quando `num_anchors_per_level = 1`, pule k-means completamente: divida as caixas em `num_fpn_levels` compartimentos por quantil de área (por exemplo, tercis para 3 níveis) e defina a âncora de cada nível para a mediana por compartimento (w, h). Isso é mais robusto do que executar k-means com `k = num_fpn_levels` em pequenos conjuntos de dados.
- Nunca imprima dimensões negativas da ancoragem; braçadeira em 1.
- Se o conjunto de dados tiver <200 caixas, avise o usuário que a pesquisa de âncora não é confiável e recomende o uso de âncoras COCO padrão, além de mais dados de treinamento.