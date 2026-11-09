# Flamingo et porte croisée pour VLM peu tirés

> Le Flamingo de DeepMind (2022) a fait deux choses avant quiconque. Il a montré qu'un seul modèle pouvait traiter des séquences d'images, de vidéos et de texte interdites arbitrairement. Et il a montré que les VLM pouvaient apprendre dans le contexte  donner quelques instants avec trois paires d'exemples (image, sous-titre) et le modèle sous-titre une nouvelle image sans aucune étape de gradient. Le mécanisme: couches de l'attention croisée fermées, insérées entre les couches existantes du LLM gelé, avec une porte de tanh apprise qui commence à zéro afin que la capacité de texte du LLM soit préservée lors de l'initialisation. Cette leçon traverse le ressampleur Percepteur de Flamingo et l'architecture de l'attention croisée fermée, l'ancêtre des entrées interlevées de Gémeaux et des jetons visuels d'Idefics2.

**Type:** Learn
**Languages:** Python, TypeScript (stdlib, gated cross-attention + Perceiver resampler demo)
**Prerequisites:** Phase 12 · 03 (BLIP-2 Q-Former)
**Time:** ~120 minutes

## Objectifs d'apprentissage

- Expliquez comment l'attention croisée fermée préserve la capacité de texte d'un LLM gelé à l'initialisation via tanh(gate) = 0.
- Passez par un ressampleur Percepteur: N patchs d'image → K fixé "latent" requêtes via l'attention croisée.
- Décrivez comment Flamingo traite les séquences d'images-texte interligées avec un masquage causal qui respecte le placement de l'image.
- Reproduire une structure de prompt multimodal de quelques coups (3 exemples de sous-titres d'image puis une image de requête).

## Le problème

BLIP-2 alimente 32 jetons visuels dans la couche d'entrée d'un LLM gelé. Fonctionne pour une image par prompt. Mais que faire si vous voulez alimenter * beaucoup * d'images entrelacées avec du texte, comme dans " ici est l'image A, sous-titre; ici est l'image B, sous-titre; maintenant ici est l'image C, sous-titre " ? L'auto-attention du LLM devrait gérer les jetons d'image et les jetons de texte dans un seul flux, et la question de savoir quelles positions peuvent être occupées par quelles images devient agitée.

La réponse de Flamingo: ne modifiez pas du tout le flux d'entrée du LLM. Insérer des couches de croisement supplémentaires entre les blocs de LLM existants. Les jetons de texte circulent toujours à travers l'auto-attention de la LLM comme toujours. Entre quelques blocs de LLM, les jetons de texte interagissent également avec les caractéristiques de l'image via une nouvelle couche fermée. La porte (initialisée à zéro) signifie que à l'étape zéro les nouvelles couches sont sans opérations  le modèle se comporte exactement comme le LLM prétrainé. Au fur et à mesure que l'entraînement progresse, la porte s'ouvre et les informations visuelles commencent à circuler.

La deuxième question a été posée par Flamingo: comment gérer un nombre variable d'images (0, 1 ou plusieurs) par requête ? Un rééchantillonneur Percepteur  un petit module d'attention croisée qui prend le nombre de patchs que vous avez et produit un nombre fixe de jetons visuels latents par image. Le total augmente avec le nombre d'images, mais chaque jeton texte ne lit que les latences d'une seule image, donc ce que tout jeton texte voit en croisée d'attention a la même forme indépendamment du nombre d'images dans le prompt.

## Le concept

### Le LLM congelé

Flamingo commence par un LLM de Chinchilla 70B gelé. Tous les poids 70B intacts.

### Remplacement de l'échantillon de percepteur

Pour chaque image dans le prompt, le ViT produit $N$Le rééchantillon du percepteur a$K$Les données de formation sont à l'origine de données de formation.$K=64$) Chaque bloc de repérage est constitué de deux sous-étapes:

1. Attention croisée: le $K$Les latents assistent à la$N$les jetons de patch (Q à partir de latences, K/V à partir de patches).
2. Autotentification + FFN dans les latences.

Après 6 blocs de repérage, la sortie est $K=64$Les images de la vitesse de vie de l'image de l'image de l'image de l'image de l'image de l'image de l'image de l'image de l'image de l'image de l'image de l'image de l'image de l'image de l'image de l'image de l'image de l'image de l'image de l'image de l'image de l'image de l'image de l'image de l'image de l'image de l'image de l'image de l'image de l'image de l'image de l'image de l'image de l'image de l'image de l'image de l'image de l'image de l'image de l'image de l'image de l'image de l'image de l'image de l'image de l'image de l'image de l'image de l'image de l'image de l'image de l'image de l'image de l'image de la vitesse de l'image de l'image de la vitesse de l'image de l'image de la vitesse de l'image de la vitesse de l'image de l'image de la vitesse de l'image de la vitesse de l'image de l'image de la vitesse de l'image de la vitesse de l'image de la vitesse de l'image de la vitesse de l'image de la vitesse de l'image de la vitesse de l'image de la vitesse de l'image de la vitesse de l'image de la vitesse de la vit de l'image de la vitesse de l'image de la vitesse de la vitesse de l'image de la vitesse de l'image de la vit de la vitesse de la vit de la vit de la vitesse de la vit de la vitesse de l'image de la vit de l'image de la vitesse de la vit de la vitesse de la vitesse de la vitesse de la vitesse de la vitesse de la vitesse de la vitesse de la vit à la vit.

Pour la vidéo, le resampler est appliqué temporairement: les patchs de chaque cadre produisent 64 latences, et un codage positionnel temporel permet au modèle de distinguer $t=0$de $t=N$La vidéo complète devient$T \cdot 64$des jetons visuels.

### Attention croisée par voie ferrée

Entre chaque$M$Les couches de la MLL gelée (utilisées par Flamingo $M=4$), insérer un nouveau bloc de l'attention croisée fermé:

```
x_after_llm_block = llm_block(x_before)
cross = cross_attn(x_after, resampler_output)
gated = tanh(alpha) * cross + x_after
x_before_next_block = gated
```

- `alpha`est un scalaire apprenable initialisé à zéro.
- `tanh(0) = 0`, donc à init la branche fermée contribue à zéro.
- Comme `alpha`Si la valeur de l'attention croisée s'éloigne de zéro, elle augmente de façon fluide.
- La connexion résiduelle signifie que même une porte entièrement ouverte ne surécrit pas la représentation du texte du LLM; elle ajoute simplement des informations visuelles en haut.

C'est le choix de conception le plus important dans Flamingo: le conditionnement visuel est additif, fermé et zéro à l'initialisation.

### Attention croisée masquée pour les entrées interdites

Dans un prompt comme "<image A> caption A <image B> caption B <image C> ?", chaque jeton de texte ne doit voir que des images qui lui ont précédé dans la séquence.`t`ne prend en charge que les jetons de repérage d' image `i_t`Où ?`i_t`est l' image la plus récente avant la position `t`Les "Vie seulement la dernière image précédente" ou "Vie toutes les images précédentes" sont tous deux des choix valides; Flamingo a choisi la première.

### Apprendre en quelques coups dans le contexte

Une requête Flamingo ressemble à:

```
<image1> A photo of a cat. <image2> A photo of a dog. <image3> A photo of a
```

Le modèle voit le schéma de finition et produit "oiseau" (ou ce que l'image3 montre). Aucune étape de gradient. La capacité d'apprentissage dans le contexte du LLM gelée traverse l'attention croisée fermée.

### Données de formation

Flamingo a été formé sur trois ensembles de données:

1. MultiModal MassiveWeb (M3W): 43 millions de pages Web avec des images et du texte interligés, reconstruisant l'ordre de lecture.
2. Pares image-texte: ALIGN (1,8B pares) plus LTIP (312M pares), soit environ 2,1B pares au total.
3. Parts vidéo-texte (VTP): 27 millions de courts clips vidéo.

OBELICS (2023) est une reproduction ouverte du corpus web interlevé, sur lequel Idefics, Idefics2 et la plupart des modèles "flamingo-like" ouverts s'entraînent.

### OpenFlamingo et la lentille

OpenFlamingo (2023) est la reproduction ouverte. L'architecture est identique (reprimateur de percepteur + attention croisée fermée sur LLaMA congelé ou MPT).

Otter (2023) s'appuie sur OpenFlamingo avec l'ajustement des instructions sur MIMIC-IT (un ensemble de données d'instructions multimodal), montrant des fonctions d'attention croisée fermée pour les instructions suivantes également.

### Les descendants

- Idefics / Idefics2 / Idefics3: La lignée de l'attention croisée fermée de Hugging Face, progressivement plus simple (Idefics2 a abandonné le resampler en faveur des jetons de patch directs avec pooling adaptatif).
- Transition Flamingo-Chameleon: d'ici 2024, de nombreuses équipes ont déménagé vers la fusion précoce (Lésion 12.11); l'attention croisée fermée de style Flamingo reste en production où le gel de la colonne vertébrale est nécessaire.
- L'entrée interlevé de Gémeaux: conceptuellement hérite de la flexibilité de format interlevé de Flamingo, bien que le mécanisme exact soit propriétaire.

### Comparé à BLIP-2

| | BLIP-2 | Flamingo |
|---|---|---|
| Visual bridge | Q-Former once at input | Gated cross-attention at every M layers |
| Visual tokens | 32 per image | 64 per image per cross-attn layer |
| Frozen LLM | Yes | Yes |
| Few-shot in-context | Weak | Strong — the paper's centerpiece |
| Interleaved inputs | No native support | Yes, the design target |
| Training data | 130M pairs | ~2.1B pairs + 27M video clips + 43M interleaved pages |
| Parameter count | 188M trained | ~10B trained (cross-attn layers) |
| Compute | Days on 8 A100s | Weeks on thousands of TPUv4 |

Choisissez BLIP-2 pour une image unique VQA sur un budget. Choisissez Flamingo/Idefics2 pour un raisonnement interligé, peu de coups ou multi-image.

```figure
cross-attention-fusion
```

## Utilisez-le

`code/main.py`démontre:

1. Un échantillon de réception sur 36 faux patch tokens avec 8 latences appréciables (attention croisée pure Python).
2. Un pas de l' attention croisée fermée avec `alpha = 0`→ sortie égale à l'entrée (LLM inchangé), alors `alpha = 2.0`→ contribution visuelle mélangée.
3. Un constructeur de masques interleavés qui produit le masque d'attention 2D pour une séquence "(image 1) (texte 1) (image 2) (texte 2)".

## La faire partir

Cette leçon produit `outputs/skill-gated-bridge-diagnostic.md`. Compte tenu de la configuration d'un VLM ouvert (sampler Y/N, fréquence de fréquence croisée, schéma de passerelle), il identifie les éléments de lignée Flamingo et explique la stratégie de congélation. Utilisée pour déboguer les raisons pour lesquelles une mise en forme fine dégrade les performances du texte (réponse: la passerelle s'est largement trop rapidement élargie).

## Exercices

1. Comptez le nombre de paramètres visuels du Flamingo-9B: 9B LLM + 1,4B couches de l'attention croisée fermées + 64M resampler. Quelle fraction des paramètres totaux est formée?

2. Implémenter le résidu clos `y = tanh(alpha) * cross + x`Dans PyTorch, montre expérimentalement que avec`alpha=0`- Je suis là .`y==x`Exactement à l'initi.

3. Lisez la section 3.2 d'OpenFlamingo (arXiv:2308.01390) sur la façon dont ils gèrent plusieurs images dans un lot lorsque chaque prompt a un nombre d'images différent.

4. Pourquoi le masque d'attention croisée de Flamingo permet-il à un jeton texte de ne s'attacher qu'à * la plus récente* image précédente plutôt que à toutes les images précédentes ?

5. Dans le contexte, quelques coups: construisez un prompt avec 4 exemples de "image → couleur de l'objet principal" pour une nouvelle variante Flamingo.

## Les termes clés

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| Perceiver resampler | "Fixed-latent cross-attention" | Module that produces K fixed tokens from a variable number of input patches |
| Gated cross-attention | "Tanh-gated bridge" | Residual layer `y = tanh(alpha)*cross + x`, learnable alpha, init 0 |
| Interleaved input | "Mixed sequence" | Prompt format with images and text mixed freely in reading order |
| Frozen LLM | "No LLM gradients" | The text LLM's weights do not update; only resampler + cross-attn layers train |
| Few-shot | "In-context examples" | Give a few (image, answer) pairs in the prompt; model generalizes without finetuning |
| OBELICS | "Interleaved web corpus" | Open dataset of 141M web pages with images and text in reading order |
| Chinchilla | "70B frozen base" | Flamingo's frozen text LLM, from DeepMind's Chinchilla paper |
| Gate schedule | "How alpha moves" | The rate at which the cross-attention gate opens during training |
| Cross-attn frequency | "Every M layers" | How often a gated cross-attention block is inserted; Flamingo uses $M=4$ |
| OpenFlamingo | "Open reproduction" | MosaicML/LAION open checkpoint at 3-9B; architecture-identical to Flamingo |

## Pour en savoir plus

- [Alayrac et al. — Flamingo (arXiv:2204.14198)](https://arxiv.org/abs/2204.14198) le papier original.
- [Awadalla et al. — OpenFlamingo (arXiv:2308.01390)](https://arxiv.org/abs/2308.01390) reproduction ouverte.
- [Laurençon et al. — OBELICS (arXiv:2306.16527)](https://arxiv.org/abs/2306.16527) corps de toile entrelacée.
- [Jaegle et al. — Perceiver IO (arXiv:2107.14795)](https://arxiv.org/abs/2107.14795) l'architecture générale du percepteur.
- [Li et al. — Otter (arXiv:2305.03726)](https://arxiv.org/abs/2305.03726)Des descendants de Flamingo réglés par des instructions.
- [Laurençon et al. — Idefics2 (arXiv:2405.02246)](https://arxiv.org/abs/2405.02246) modernisation de l'approche flamingo.
