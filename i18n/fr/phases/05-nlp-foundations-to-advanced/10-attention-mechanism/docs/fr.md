# Mécanisme d'attention  Révélation

> Le décodeur arrête de cligner des yeux sur un résumé comprimé et commence à regarder l'ensemble de la source.

**Type:** Build
**Languages:** Python, TypeScript
**Prerequisites:** Phase 5 · 09 (Sequence-to-Sequence Models)
**Time:** ~45 minutes

## Le problème

La leçon 09 se termine par une défaillance mesurée. Un encodeur-décodeur GRU entraîné sur une tâche de copie de jouet passe de 89% de précision à longueur 5 à près de chance à longueur 80. La raison est structurelle, pas un bug d'entraînement: chaque bit d'information recueilli par l'encodeur doit s'intégrer dans un état caché de taille fixe, et le décodeur ne voit jamais autre chose.

Bahdanau, Cho et Bengio ont publié une correction en trois lignes en 2014. Au lieu de donner au décodeur seulement l'état final de l'encodeur, gardez chaque état de l'encodeur. À chaque étape du décodeur, calculez une moyenne pondérée des états de l'encodeur où les poids disent "combien le décodeur a besoin de regarder la position de l'encodeur `i`Cette moyenne pondérée est le contexte, et elle change chaque étape du décodeur.

C'est l'idée. Les transformateurs l'ont étendue. L'attention personnelle l'a appliquée à une seule séquence. L'attention multi-têtes l'a couru en parallèle. Mais la version 2014 a déjà brisé le gouffre, et une fois que vous l'avez, le pivot des transformateurs est l'ingénierie, pas conceptuelle.

## Le concept

![Bahdanau attention: decoder queries all encoder states](../assets/attention.svg)

À chaque étape du décodeur `t`- Le numéro de la liste:

1. Utilisez l' état caché du décodeur précédent `s_{t-1}`comme une **query**- Je suis désolé .
2. Réservez-le à chaque état caché du codeur .`h_1, ..., h_T`Un scalaire par position d'encodeur.
3. Softenmax les scores pour obtenir des poids d' attention `α_{t,1}, ..., α_{t,T}`Cette somme est de 1.
4. Vecteur de contexte `c_t = Σ α_{t,i} * h_i`- moyenne pondérée des états de l'encodeur.
5. Le décodeur prend `c_t`plus le jeton de sortie précédent, produit le jeton suivant.

La moyenne pondérée est le point. Lorsque le décodeur doit traduire "Je" en "I", il pèse l'état de l'encodeur sur "Je" élevé et les autres bas. Quand il a besoin de "non", il pèse "pas" élevé. Le vecteur de contexte remodèle chaque étape.

## Les formes (ce qui mord tout le monde)

C'est là que chaque mise en œuvre de l'attention va mal la première fois.

| Thing | Shape | Notes |
|-------|-------|-------|
| Encoder hidden states `H` | `(T_enc, d_h)` | If BiLSTM, `d_h = 2 * d_hidden` |
| Decoder hidden state `s_{t-1}` | `(d_s,)` | One vector |
| Attention score `e_{t,i}` | scalar | One per encoder position |
| Attention weight `α_{t,i}` | scalar | After softmax over all `i` |
| Context vector `c_t` | `(d_h,)` | Same shape as an encoder state |

**Bahdanau (additive) score.** `e_{t,i} = v_α^T * tanh(W_a * s_{t-1} + U_a * h_i)`- Je suis désolé .

- `s_{t-1}`a une forme`(d_s,)`- Je suis là .`h_i`a une forme`(d_h,)`- Je suis désolé .
- `W_a`a une forme`(d_attn, d_s)`- Je suis là .`U_a`a une forme`(d_attn, d_h)`- Je suis désolé .
- Leur somme à l'intérieur du tanh a une forme .`(d_attn,)`- Je suis désolé .
- `v_α`a une forme`(d_attn,)`- Le produit intérieur avec`v_α`Il s'effondre à un escalier.**This is what `v_α` does.**Ce n'est pas de la magie, c'est la projection qui transforme un vecteur attentif en un score scalaire.

**Luong (multiplicative) score.**Trois variantes:

- `dot`Le numéro de la liste:`e_{t,i} = s_t^T * h_i`- Il faut .`d_s == d_h`- Passer si votre encodeur est bidirectionnel.
- `general`Le numéro de la liste:`e_{t,i} = s_t^T * W * h_i`avec `W`forme `(d_s, d_h)`- Il supprime la contrainte de l'égalité de la teinte.
- `concat`Le format Bahdanau est essentiellement le même.

**One Bahdanau / Luong gotcha worth naming.**Bahdanau utilise `s_{t-1}`(l'état du décodeur * avant * de générer le mot courant).`s_t`Le mélange produit des gradients subtilement erronés qui sont extrêmement difficiles à débogager.

```figure
attention-heatmap
```

## Faites-le

### Étape 1: attention additive (Bahdanau)

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

Vérifiez vos formes contre la table ci-dessus. `encoder_states`a une forme`(T_enc, d_h)`- Je suis là .`projected_enc`a une forme`(T_enc, d_attn)`- Je suis là .`projected_dec`a une forme`(d_attn,)`et les émissions. `combined`a une forme`(T_enc, d_attn)`- Je suis là .`scores`a une forme`(T_enc,)`- Je suis là .`weights`a une forme`(T_enc,)`- Je suis là .`context`a une forme`(d_h,)`- Envoyez-le.

### Étape 2: Luong point et général

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

C'est pour ça que le papier de Luong est arrivé, avec la même précision sur la plupart des tâches, beaucoup moins de code.

### Étape 3: exemple numérique travaillé

Compte tenu de trois états de décodeur (en gros "cat", "sat", "mat") et d'un état de décodeur qui s'aligne le plus avec le premier, la distribution de l'attention se concentre sur la position 0. Si l'état de décodeur se déplace pour s'aligner avec le dernier, l'attention passe à la position 2.

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

La première ligne gagne, puis déplacer l'état du décodeur plus près de l'état du troisième encodeur et regarder le changement de poids.

### Étape 4: pourquoi c'est le pont vers les transformateurs

Translatez la langue ci-dessus en Q/K/V:

- **Query**= état du décodeur `s_{t-1}`
- **Key**= états d'encodeur (ce que nous marquons contre)
- **Value**= états d'encodeur (ce que nous pesons et somme)

Dans l'attention classique, les clés et les valeurs sont la même chose. L'attention personnelle les sépare: vous pouvez interroger une séquence contre elle-même, avec différentes projections apprises pour K et V. L'attention multi-tête le gère en parallèle avec différentes projections apprises. Les transformateurs empilent l'ensemble de la scène plusieurs fois et laissent tomber les RNN.

Les mathématiques sont les mêmes, les formes sont les mêmes, le saut pédagogique de l'attention Bahdanau à l'attention produit à l'échelle est principalement la notation.

## Utilisez-le

PyTorch et TensorFlow envoient directement l'attention.

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

C'est une couche d'attention transformateur.`output`est la nouvelle requête augmentée par le contexte. `weights`est la matrice d'alignement 5x10 que vous pouvez visualiser.

### Quand l'attention classique est encore importante

- La version à tête unique, à couche unique, basée sur le RNN rend chaque concept visible.
- Les tâches de séquence sur l'appareil où les transformateurs ne s'adaptent pas.
- Tout article de 2014-2017, vous le lirez mal sans connaître la convention de Bahdanau.
- Analyse de l'alignement finement graineuse en MT. Les poids d'attention bruts sont un outil d'interprétation même sur les modèles transformateurs, et leur lecture exige de savoir ce qu'ils sont.

### Le piège de l'attention-poids-comme-explication

Les poids de l'attention semblent interprétables. Ce sont des poids qui s'additionnent à un sur plusieurs positions; vous pouvez les tracer; haut signifie " regardé sur cela. " Les critiques les adorent.

Ils ne sont pas aussi interprétables qu'ils semblent. Jain et Wallace (2019) ont montré que les distributions d'attention peuvent être permutées et remplacées par des alternatives arbitraires sans changer les prédictions de modèle pour certaines tâches.

## La faire partir

- Je ne sais pas .`outputs/prompt-attention-shapes.md`- Le numéro de la liste:

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

## Exercices

1. **Easy.**Mise en œuvre `softmax`masquer afin que les jetons de rembourrage dans l'encodeur obtiennent un poids d'attention zéro.
2. **Medium.**Ajoutez une attention à la Luong `general`- La forme.`d_h`dans `n_heads`Vérifiez que le cas unique correspond à votre mise en œuvre antérieure.
3. **Hard.**Prenez une formation GRU encodeur-décodeur avec Bahdanau attention sur la tâche de copie de jouet de la leçon 09. précision de la trace par rapport à la longueur de la séquence. Comparer avec la ligne de base de non-attention. Vous devriez voir l'écart s'élargir à mesure que la longueur augmente, confirmant attention soulève le goulet d'étranglement.

## Les termes clés

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| Attention | Looking at things | Weighted average of a value sequence, weights computed from a query-key similarity. |
| Query, Key, Value | QKV | Three projections: Q asks, K is what to match, V is what to return. |
| Additive attention | Bahdanau | Feed-forward score: `v^T tanh(W q + U k)`. |
| Multiplicative attention | Luong dot / general | Score is `q^T k` or `q^T W k`. Cheaper, same accuracy on most tasks. |
| Alignment matrix | The pretty picture | Attention weights as a `(T_dec, T_enc)` grid. Read it to see what the model attended to. |

## Pour en savoir plus

- [Bahdanau, Cho, Bengio (2014). Neural Machine Translation by Jointly Learning to Align and Translate](https://arxiv.org/abs/1409.0473)- Le journal.
- [Luong, Pham, Manning (2015). Effective Approaches to Attention-based Neural Machine Translation](https://arxiv.org/abs/1508.04025) les trois variantes de score et leur comparaison.
- [Jain and Wallace (2019). Attention is not Explanation](https://arxiv.org/abs/1902.10186) la précaution en matière d'interprétation.
- [Dive into Deep Learning — Bahdanau Attention](https://d2l.ai/chapter_attention-mechanisms-and-transformers/bahdanau-attention.html) La marche à pied avec PyTorch.
