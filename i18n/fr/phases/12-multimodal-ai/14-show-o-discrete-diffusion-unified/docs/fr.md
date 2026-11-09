# Modèles unifiés de diffusion discrète et de démonstration

> La transfusion mélange des représentations continues et discrètes. Show-o (Xie et coll., août 2024) va dans l'autre sens: les jetons texte utilisent la prédiction de jetons suivants de causalité, les jetons d'image utilisent la diffusion discrète masquée dans l'esprit de MaskGIT. Ils sont tous deux assis à l'intérieur d'un transformateur avec un masque d'attention hybride. Le résultat unifie VQA, texte à image, en peinture et génération de modalités mixtes sur une colonne vertébrale, un tokenizer par modalité, une formulation de perte (next-token étendu à la prédiction masquée). Cette leçon traverse le design Show-o  pourquoi la diffusion discrète masquée est un générateur d'images parallèle, en quelques étapes  et contraste avec Transfusion et Emu3.

**Type:** Learn
**Languages:** Python, TypeScript (stdlib, masked-discrete-diffusion sampler)
**Prerequisites:** Phase 12 · 13 (Transfusion)
**Time:** ~120 minutes

## Objectifs d'apprentissage

- Expliquer la diffusion discrète masquée: le calendrier qui masque uniformément les jetons demande ensuite au transformateur de les récupérer.
- Comparer le décoding d'image parallèle (Show-o, MaskGIT) au décoding d'image autorégressif (Chameleon, Emu3) en termes de vitesse et de qualité.
- Nombre des quatre tâches que Show-o gère dans un seul point de contrôle: génération de texte, VQA, T2I, peinture d'images.
- Choisissez un calendrier de masquage (cosine, linéaire, tronqué) et raisonnez de son effet sur la qualité de l'échantillon.

## Le problème

La formation à deux pertes de transfusion fonctionne mais a une dynamique plus délicate. La perte de diffusion continue vit à une échelle numérique différente de la perte NTP discrète.

La réponse de Show-o: gardez les deux modalités discrètes (comme Chameleon), mais générez des images en parallèle via une diffusion discrète masquée au lieu de séquentiellement.

## Le concept

### Diffusion discrète masquée (MaskGIT)

Le truc original de Chang et al. (2022) MaskGIT est élégant. Commencez par une image entièrement masquée (chaque jeton est le spécial `<MASK>`à chaque étape, prédire tous les jetons masqués en parallèle, puis garder les prédictions les plus confiantes et re-masquer le reste. Après ~ 8 à 16 itérations, tous les jetons sont remplis. Le calendrier du nombre de jetons à démasquer par étape est réglé  les calendriers cosines fonctionnent bien.

La formation est simple: échantillonnage d'un ratio de masquage uniformément à partir de [0, 1], appliquer sur les jetons VQ de l'image, entraîner le transformateur à récupérer les jetons masqués.

### Show-o: un transformateur, masque hybride

Le show-o met MaskGIT à l'intérieur d'un transformateur de modèle de langage causale.

- Les jetons texte: causels (MLL standard).
- Tokens d'image: bidirectionnels complets dans le bloc d'image (les tokens masqués peuvent donc voir tous les autres tokens d'image pendant la prédiction).
- Text-to-image: le texte répond aux images précédentes, l'image répond au texte précédent.

Les stages de formation alternent entre:
1. NTP standard sur les séquences de texte.
2. T2I: texte → image avec des jetons d'image masqués, perte de prédiction de jetons masqués.
3. VQA: image → texte avec des jetons de texte masqués (en réalité seulement NTP).

La perte unifiée est l' entropie croisée sur `<MASK>`les jetons, qui couvrent à la fois le NTP texte (seul le dernier jeton est "masqué") et la diffusion masquée d'image (un sous-ensemble aléatoire est masqué).

### Prise d'échantillons parallèles

Show-o génère une image en ~16 étapes au lieu de ~1000 (autorégressif par jeton) ou ~20 (diffusion). À chaque étape, prédisez tous les jetons masqués en parallèle; commettez le top-K confident; répétez.

Comparer:
- Chameleon / Emu3 (autorégressif sur les jetons): N_tokens passes en avant, généralement 1024-4096 par image.
- Transfusion (diffusion continue): ~ 20 étapes, chaque étape est une transformer complète.
- Show-o (diffusion discrète masquée): ~16 étapes, chaque étape avec un transformateur complet.

Le show-o est plus rapide que le chamélion sur des modèles à l'échelle similaire, correspond à peu près au nombre d'étapes de transfusion avec un coût par étape inférieur (logits vocabulaires discrets par rapport à la perte continue de MSE).

### Les tâches effectuées à un seul point de contrôle

Show-o prend en charge quatre tâches à l'inférence, sélectionnées par format prompt:

- Génération de texte: sortie de texte autorégressif standard.
- VQA: image dans, message de sortie.
- T2I: texte dans, image hors via diffusion discrète masquée.
- Peinture: image avec des jetons masqués, remplissez.

La capacité d'inpeinture est gratuite grâce à la formation de prédiction masquée. Masquer une région de la grille de jetons VQ, alimenter le reste plus une requête de texte, prédire les jetons masqués.

### Calendrier de masquage

Le calendrier du nombre de jetons à démasquer par étape forme la qualité.

```math
\text{mask\_ratio}(t) = \cos\left(\frac{\pi t}{2T}\right) \qquad t = 0, \ldots, T
```

À l'étape 0, tous les jetons masqués (ratio 1.0).$T$Les calendriers linéaires fonctionnent aussi mais à un rythme plus rapide.

### Le spectacle

Show-o2 (2025 suivi, arXiv 2506.15564) échelles Show-o: plus grande base de LLM, meilleur tokenizer, meilleur calendrier de masque.

### Là où se trouve Show-o

Dans la taxonomie de 2026:

- Les jetons discrets + NTP: Chameleon, Emu3.
- Les jetons discrets + diffusion masquée: Show-o, MaskGIT, LlamaGen, Muse. Prise parallèle, encore perdue par le jetoniseur.
- Transfusion continue + diffusion: transfusion, MMDiT, DiT. Formation de la plus haute qualité et plus complexe.
- Parallèle continu + flux dans un VLM: JanusFlow, InternVL-U. Nouveau.

Choisir par tâche: Show-o lorsque vous voulez T2I + incarné + VQA dans un modèle ouvert avec une vitesse raisonnable; transfusion lorsque la qualité est primordiale et que vous pouvez vous permettre la plomberie à deux pertes.

```figure
masked-diffusion-unmask
```

## Utilisez-le

`code/main.py`simulation de l'échantillonnage à démonstration:

- Une grille de jouets de 16 jetons VQ.
- Un faux "transformateur" qui prédit les logits en fonction d'un prompt et des jetons actuellement démasqués.
- Prise d'échantillons masqués parallèles sur 8 étapes avec calendrier cossin.
- Imprime les états intermédiaires (évolution du modèle de masque) et les jetons finaux.

Faites-le, regardez le masque se dissoudre étape par étape.

## La faire partir

Cette leçon produit `outputs/skill-unified-gen-model-picker.md`. Étant donné qu'un produit nécessite à la fois une compréhension (VQA, sous-titres) et une génération (T2I, peinture) avec une contrainte de poids ouvert, choisissez entre la famille Show-o, la famille Transfusion/MMDiT et la famille Emu3/Chamélion avec des compromis concrets.

## Exercices

1. Des échantillons discrets de diffusion masqués en 16 étapes. Pourquoi pas 1? Qu'est-ce qui se brise si vous démasquez tout à l'étape 0?

2. La peinture est gratuite avec diffusion masquée. proposez un cas d'utilisation du produit (réel ou hypothétique) où la peinture de Show-o dépasse un modèle spécialisé.

3. Calendrier cosine vs calendrier linéaire: tracer le nombre de jetons non masqués par étape pour T=8.

4. Une image 512x512 est de 1024 jetons.$K=16384$, le modèle émet$1024 \cdot \log_2(16384) = 14{,}336$Les données de diffusion stable produisent 512*512*24 bits = 6 291 456 bits (~768 KiB) de pixels bruts. Quel est le ratio de compression et quelle qualité achète-t-il ?

5. Comment le modèle d'image autorégressive classal de LlamaGen diffère-t-il de l'approche masquée de Show-o ?

## Les termes clés

| Term | What people say | What it actually means |
|------|-----------------|------------------------|
| Masked discrete diffusion | "MaskGIT-style" | Training to predict masked tokens; at inference, iteratively unmask the most-confident predictions |
| Cosine schedule | "Unmask schedule" | Decay of mask ratio over inference steps; concentrates confidence growth at mid-range |
| Parallel decoding | "All tokens at once" | Every step predicts the full sequence of masked tokens in one forward pass, then commits top-K |
| Hybrid attention | "Causal + bidirectional" | Mask that is causal over text tokens and bidirectional within image blocks |
| Inpainting | "Fill-in generation" | Condition on an image with some tokens masked, predict the missing ones; free from the training objective |
| Commitment rate | "Top-K per step" | How many tokens are declared "done" per iteration; controls inference vs quality trade-off |

## Pour en savoir plus

- [Xie et al. — Show-o (arXiv:2408.12528)](https://arxiv.org/abs/2408.12528)
- [Show-o2 (arXiv:2506.15564)](https://arxiv.org/abs/2506.15564)
- [Chang et al. — MaskGIT (arXiv:2202.04200)](https://arxiv.org/abs/2202.04200)
- [Sun et al. — LlamaGen (arXiv:2406.06525)](https://arxiv.org/abs/2406.06525)
- [Chang et al. — Muse (arXiv:2301.00704)](https://arxiv.org/abs/2301.00704)
