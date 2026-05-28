---
name: skill-conv-shape-calculator
description: Percorra uma especificação CNN camada por camada e relate o formato de saída, o campo receptivo e a contagem de parâmetros para cada bloco
version: 1.0.0
phase: 4
lesson: 2
tags: [computer-vision, cnn, architecture, debugging]
---

# Calculadora de formato de conversão

Um auxiliar determinístico para planejar ou depurar uma CNN. Dada uma forma de entrada e uma lista de especificações de camada, formas de rastreamento, campos receptivos e contagens de parâmetros sem executar o modelo.

## Quando usar

- Projetando uma nova CNN e você deseja verificar se cada redução da resolução chega a um tamanho limpo.
- Ler um artigo e traduzir sua tabela de arquitetura em código.
- Um backbone pré-treinado trava com uma incompatibilidade de forma no cabeçote do classificador e você precisa saber qual camada alterou o tamanho espacial.
- Comparar dois backbones na eficiência dos parâmetros antes do treinamento.

## Entradas

- `input_shape`: `(C, H, W)`.
- `layers`: lista ordenada de dictos de camada. Cada um suporta:
  - `{type: "conv", c_out, k, s, p, groups=1, bias=true}`
  - `{type: "pool", mode: "max"|"avg", k, s, p=0}`
  - `{type: "adaptive_pool", out_h, out_w}`
  - `{type: "flatten"}`
  - `{type: "linear", out_features, bias=true}`

## Etapas

1. **Inicializar rastreamento** com `(C, H, W)`, campo receptivo `1`, passada efetiva `1`, parâmetros cumulativos `0`.

2. **Para cada camada**, atualize nesta ordem:
   - Calcular `C_out` (conv/linear) ou transportar `C_in` através (pool).
   - Calcule a saída espacial usando `(H + 2P - K) / S + 1` para conv e pool, `out_h/out_w` para pool adaptativo, `(1, 1)` para nivelar a forma de saída `(C * H * W, 1, 1)` antes do linear e escalar `1x1` para linear.
   - Atualizar campo receptivo e passada efetiva:
     - Conv/grupo: `RF_new = RF_old + (K - 1) * effective_stride`, `effective_stride *= S`.
     - Pool adaptativo: trate como um pool com `S = H_in / out_h` efetivo (arredondado para baixo). `RF_new = RF_old + (H_in - 1) * effective_stride_old`; `effective_stride *= S`. Observe que o RF do pool adaptativo é igual a toda a extensão espacial anterior.
     - Achatar/linear: RF e passada efetiva não são mais significativas; congele-os nos valores anteriores ao nivelamento e omita nas linhas subsequentes.
   - Calcular parâmetros:
     - Conv.: `C_out * (C_in / groups) * K * K + (C_out if bias else 0)`.
     - Linear: `out_features * in_features + (out_features if bias else 0)`.
     - Piscina e achatamento: 0.

3. **Detecte problemas** e sinalize-os:
   - Tamanho de saída não inteiro (passada/preenchimento desalinhado).
   - `H_out <= 0` antes do final da pilha.
   - Campo receptivo excedendo o tamanho da entrada (possível desperdício de computação após esse ponto).
   - Saltos repentinos de 10x nos parâmetros por camada que sugerem o plano de canal errado.

4. **Relatório** como uma única tabela:

```
idx  layer                C_in  C_out  K  S  P  H_out  W_out  RF    params     cum_params
1    conv 3x3 s=1 p=1     3     32     3  1  1  224    224    3     896        896
2    conv 3x3 s=2 p=1     32    64     3  2  1  112    112    7     18,496     19,392
3    pool max 2x2         64    64     2  2  0  56     56     11    0          19,392
...
```

5. **Linha de resumo**: `(C, H, W)` final, campo receptivo final, parâmetros totais, avisos.

## Regras

- Sempre retorne números inteiros para tamanhos espaciais. Se a fórmula produzir um número não inteiro, sinalize como um erro e não use silêncio.
- Quando `groups > 1`, verifique `C_in % groups == 0` e `C_out % groups == 0`; caso contrário, erro.
- Para conversão em profundidade (`groups == C_in`), rotule-a na coluna `layer` para que o leitor veja por que os parâmetros estão baixos.
- Se o usuário fornecer BatchNorm ou camadas de ativação, ignore-as para fins de forma, mas leve os parâmetros adiante (`2 * C` por BatchNorm).
- Nunca adivinhe os padrões de campos ausentes. Exija `k`, `s`, `p` em cada conversão e pool.