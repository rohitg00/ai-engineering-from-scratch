# Mecanismo de Attention — A Virada

> O decoder para de espreitar um resumo comprimido e começa a olhar toda a fonte. Tudo depois disso é attention mais engenharia.

**Tipo:** Construção
**Linguagens:** Python
**Pré-requisitos:** Fase 5 · 09 (Modelos Sequence-to-Sequence)
**Tempo:** ~45 minutos

## O Problema

A lição 09 terminou com uma falha medida. Um encoder-decoder GRU treinado em tarefa de cópia de brinquedo vai de 89% de acurácia em comprimento 5 pra quase chance em comprimento 80. A razão é estrutural, não bug de treino: cada bit de informação que o encoder extraiu tem que caber em um estado oculto de tamanho fixo, e o decoder nunca vê mais nada.

Bahdanau, Cho e Bengio publicaram uma correção de três linhas em 2014. Em vez de dar ao decoder só o estado final do encoder, mantém todos os estados do encoder. A cada passo do decoder, calcula uma média ponderada dos estados do encoder onde os pesos dizem "quanto o decoder precisa olhar a posição `i` do encoder agora?" Essa média ponderada é o contexto, e ela muda a cada passo do decoder.

Essa é a ideia inteira. Transformers a estenderam. Self-attention aplicou a uma única sequência. Multi-head attention rodou em paralelo. Mas a versão de 2014 já quebrou o gargalo, e uma vez que você tem ele, a virada pra transformers é engenharia, não conceitual.

## O Conceito

![Bahdanau attention: decoder consulta todos os estados do encoder](../assets/attention.svg)

A cada passo do decoder `t`:

1. Usa o estado oculto anterior do decoder `s_{t-1}` como **query**.
2. Pontua contra cada estado oculto do encoder `h_1, ..., h_T`. Um escalar por posição do encoder.
3. Faz softmax nos scores pra obter pesos de attention `α_{t,1}, ..., α_{t,T}` que somam 1.
4. Vetor de contexto `c_t = Σ α_{t,i} * h_i`. Média ponderada dos estados do encoder.
5. Decoder usa `c_t` mais o token de saída anterior, produz o próximo token.

A média ponderada é o ponto. Quando o decoder precisa traduzir "Je" pra "I", pondera alto o estado do encoder sobre "Je" e baixo os outros. Quando precisa de "not", pondera "pas" alto. O vetor de contexto reforma cada passo.

## Formas (o que pega todo mundo)

Esse é onde toda implementação de attention erra na primeira vez. Leia devagar.

| Coisa | Forma | Notas |
|-------|-------|-------|
| Estados ocultos do encoder `H` | `(T_enc, d_h)` | Se BiLSTM, `d_h = 2 * d_hidden` |
| Estado oculto do decoder `s_{t-1}` | `(d_s,)` | Um vetor |
| Score de attention `e_{t,i}` | escalar | Um por posição do encoder |
| Peso de attention `α_{t,i}` | escalar | Depois do softmax sobre todos `i` |
| Vetor de contexto `c_t` | `(d_h,)` | Mesma forma de um estado do encoder |

**Score Bahdanau (aditivo).** `e_{t,i} = v_α^T * tanh(W_a * s_{t-1} + U_a * h_i)`.

- `s_{t-1}` tem forma `(d_s,)`, `h_i` tem forma `(d_h,)`.
- `W_a` tem forma `(d_attn, d_s)`. `U_a` tem forma `(d_attn, d_h)`.
- Soma deles dentro do tanh tem forma `(d_attn,)`.
- `v_α` tem forma `(d_attn,)`. Produto interno com `v_α` colapsa pra escalar. **Isso é o que `v_α` faz.** Não é magia. É a projeção que transforma um vetor de dimensão attention num score escalar.

**Score Luong (multiplicativo).** Três variantes:

- `dot`: `e_{t,i} = s_t^T * h_i`. Requer `d_s == d_h`. Restrição dura. Pule se seu encoder é bidirecional.
- `general`: `e_{t,i} = s_t^T * W * h_i` com `W` de forma `(d_s, d_h)`. Remove a restrição de dimensões iguais.
- `concat`: essencialmente a forma Bahdanau. Raramente usado já que os dois primeiros são mais baratos.

**Um gotcha Bahdanau/Luong que vale nomear.** Bahdanau usa `s_{t-1}` (estado do decoder *antes* de gerar a palavra atual). Luong usa `s_t` (estado *depois*). Misturar gera gradientes sutilmente errados que são extremamente difíceis de debugar. Escolha um paper e siga sua convenção.

## Construindo

### Passo 1: attention aditiva (Bahdanau)

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

Verifique suas formas contra a tabela acima. `encoder_states` tem forma `(T_enc, d_h)`. `projected_enc` tem forma `(T_enc, d_attn)`. `projected_dec` tem forma `(d_attn,)` e faz broadcast. `combined` tem forma `(T_enc, d_attn)`. `scores` tem forma `(T_enc,)`. `weights` tem forma `(T_enc,)`. `context` tem forma `(d_h,)`. Pronto.

### Passo 2: Luong dot e general

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

Três linhas cada. É por isso que o paper do Luong caiu. Mesma precisão na maioria das tarefas, bem menos código.

### Passo 3: exemplo numérico trabalhado

Dados três estados do encoder (aproximadamente "cat", "sat", "mat") e um estado do decoder que se alinha mais com o primeiro, a distribuição de attention se concentra na posição 0. Se o estado do decoder se move pra se alinhar com o último, attention vai pra posição 2. O vetor de contexto acompanha.

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

Primeira linha ganha. Depois move o estado do decoder mais perto do terceiro estado do encoder e observe os pesos mudarem. É isso. Attention é alinhamento explícito.

### Passo 4: por que essa é a ponte pra transformers

Traduza a linguagem de cima pra Q/K/V:

- **Query** = estado do decoder `s_{t-1}`
- **Key** = estados do encoder (contra o que pontuamos)
- **Value** = estados do encoder (o que ponderamos e somamos)

Em attention clássica, keys e values são a mesma coisa. Self-attention separa: você pode consultar uma sequência contra si mesma, com diferentes projeções aprendidas pra K e V. Multi-head attention roda em paralelo com diferentes projeções aprendidas. Transformers empilham o estágio inteiro muitas vezes e eliminam RNNs.

A matemática é a mesma. As formas são as mesmas. O salto didático de attention Bahdanau pra attention de produto escalar escalonado é basicamente notação.

## Usando

PyTorch e TensorFlow trazem attention direto.

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

Essa é uma camada de attention de transformer. Lote de query de 5 posições, key/value lote de 10 posições, 128 dimensões cada, 8 heads. `output` são as queries aumentadas com contexto. `weights` é a matriz de alinhamento 5x10 que você pode visualizar.

### Quando attention clássica ainda importa

- Didática. A versão single-head, single-layer, baseada em RNN torna todo conceito visível.
- Tarefas de sequência em dispositivo onde transformers não cabem.
- Qualquer paper de 2014-2017. Você vai ler errado sem saber a convenção de Bahdanau.
- Análise de alinhamento granular em MT. Pesos de attention brutos são ferramenta de interpretabilidade mesmo em modelos transformer, e ler requer saber o que são.

### A armadilha de peso-de-attention-como-explicação

Pesos de attention parecem interpretáveis. São pesos que somam um entre posições; você pode plotar; alto significa "olhou pra isso." Revisores adoram.

Não são tão interpretáveis quanto parecem. Jain e Wallace (2019) mostraram que distribuições de attention podem ser permutadas e substituídas por alternativas arbitrárias sem mudar previsões do modelo em algumas tarefas. Nunca reporte pesos de attention como evidência de raciocínio sem uma verificação de ablação ou contrafactual.

## Entregando

Salve como `outputs/prompt-attention-shapes.md`:

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

1. **Fácil.** Implemente mascaramento de `softmax` pra que tokens de padding no encoder recebam peso de attention zero. Teste num lote com sequências de comprimento variável.
2. **Médio.** Adicione attention multi-head à forma `general` do Luong. Divida `d_h` em `n_heads` grupos, rode attention por head, concatene. Verifique que o caso single-head combina com sua implementação anterior.
3. **Difícil.** Treine um encoder-decoder GRU com attention Bahdanau na tarefa de cópia de brinquedo da lição 09. Plote acurácia vs. comprimento de sequência. Compare com o baseline sem attention. Você deve ver a lacuna se alargar conforme o comprimento cresce, confirmando que attention levanta o gargalo.

## Termos Chave

| Termo | O que a gente diz | O que realmente significa |
|------|-----------------|-----------------------|
| Attention | Olhar pras coisas | Média ponderada de uma sequência de values, pesos calculados de similaridade query-key. |
| Query, Key, Value | QKV | Três projeções: Q pergunta, K é com o que combinar, V é o que retornar. |
| Attention aditiva | Bahdanau | Score de feed-forward: `v^T tanh(W q + U k)`. |
| Attention multiplicativa | Luong dot / general | Score é `q^T k` ou `q^T W k`. Mais barato, mesma precisão na maioria das tarefas. |
| Matriz de alinhamento | A imagem bonita | Pesos de attention como grade `(T_dec, T_enc)`. Leia pra ver onde o modelo atentou. |

## Leitura Complementar

- [Bahdanau, Cho, Bengio (2014). Neural Machine Translation by Jointly Learning to Align and Translate](https://arxiv.org/abs/1409.0473) — o paper.
- [Luong, Pham, Manning (2015). Effective Approaches to Attention-based Neural Machine Translation](https://arxiv.org/abs/1508.04025) — as três variantes de score e sua comparação.
- [Jain and Wallace (2019). Attention is not Explanation](https://arxiv.org/abs/1902.10186) — o aviso de interpretabilidade.
- [Dive into Deep Learning — Bahdanau Attention](https://d2l.ai/chapter_attention-mechanisms-and-transformers/bahdanau-attention.html) — walkthrough executável com PyTorch.
