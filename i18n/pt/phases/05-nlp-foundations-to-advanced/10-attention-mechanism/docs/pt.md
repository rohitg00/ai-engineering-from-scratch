# Mecanismo de Atenção  A descoberta

> O decodificador deixa de olhar para um resumo comprimido e começa a olhar para toda a fonte.

**Type:** Build
**Languages:** Python, TypeScript
**Prerequisites:** Phase 5 · 09 (Sequence-to-Sequence Models)
**Time:** ~45 minutes

## O problema

A lição 09 terminou com uma falha medida. Um codificador-decodificador GRU treinado em uma tarefa de cópia de brinquedo vai de 89% de precisão na comprimento 5 para quase acaso na comprimento 80. A razão é estrutural, não um erro de treinamento: cada bit de informação coletada pelo codificador tem que caber em um estado oculto de tamanho fixo, e o decodificador nunca vê nada mais.

Bahdanau, Cho e Bengio publicaram uma correção de três linhas em 2014. Em vez de dar ao decodificador apenas o estado final do encodificador, mantenha cada estado do encodificador. Em cada passo do decodificador, calcule uma média ponderada dos estados do encodificador onde os pesos dizem "quanto o decodificador precisa olhar para a posição do encodificador `i`Essa média ponderada é o contexto, e muda cada passo do decodificador.

É essa a ideia. Os transformadores ampliaram-na. A auto-atenção aplicou-a a uma única sequência. A atenção multi-head correu em paralelo. Mas a versão de 2014 já quebrou o gargalo de engarrafamento, e uma vez que você tem, o pivô para transformadores é engenharia, não conceitual.

## O conceito

![Bahdanau attention: decoder queries all encoder states](../assets/attention.svg)

Em cada passo de decodificação `t`- Não .

1. Use o estado oculto do decodificador anterior `s_{t-1}`como um **query**- Não .
2. Ponha-o contra cada estado de codificação oculto .`h_1, ..., h_T`Um escalar por posição do codificador.
3. Softmax as pontuações para obter pesos de atenção `α_{t,1}, ..., α_{t,T}`que a soma é de 1.
4. Vêctor de contexto `c_t = Σ α_{t,i} * h_i`- Media ponderada dos estados do codificador.
5. O decodificador leva `c_t`mais o token de saída anterior, produz o próximo token.

A média ponderada é o ponto. Quando o decodificador precisa traduzir "Je" para "I", ele pesa o estado do codificador sobre "Je" alto e os outros baixos. Quando ele precisa de "não", ele pesa "pas" alto. O vetor de contexto remodela cada passo.

## Formas (a coisa que morde a todos)

É aqui que toda implementação de atenção vai mal a primeira vez.

| Thing | Shape | Notes |
|-------|-------|-------|
| Encoder hidden states `H` | `(T_enc, d_h)` | If BiLSTM, `d_h = 2 * d_hidden` |
| Decoder hidden state `s_{t-1}` | `(d_s,)` | One vector |
| Attention score `e_{t,i}` | scalar | One per encoder position |
| Attention weight `α_{t,i}` | scalar | After softmax over all `i` |
| Context vector `c_t` | `(d_h,)` | Same shape as an encoder state |

**Bahdanau (additive) score.** `e_{t,i} = v_α^T * tanh(W_a * s_{t-1} + U_a * h_i)`- Não .

- `s_{t-1}`tem forma`(d_s,)`- Não .`h_i`tem forma`(d_h,)`- Não .
- `W_a`tem forma`(d_attn, d_s)`- Não .`U_a`tem forma`(d_attn, d_h)`- Não .
- A sua soma dentro do tanh tem forma .`(d_attn,)`- Não .
- `v_α`tem forma`(d_attn,)`O produto interno com`v_α`- Ele desmorona para um escalar.**This is what `v_α` does.**Não é mágica, é a projeção que transforma um vetor de atenção-dim em uma pontuação escalar.

**Luong (multiplicative) score.**Três variantes:

- `dot`- Não .`e_{t,i} = s_t^T * h_i`- Requer .`d_s == d_h`- Não, não, não, não.
- `general`- Não .`e_{t,i} = s_t^T * W * h_i`com`W`forma`(d_s, d_h)`Remove a restrição de igual dim.
- `concat`A forma Bahdanau é essencialmente a mais rara, já que as duas primeiras são mais baratas.

**One Bahdanau / Luong gotcha worth naming.**Bahdanau utiliza `s_{t-1}`(o estado do decodificador * antes de * gerar a palavra atual). Luong usa `s_t`(o estado *após *). misturando-os produz gradientes sutilmente errados que são extremamente difíceis de depurar.

```figure
attention-heatmap
```

## Construí-lo

### Passo 1: atenção aditiva (Bahdanau)

```python
import numpy as np


def additive_attention(decoder_state, encoder_states, W_a, U_a, v_a):
    projected_dec = W_a @ decoder_state
    projected_enc = encoder_states @ U_a.T
    combined = np.tanh(projected_enc + projected_dec)
    scores = combined @ v_a
    weights = softmax(scores)
    context = weights @ encoder_states
    return context, weights


def softmax(x):
    x = x - np.max(x)
    e = np.exp(x)
    return e / e.sum()
```

Verifique as suas formas contra a mesa acima.`encoder_states`tem forma`(T_enc, d_h)`- Não .`projected_enc`tem forma`(T_enc, d_attn)`- Não .`projected_dec`tem forma`(d_attn,)`e transmissões. `combined`tem forma`(T_enc, d_attn)`- Não .`scores`tem forma`(T_enc,)`- Não .`weights`tem forma`(T_enc,)`- Não .`context`tem forma`(d_h,)`- Envia-o.

### Passo 2: Luong dot e geral

```python
def dot_attention(decoder_state, encoder_states):
    scores = encoder_states @ decoder_state
    weights = softmax(scores)
    return weights @ encoder_states, weights


def general_attention(decoder_state, encoder_states, W):
    projected = W.T @ decoder_state
    scores = encoder_states @ projected
    weights = softmax(scores)
    return weights @ encoder_states, weights
```

É por isso que o papel de Luong chegou, com a mesma precisão na maioria das tarefas, muito menos código.

### Passo 3: exemplo numérico trabalhado

Dado três estados de codificação (aproximadamente "cat", "sat", "mat") e um estado de decodificação que alinha mais com o primeiro, a distribuição de atenção se concentra na posição 0.

```python
H = np.array([
    [1.0, 0.0, 0.2],
    [0.5, 0.5, 0.1],
    [0.1, 0.9, 0.3],
])

s_close_to_cat = np.array([0.9, 0.1, 0.2])
ctx, w = dot_attention(s_close_to_cat, H)
print("weights:", w.round(3))
```

```
weights: [0.464 0.305 0.231]
```

A primeira linha ganha, depois move o estado do decodificador mais perto do terceiro estado do encodificador e observe a mudança de pesos.

### Passo 4: por que esta é a ponte para transformadores

Traduza a linguagem acima para Q/K/V:

- **Query**= estado do decodificador `s_{t-1}`
- **Key**= estados de codificação (o que nós pontuação em relação)
- **Value**= estados de codificação (o que pesamos e somamos)

Na atenção clássica, as chaves e os valores são a mesma coisa. A auto-atenção as separa: você pode consultar uma sequência contra si mesma, com diferentes projeções aprendidas para K e V. A atenção multi-cabeça executa-a em paralelo com diferentes projeções aprendidas. Os transformadores empilham o estágio inteiro muitas vezes e soltam RNNs.

A matemática é a mesma, as formas são as mesmas, o salto pedagógico da atenção Bahdanau para a atenção escalada de produto de ponto é principalmente notação.

## Usá-lo

PyTorch e TensorFlow enviam a atenção diretamente.

```python
import torch
import torch.nn as nn

mha = nn.MultiheadAttention(embed_dim=128, num_heads=8, batch_first=True)
query = torch.randn(2, 5, 128)
key = torch.randn(2, 10, 128)
value = torch.randn(2, 10, 128)

output, weights = mha(query, key, value)
print(output.shape, weights.shape)
```

```
torch.Size([2, 5, 128]) torch.Size([2, 5, 10])
```

É uma camada de atenção do transformador. Batalha de consulta de 5 posições, bateria de chave/valor de 10 posições, 128-dim cada, 8 cabeças.`output`É a nova consulta aumentada de contexto. `weights`é a matriz de alinhamento 5x10 que você pode visualizar.

### Quando a atenção clássica ainda é importante

- A versão de cabeça única, de camada única, baseada no RNN torna cada conceito visível.
- tarefas de sequência no dispositivo em que os transformadores não se encaixam.
- Qualquer artigo de 2014 a 2017 vai ser mal lido sem saber a convenção de Bahdanau.
- Análise de alinhamento de grãos finos em MT. Pesos de atenção em bruto são uma ferramenta de interpretação mesmo em modelos de transformadores, e lê-los requer saber o que são.

### A armadilha da atenção-peso-como-explicação

Os pesos de atenção parecem interpretáveis. São pesos que somam a um em todas as posições; você pode traçar-os; alto significa "olhado para isso".

Eles não são tão interpretáveis quanto parecem. Jain e Wallace (2019) mostraram que as distribuições de atenção podem ser permutadas e substituídas por alternativas arbitrárias sem mudar as previsões de modelos para algumas tarefas. Nunca relatar pesos de atenção como evidência de raciocínio sem uma ablação ou verificação contrafactual.

## Envia-o

Salva como`outputs/prompt-attention-shapes.md`- Não .

```markdown
---
name: attention-shapes
description: Debug shape bugs in attention implementations.
phase: 5
lesson: 10
---

Given a broken attention implementation, you identify the shape mismatch. Output:

1. Which matrix has the wrong shape. Name the tensor.
2. What its shape should be, derived from (d_s, d_h, d_attn, T_enc, T_dec, batch_size).
3. One-line fix. Transpose, reshape, or project.
4. A test to catch regressions. Typically: assert `output.shape == (batch, T_dec, d_h)` and `weights.shape == (batch, T_dec, T_enc)` and `weights.sum(dim=-1) close to 1`.

Refuse to recommend fixes that silently broadcast. Broadcast-hiding bugs surface later as silent accuracy degradation, the worst kind of attention bug.

For Bahdanau confusion, insist the decoder input is `s_{t-1}` (pre-step state). For Luong, `s_t` (post-step state). For dot-product, flag dimension mismatch between query and key as the most common first-time error.
```

## Exercícios

1. **Easy.**Implementação `softmax`Mascarar para que os tokens de enchimento no codificador tenham peso de atenção zero.
2. **Medium.**Adicionar atenção multi-cabeça para o Luong `general`Forma.`d_h`em`n_heads`Grupos, atender por cabeça, concatenar, verificar se o caso de cabeça única coincide com a sua implementação anterior.
3. **Hard.**Treinar um codificador-decodificador GRU com Bahdanau atenção na tarefa de cópia de brinquedo da lição 09. A precisão da trama vs comprimento da sequência. Comparar com a linha de base de falta de atenção. Você deve ver a lacuna aumentar à medida que o comprimento cresce, confirmando atenção levanta o gargalo de engarrafamento.

## Termos-chave

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| Attention | Looking at things | Weighted average of a value sequence, weights computed from a query-key similarity. |
| Query, Key, Value | QKV | Three projections: Q asks, K is what to match, V is what to return. |
| Additive attention | Bahdanau | Feed-forward score: `v^T tanh(W q + U k)`. |
| Multiplicative attention | Luong dot / general | Score is `q^T k` or `q^T W k`. Cheaper, same accuracy on most tasks. |
| Alignment matrix | The pretty picture | Attention weights as a `(T_dec, T_enc)` grid. Read it to see what the model attended to. |

## Mais leitura

- [Bahdanau, Cho, Bengio (2014). Neural Machine Translation by Jointly Learning to Align and Translate](https://arxiv.org/abs/1409.0473)- O jornal.
- [Luong, Pham, Manning (2015). Effective Approaches to Attention-based Neural Machine Translation](https://arxiv.org/abs/1508.04025) as três variantes de pontuação e a sua comparação.
- [Jain and Wallace (2019). Attention is not Explanation](https://arxiv.org/abs/1902.10186) a precaução de interpretação.
- [Dive into Deep Learning — Bahdanau Attention](https://d2l.ai/chapter_attention-mechanisms-and-transformers/bahdanau-attention.html)- Passagem a pé com PyTorch.
