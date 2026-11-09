# GPT  Modélisation du langage de causalité

> Le masque triangulaire est la ligne de code la plus importante de l'IA moderne.

**Type:** Build
**Languages:** Python, Rust
**Prerequisites:** Phase 7 · 02 (Self-Attention), Phase 7 · 05 (Full Transformer), Phase 7 · 06 (BERT)
**Time:** ~75 minutes

## Le problème

Un modèle de langage répond à une question: étant donné la première `t-1`Les jetons, quelle est la répartition de probabilité sur les jetons `t`Trainer sur ce signal  prédiction de jeton suivant  et vous obtenez un modèle qui peut générer du texte arbitraire un jeton à la fois.

Pour l'entraîner de bout en bout sur une séquence entière en parallèle, vous devez que la prédiction de chaque position ne dépend que des positions précédentes.

Le masque causale fait ceci.`-inf`Les valeurs ajoutées aux points d'attention avant softmax. Après softmax, ces positions deviennent 0. Chaque position peut se concentrer uniquement sur elle-même et les positions précédentes. Et parce que vous l'appliquez une fois à toute la séquence, vous obtenez N parallèles de prochaine jetons prédictions dans un passage en avant.

GPT-1 (2018), GPT-2 (2019), GPT-3 (2020), GPT-4 (2023), GPT-5 (2025), Claude, Llama, Qwen, Mistral, DeepSeek, Kimi  ce sont tous des transformateurs causaux décodeurs uniquement avec la même boucle de base. Ce qui les sépare, ce sont la qualité des données, l'échelle et les raffinements architecturaux, et la post-formation (SFT, RLHF, DPO, et leurs successeurs).

## Le concept

![Causal mask creates a triangular attention matrix](../assets/causal-attention.svg)

### Le masque

Compte tenu d' une séquence de longueur $N$, construire une$N \times N$matrice:

```math
M_{ij} = \begin{cases} 0 & \text{if } j \le i \\ -\infty & \text{if } j > i \end{cases}
```

Ajouter `M`à la note d'attention avant softmax. $\exp(-\infty) = 0$Chaque rangée de la matrice d'attention est une répartition de probabilité sur les positions précédentes seulement.

Coût de mise en œuvre: 1 `torch.tril()`Le temps de calcul: nanosecondes, impact sur le terrain, tout.

### D'où vient le triangle

Le masque est généralement présenté comme un patch boulonné sur l'attention.

**Stage 1 — prefix average.**Le résumé de la suite de causes la plus stupide: position$i$devient la moyenne des positions $0 \ldots i$En tant que boucle, c'est`out[i] = X[:i+1].mean(0)`Le même calcul est une matrice multipliée. Prenez une matrice triangulaire inférieure de un, divisez chaque rangée par son nombre, multipliez:

```python
import numpy as np

A = np.tril(np.ones((n, n)))
A = A / A.sum(axis=1, keepdims=True)
out = A @ X
```

Régime $i$de $A$est $[1/(i+1), \ldots, 1/(i+1), 0, \ldots, 0]$Les zéros au-dessus de la diagonale sont la causalité. Rien sur le futur n'a été masqué; le futur n'a jamais été dans la somme.

**Stage 2 — learned weights.**Une moyenne uniforme traite chaque jeton passé comme étant également pertinent.`S`. Maintenant, les lignes ne sont plus de la somme à un par construction, donc normaliser chaque ligne avec softmax au lieu de la division par le comptage. Softmax ne produit jamais un zéro exact, ce qui rompt la causalité  à moins que les scores futurs entrent comme `-inf`, parce que `exp(-inf) = 0`- Le numéro de la liste:

```python
def softmax(x, axis):
    e = np.exp(x - np.max(x, axis=axis, keepdims=True))
    return e / e.sum(axis=axis, keepdims=True)

S = S + np.triu(np.full((n, n), -np.inf), k=1)
A = softmax(S, axis=1)
out = A @ X
```

Le même triangle, la même matrice de rangée stochastique, le même matmul.`-inf`Le masque n'est pas une nouvelle machine, c'est une entrée zéro de l'étape 1, traduite dans le domaine d'entrée de softmax.

**Stage 3 — content-dependent weights.**Dans la phase 2, `S`La position 7 pèse toujours la position 3 de la même façon, peu importe ce que disent les jetons.`S = Q @ K.T / sqrt(d_k)`Le masque, le softmax, le matmul sont identiques.

Trois étapes, une invariante: une matrice de rangée-stochastique triangulaire inférieure multipliée par la séquence. moyenne uniforme, poids statiques apprises, poids dépendant du contenu. Le masque n'a jamais été ajouté à l'attention.

```figure
mask-derivation
```

### Formation parallèle, inférence en série

Formation: faire avancer l'ensemble `(N, d_model)`une fois la séquence, calculer N pertes d'entropie croisée (une par position), somme, backprop. Parallèlement le long de la séquence. C'est pourquoi les échelles de formation GPT  vous traitez 1M jetons dans un lot dans un seul GPU passer.

Inference: vous générez des jetons par jetons.`[t1, t2, t3]`Je suis là .`t4`- La nourriture .`[t1, t2, t3, t4]`Je suis là .`t5`- La nourriture .`[t1, t2, t3, t4, t5]`Je suis là .`t6`Le cache KV (leçon 12) sauve les états cachés de `t1…tn`Donc, vous ne les recomptez pas à chaque étape. Mais la profondeur sérielle à l'inférence = longueur de sortie. C'est la taxe autorégressive et pourquoi le décoding est le goulot d'étranglement de latence de chaque LLM.

### La perte  changement par changement

Les jetons donnés `[t1, t2, t3, t4]`- Le numéro de la liste:

- Enregistrement: `[t1, t2, t3]`
- Objectifs: `[t2, t3, t4]`

Pour chaque poste .`i`, calcul`-log P(target_i | inputs[:i+1])`C'est la croisée de l'entropie de toute la séquence.

Tous les transformateurs LM que vous avez entendus trainer sur cette perte.

### Stratégies de décoding

Après l'entraînement, les choix d'échantillonnage comptent plus que les gens ne le pensent.

| Method | What it does | When to use |
|--------|--------------|-------------|
| Greedy | Argmax every step | Deterministic tasks, code completion |
| Temperature | Divide logits by T, sample | Creative tasks, higher T = more diversity |
| Top-k | Sample from top-k tokens only | Kills low-probability tails |
| Top-p (nucleus) | Sample from smallest set with cumulative prob ≥ p | 2020+ default; adapts to distribution shape |
| Min-p | Keep tokens with `p > min_p * max_p` | 2024+; better at rejecting long tails than top-p |
| Speculative decoding | Draft model proposes N tokens, big model verifies | 2–3× latency reduction at same quality |

En 2026, min-p + température 0,7 est une valeur par défaut raisonnable pour les modèles à poids ouvert.

### Qu'est- ce qui a permis au " recette de la GPT " de fonctionner

1. **Decoder-only.**Pas de coefficient d'encodage, une attention par couche.
2. **Scaling.**124M → 1.5B → 175B → trillions. Les lois de l'échelle de Chinchilla (leçon 13) vous disent comment dépenser l'informatique.
3. **In-context learning.**Il est apparu vers 6B13B. Le modèle peut suivre quelques exemples sans ajustement.
4. **RLHF.**Une formation post-traînement sur les préférences humaines a transformé le texte brut prétrainé en assistants de chat.
5. **Pre-norm + RoPE + SwiGLU.**Une formation stable à l'échelle.

L'architecture de base n'a pas beaucoup changé depuis GPT-2. Tout ce qui est intéressant s'est passé dans les données, l'échelle et la formation post-training.

```figure
causal-mask
```

## Faites-le

### Étape 1: le masque de causalité

Regardez !`code/main.py`Une ligne unique:

```python
def causal_mask(n):
    return [[0.0 if j <= i else float("-inf") for j in range(n)] for i in range(n)]
```

Ajoutez-le aux notes d'attention avant le softmax.

### Étape 2: un modèle GPT à deux couches

Améliorez deux blocs de décodeur (auto-attention masquée + FFN, aucune attention croisée). Ajoutez un embed token, un codage positional et un un déembedding (attaché à la matrice d'embedding token  un truc standard depuis GPT-2).

### Étape 3: Prédiction du prochain jeton, de bout en bout

Sur un vocabulaire de jouets à 20 jetons, produisez des logites à chaque position. Comptez la perte d'entropie croisée contre la cible de décalage par un. Pas de gradient  c'est un contrôle de santé mentale avant-pass.

### Étape 4: prélèvement d'échantillons

Implémenter l'avidité, la température, le top-k, le top-p, le min-p. Exécuter chacun sur une demande fixe et comparer les sorties.

## Utilisez-le

PyTorch, 2026 - Je suis un homme.

```python
from transformers import AutoModelForCausalLM, AutoTokenizer
model = AutoModelForCausalLM.from_pretrained("meta-llama/Llama-3.2-3B-Instruct")
tok = AutoTokenizer.from_pretrained("meta-llama/Llama-3.2-3B-Instruct")

prompt = "Attention is all you need because"
inputs = tok(prompt, return_tensors="pt")
out = model.generate(
    **inputs,
    max_new_tokens=64,
    temperature=0.7,
    top_p=0.9,
    do_sample=True,
)
print(tok.decode(out[0]))
```

Sous le capot,`generate()`Il effectue le passage vers l'avant, tire les logits de position finale, échantillonne le jeton suivant, l'apporte et le répète.

**GPT vs BERT, one line each:**Les prédictions du GPT $P(x_t \mid x_{<t})$- BERT prédit .$P(x_{\text{masked}} \mid x_{\text{unmasked}})$La perte détermine si le modèle peut générer.

## La faire partir

Regardez !`outputs/skill-sampling-tuner.md`. La compétence choisit les paramètres d'échantillonnage pour une tâche de nouvelle génération et désigne les décodage déterministique requis.

## Exercices

1. **Easy.**On court .`code/main.py`et vérifier que la matrice d'attention causale est triangulaire inférieure après softmax.
2. **Medium.**Comparez la perplexité de la poutre 4 contre la cupidité sur 10 courtes instructions. La poutre gagne-t-elle toujours ? (conseil: généralement pour la traduction, pas pour le chat ouvert).
3. **Hard.**Implémenter le décoding spéculatif: utiliser un modèle minuscule de 2 couches comme projet et un modèle de 6 couches comme vérificateur. Mesurer l'accélération de l'horloge murale sur 100 compléments de longueur 64.

## Les termes clés

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| Causal mask | "The triangle" | Upper-triangular `-inf` matrix added to attention scores so position `i` only sees positions `≤ i`. |
| Next-token prediction | "The loss" | Cross-entropy of the model's distribution against the true next token at every position. |
| Autoregressive | "Generate one at a time" | Feed output back as input; parallelism only during training, not during generation. |
| Logits | "Pre-softmax scores" | Raw output of the LM head before softmax; sampling happens on these. |
| Temperature | "Creativity knob" | Divide logits by $T$; $T \to 0$ = greedy, $T \to \infty$ = uniform. |
| Top-p | "Nucleus sampling" | Truncate distribution to smallest set summing to $\ge p$; sample from what remains. |
| Min-p | "Better than top-p" | Keep tokens where `p ≥ min_p × max_p`; adapts cutoff to sharpness of distribution. |
| Speculative decoding | "Draft + verify" | Cheap model proposes N tokens; big model verifies in parallel. |
| Teacher forcing | "Training trick" | During training, feed the true previous token, not the model's prediction. Standard for every seq2seq LM. |

## Pour en savoir plus

- [Radford et al. (2018). Improving Language Understanding by Generative Pre-Training](https://cdn.openai.com/research-covers/language-unsupervised/language_understanding_paper.pdf) GPT-1.
- [Radford et al. (2019). Language Models are Unsupervised Multitask Learners](https://cdn.openai.com/better-language-models/language_models_are_unsupervised_multitask_learners.pdf) GPT-2.
- [Brown et al. (2020). Language Models are Few-Shot Learners](https://arxiv.org/abs/2005.14165) GPT-3 et apprentissage dans le contexte.
- [Leviathan, Kalman, Matias (2023). Fast Inference from Transformers via Speculative Decoding](https://arxiv.org/abs/2211.17192) papier de décoding spécifique.
- [HuggingFace `modeling_llama.py`](https://github.com/huggingface/transformers/blob/main/src/transformers/models/llama/modeling_llama.py) code de référence canonique de la cause à la cause.
