---
name: skill-segmentation-mask-inspector
description: Relate a distribuição de classes, estatísticas de máscara prevista e as classes com maior probabilidade de serem subprevistas ou com limites confusos
version: 1.0.0
phase: 4
lesson: 7
tags: [computer-vision, segmentation, debugging, evaluation]
---

# Inspetor de máscara de segmentação

Um diagnóstico para a lacuna entre “a perda diminuiu” e “as máscaras realmente parecem certas”.

## Quando usar

- Logo após uma corrida de treinamento, quando meu IoU parece bem, mas a inspeção visual diz o contrário.
- Antes da implantação: verificar o equilíbrio das previsões da classe em relação à verdade.
- Quando a IoU por classe é alta para objetos grandes, mas baixa para objetos pequenos.
- Depuração de artefatos de limite que não aparecem na IoU porque são pequenos em contagem de pixels.

## Entradas

- `preds`: (N, H, W) tensor de IDs de classe previstos.
- `targets`: (N, H, W) tensor de IDs de classe de verdade.
- `num_classes`: inteiro.
- Opcional `class_names`: lista de strings C.

## Etapas

1. **Histogramas de pixel de classe.** Calcule a porcentagem de pixels por classe para `preds` e `targets`. Sinalize qualquer classe onde `|pred% - gt%| / max(gt%, 1e-6) > 0.30` (desvio relativo acima de 30%). Para classes ausentes da verdade básica (`gt% == 0`), sinalize qualquer compartilhamento previsto acima de `0.3` diretamente.

2. **IoU por classe** e **limite F1 por classe**. O limite F1 é calculado dilatando cada máscara em 3 pixels, cruzando e pontuando. Classes com IoU > 0,7, mas limite F1 < 0,5 são bordas desfocadas.

3. **Recuperação de objetos pequenos.** Separe cada componente conectado com base na verdade em intervalos de tamanho (pequeno <100 px, pequeno <1000 px, médio <10000 px, grande >= 10000 px). Rechamada de relatório por bucket por classe. A recordação de objetos pequenos abaixo de 0,3, enquanto a recordação de objetos grandes está acima de 0,9 indica um problema de resolução/campo receptivo.

4. **Pares de confusão.** Para cada classe, encontre a classe com a qual ela confunde com mais frequência (classe errada prevista mais comum dentro de sua máscara de verdade). Relate os 3 melhores pares.

5. **Verificação de saturação (requer `probs` ou `logits`, não apenas `preds`).** Se o chamador passar na distribuição de probabilidade bruta por pixel `probs: (N, C, H, W)`, calcule a fração de pixels onde `probs.max(dim=1) > 0.99` por classe. A alta saturação (>0,9 dos pixels de uma classe) sugere excesso de confiança – candidata para suavização ou calibração de rótulos. Quando apenas argmaxed `preds` estiverem disponíveis, pule esta etapa e anote-a no relatório.

## Formato do relatório

```
[mask-inspector]
  classes: C

[class distribution]
  name       gt %    pred %   delta
  ...

[metrics]
  class       IoU     bF1    recall_tiny  recall_small  recall_medium  recall_large
  ...

[confusion pairs]
  class A confused with class B: <N> pixels (most common)
  class B confused with class A: <N> pixels
  ...

[verdict]
  most impactful issue: <one sentence>
```

## Regras

- Classifique as linhas das classes descendo a parcela de pixels gt para que as classes mais frequentes venham primeiro.
- Sinalize classes com IoU < 0,4 ou limite F1 < 0,3 como `critical`.
- Quando a recuperação de objetos pequenos for a falha dominante, recomende: treinamento de maior resolução, passos menores no último estágio do codificador ou um decodificador de pirâmide de recursos.
- Quando o limite F1 for a falha dominante, recomende: perda com reconhecimento de limite (Lovasz ou BoundaryLoss), TTA com inversão horizontal e decodificador sem passos.
- Nunca produza índices de classe como único identificador; se `class_names` for fornecido, use-o em todas as linhas.