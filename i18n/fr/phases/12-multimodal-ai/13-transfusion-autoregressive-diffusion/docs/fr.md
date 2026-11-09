# Transfusion: texte autorégressif + image de diffusion dans un transformateur

> Chameleon et Emu3 ont misé tout sur des jetons discrets. Ils fonctionnent, mais le goulot d'étranglement de quantification est visible  les plateaux de qualité d'image en dessous des modèles de diffusion de l'espace continu. La transfusion (Meta, Zhou et al., août 2024) prend le pari opposé: maintenir les images en continu, laisser tomber le VQ-VAE entièrement et entraîner un transformateur avec deux pertes. Les jetons texte prédisent le prochain jeton. Les patchs d'image obtiennent une perte de parallèle de flux / diffusion. Les deux objectifs optimisent les mêmes poids. L'architecture sous-jacente à Stable Diffusion 3 (MMDiT) est un cousin proche. Cette leçon lit la thèse Transfusion, construit un entraîneur de jouets à deux pertes et retrace le masque d'attention qui permet à un transformateur de faire les deux tâches.

**Type:** Build
**Languages:** Python, TypeScript (stdlib, two-loss trainer on MNIST-scale toy)
**Prerequisites:** Phase 12 · 11 (Chameleon), Phase 8 (Generative AI)
**Time:** ~180 minutes

## Objectifs d'apprentissage

- Télécharger un transformateur qui exécute deux pertes (NTP sur les jetons de texte, MSE de diffusion sur les patchs d'image) sur une colonne vertébrale.
- Expliquez pourquoi l'attention bidirectionnelle sur les patchs d'image plus l'attention causale sur les jetons de texte est le bon choix de masque.
- Comparez le style Transfusion (images continues, perte de diffusion) au style Chameleon (images discrètes, NTP) en termes de calcul, de qualité et de complexité de code.
- Nommer la contribution de MMDiT: poids spécifiques à la modalité à chaque bloc, attention commune au flux résiduel.

## Le problème

Le débat sur les jetons d'image discrets et continus est plus ancien que les LLM. Les représentations continues (pixels bruts, VAE latents) préservent les détails.

Chameleon / Emu3 est allé discrète: une perte, une architecture, mais la fidélité d'image limitée par la qualité du tokenizer.

Les modèles de diffusion sont restés continuels: une qualité d'image exceptionnelle, mais un modèle séparé du LLM, un génie de programmation du bruit complexe et aucune intégration propre avec la génération de texte.

La transfusion demande: pouvons-nous avoir les deux ? Gardez les images continuelles, entraînez toujours un modèle, utilisez deux pertes cousues en une étape de gradient.

## Le concept

### L'architecture à deux pertes

Un transformateur unique à décodeur seul traite une séquence qui contient:

- Les jetons texte (discrète, du vocabulaire BPE).
- Patch d'image (blocs de pixels 16x16 continus projetés dans un obscur caché via intégration linéaire  le même que l'entrée d'un encodeur ViT).
- `<image>`et `</image>`les balises indiquant où vivent les patchs continus.

Le pass avant passe une fois.

- Pour les jetons de texte: entropie croisée standard sur la tête du logiteur de vocabulaire.
- Pour les correctifs d'image: perte de diffusion sur les correctifs continus  prédire le bruit ajouté à chaque correction.

Le gradient coule dans le corps du transformateur partagé.

### Masque d'attention: texte causal + image bidirectionnelle

Les jetons de texte doivent être causaux  vous ne pouvez pas laisser un jeton de texte attirer le texte futur, ou un enseignant forcer des pauses.

Le masque:

```
M[i, j] = 1 if:
  (i is text and j is text and j <= i)   # causal for text
  OR (i is image and j is image and same_image_block(i, j))   # bidirectional within image
  OR (i is text and j is image and j < i)   # text attends to images that closed before it
  OR (i is image and j is text and j < i_image_start)   # image attends to preceding text
```

Appliqué comme masque triangulaire à l'entraînement et à l'inférence.

### Perte de diffusion à l'intérieur du transformateur

La perte de diffusion est standard: ajouter du bruit à un patch d'image, demander au modèle de prédire le bruit (ou le patch propre, équivalemment).

Pendant la formation:
1. Pour chaque patch d' image $x_0$, échantillonnage d' un pas de temps aléatoire $t$- Je suis désolé .
2. L' échantillon de bruit $\epsilon$, calcul$x_t = (1-t) \cdot x_0 + t \cdot \epsilon$(interpolation linéaire pour l'équivalence des débits).
3. Le transformateur prévoit .$v_\theta(x_t, t)$- le président .$\text{loss} = \mathop{\mathrm{MSE}}(v_\theta(x_t, t), \epsilon - x_0)$- Je suis désolé .
4. L'arrière-proposition aux côtés du texte NTP perd de la même séquence.

En inférence, la génération est:
- Les jetons de texte: prélèvement autorégressif standard.
- Parches d'image: boucle d'échantillonnage de diffusion (10-30 étapes typiques) conditionnée sur les jetons de texte précédents.

### MMDiT: Variante de la diffusion stable 3

Stable Diffusion 3 (Esser et coll., mars 2024) a expédié MMDiT (Transformateur de diffusion multimodal) à peu près au même moment que Transfusion.

Les principales différences de MMDiT:

- Les poids spécifiques à la modalité par bloc. Chaque bloc transformateur a des poids séparés Q, K, V et MLP pour les jetons de texte par rapport aux patchs d'image.
- Une variante spécifique de correspondance de flux avec le prélèvement d'échantillons connu et des mathématiques plus simples que la DDPM.
- L'échelle. MMDiT est la colonne vertébrale de SD3 (2B et 8B paramétrages).

Les deux convergent sur la même idée fondamentale: un transformateur exécute NTP sur texte et diffusion sur représentations d'image continues.

### Pourquoi ça bat le style du chamelion ?

L'écart de qualité entre la diffusion continue et la NTP discrète sur la génération d'images est mesurable.

- À 7B, il bat un modèle de même taille au style de Chameleon sur FID de 3 à 5 points.
- Aucune formation de tokenizer n'est requise  l'encodeur d'image est plus simple (projection linéaire à cache, la même que la couche d'entrée d'une ViT).
- L'inference peut paralléliser la dénonciation de patch d'image, contrairement aux jetons d'image autorégressifs.

Les effets négatifs: la transfusion est un modèle à double perte, ce qui rend la dynamique de formation plus difficile. Les poids de perte nécessitent une régulation.

### Ce qui est en aval

Janus-Pro (leçon 12.15) affinera l'idée de Transfusion en découplant le codeur de vision pour la compréhension et la génération  SigLIP pour l'un, VQ pour l'autre  tout en partageant le corps du transformateur. Show-o (leçon 12.14) swaps diffusion pour diffusion discrète (prédiction masquée).

Les modèles de production fermés qui émettent des images natives peuvent utiliser certains descendants de cette famille, mais leurs architectures ne sont pas publiées, alors traitez toute telle affirmation comme une devinette.

```figure
cfg-guidance-scale
```

## Utilisez-le

`code/main.py`construit un jouet Transfusion sur un petit problème comme MNIST:

- Les légendes de texte sont de courtes séquences entières décrivant un chiffre (0-9).
- Les images sont des grilles de 4x4 octets.
- Une paire de projections linéaires partagées de poids agit comme le substitut du transformateur; perte de NTP sur le texte, perte de MSE sur les correctifs bruyants.
- La boucle d'entraînement alternera les deux pertes, le masque d'attention est explicite.
- Une démo de masque imprime le modèle d'attention triangulaire de bloc pour un texte, une image, une séquence de texte. La génération n'est pas exécutée: un échantillon réel décode le jeton de texte par jeton, puis dénonce les patchs d'image sur plusieurs étapes, comme les exercices ci-dessous comptent.

Le transformateur est un jouet, les tuyaux à deux pertes, la construction du masque d'attention et la boucle d'inférence sont les vrais artefacts.

## La faire partir

Cette leçon produit `outputs/skill-two-loss-trainer-designer.md`. En raison d'une nouvelle tâche de formation multimodale (texte + image, texte + audio, texte + vidéo), il conçoit le calendrier de deux pertes (poids de perte, forme de masque, blocs partagés par rapport à des modalités spécifiques) et détermine les risques de mise en œuvre.

## Exercices

1. Un modèle de transfusion entraîne 70% de jetons de texte et 30% de correctifs d'image. La perte de diffusion d'image est ~ 10x la perte de NTP de texte en magnitude. Quels poids de perte les équilibrent?

2. Mettre en œuvre le masque triangulaire de bloc pour une séquence: `[T, T, <image>, P, P, P, P, </image>, T]`Marquez chaque entrée 0 ou 1.

3. MMDiT a des poids de QKV spécifiques à la modalité. Quel compte de paramètres ajoute-t-il par rapport au transformateur entièrement partagé de Transfusion ?

4. Génération: donné une requête de texte, le modèle exécute NTP pour 50 jetons, puis frappe `<image>`Il y a une diffusion sur 256 patchs sur 20 pas de dénos.

5. Lisez le document SD3 Section 3. Décrivez le débit rectifié et pourquoi il converge en moins de démarches d'inférence que le DDPM.

## Les termes clés

| Term | What people say | What it actually means |
|------|-----------------|------------------------|
| Two-loss training | "NTP + diffusion" | A single transformer optimizes both cross-entropy on text tokens and MSE on continuous image patches in the same gradient step |
| Flow matching | "Rectified flow" | Diffusion variant that predicts a velocity field from noise to clean data; simpler math than DDPM |
| MMDiT | "Multimodal DiT" | Stable Diffusion 3's architecture: joint attention, modality-specific MLPs and norms |
| Block-triangular mask | "Causal text + bidirectional image" | Attention mask that is causal across text but bidirectional within image regions |
| Continuous image representation | "No VQ" | Image patches as real-valued vectors, not integer codebook indices |
| Velocity prediction | "v-parameterization" | Network output is the velocity field between noise and data, not the noise itself |

## Pour en savoir plus

- [Zhou et al. — Transfusion (arXiv:2408.11039)](https://arxiv.org/abs/2408.11039)
- [Esser et al. — Stable Diffusion 3 / MMDiT (arXiv:2403.03206)](https://arxiv.org/abs/2403.03206)
- [Peebles & Xie — DiT (arXiv:2212.09748)](https://arxiv.org/abs/2212.09748)
- [Zhao et al. — MonoFormer (arXiv:2409.16280)](https://arxiv.org/abs/2409.16280)
- [Xie et al. — Show-o (arXiv:2408.12528)](https://arxiv.org/abs/2408.12528)
