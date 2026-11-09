# De CLIP à BLIP-2  Q-Former comme pont de modalité

> CLIP aligne l'image et le texte, mais ne peut générer de légendes, répondre à des questions ou tenir une conversation. BLIP-2 (Salesforce, 2023) a résolu cela avec un petit pont entraînable: 32 vecteurs de requête apprenables assistent sur les caractéristiques d'un ViT gelé via l'attention croisée, puis s'insèrent directement dans le flux d'entrée d'un LLM gelé. 188 millions de paramètres de pont ont relié un ViT-g/14 à des LLM gelés de taille équivalente au 11B Flan-T5-XXL. Chaque VLM basé sur un adaptateur jusqu'en 2026  MiniGPT-4, InstructBLIP, les cousins de LLaVA  est un descendant. Cette leçon lit l'architecture du Q-Former, explique son entraînement en deux étapes et construit une version de jouet qui alimente des jetons visuels dans un décodeur de texte gelé.

**Type:** Build
**Languages:** Python, TypeScript (stdlib, cross-attention + learnable-query demo)
**Prerequisites:** Phase 12 · 02 (CLIP), Phase 7 (Transformers)
**Time:** ~180 minutes

## Objectifs d'apprentissage

- Expliquez pourquoi un goulet d'étranglement entraînable entre un encodeur de vision gelé et un LLM gelé est supérieur à l'ajustement fin de bout en coût et stabilité.
- Implémenter un bloc d'attention croisée où un ensemble fixe de requêtes apprenantes répond aux caractéristiques externes de l'image.
- Passez par la préparation en deux étapes de BLIP-2: représentation (ITC + ITM + ITG) puis générative (perte de LM avec décodeur gelé).
- Comparez Q-Former au plus simple projecteur MLP utilisé dans LLaVA et discutez quand chaque choix gagne.

## Le problème

Vous avez un ViT gelé qui produit 256 jetons de patch de dim 1408 par image. Vous avez un LLM gelé 7B qui attend des emblèmes de jetons de dim 4096. Le pont évident  une couche linéaire de 1408 à 4096  fonctionne, mais l'alimentation de tous les 256 jetons de patch dans le contexte du LLM coûte 256 jetons supplémentaires par image.

La question BLIP-2: pouvez-vous compresser la représentation d'image de 256 jetons en beaucoup moins de jetons (disons 32) tout en préservant suffisamment d'informations pour que le LLM puisse sous-titrer, répondre aux questions et raisonner sur l'image? Et pouvez-vous entraîner ce pont sans toucher les os froids, en gardant le coût de la formation aux seules paramètres du pont?

La réponse: un Q-Former. 32 vecteurs "query" apprenables qui se croisent aux jetons de patch du ViT, produisant un résumé visuel de 32 jetons que le LLM consomme. 188M de paramètres au total.

## Le concept

### Questions à apprendre

Le truc principal du Q-Former: au lieu de laisser les jetons de texte du LLM s'occuper des correctifs d'image, introduisez un nouvel ensemble de 32 vecteurs de requête apprenables `Q`Les requêtes sont des paramètres du modèle  elles sont apprises lors de la formation et les mêmes 32 requêtes sont utilisées pour chaque image.

Après l'attention croisée, chaque requête contient un résumé comprimé de l'image  "décrire l'objet principal", "décrire l'arrière-plan", "comptez les objets", etc. Les requêtes ne se spécialisent pas littéralement dans les étiquettes sémantiques; elles apprennent ce que le codage fait en aval les pertes de baisse.

### Architecture

Le Q-Former est un petit transformateur (12 couches, ~ 100M params) avec deux voies:

1. Voie de requête: 32 vecteurs de requête circulent à travers l'auto-attention (entre eux), puis l'attention croisée sur les jetons de patch du ViT gelé, puis FFN.
2. Voie de texte: un encodeur de texte semblable à BERT partage l'auto-attention et les poids FFN avec le chemin de requête.

Les requêtes et le texte interagissent par l'intermédiaire de l'auto-attention partagée, ce qui signifie que les requêtes peuvent conditionner le texte pour les tâches qui en ont besoin (ITM, ITG).

### Formation en deux étapes

BLIP-2 prétraine en deux étapes:

Étapes 1: apprentissage représentatif (pas de LLM). Trois pertes:
- CTI (contraste image-text): contraste CLIP entre les jetons de requête regroupés et les jetons CLS texte.
- ITM (image-text matching): classifiateur binaire  est cette paire image-text un match?
- ITG (Génération de texte basée sur l'image): LM causel sur texte, conditionné sur les requêtes.

Les trains Q-Former, le ViT est congelé, pas de LLM.

Étape 2: apprentissage génératif. Attachez un LLM gelé (OPT-2.7B ou Flan-T5-XL, etc.). Projetez les 32 sorties de requête à la séquence d'embedding du LLM via une petite couche linéaire. Préparez-les à la requête de texte.

Après la phase 2, la projection Q-Former + est l'adaptateur visuel complet. À l'inférence: image → ViT → Q-Former → projet linéaire → prépendu au texte → gelé LLM émet la sortie.

### Économie des paramètres

BLIP-2 avec ViT-g/14 (1.1B, congelé) + OPT-6.7B (6.7B, congelé) + Q-Former (188M, formé) = 8B total, 188M formé. Le Q-Former seul représente ~ 2,4% des paramètres de la pile complète.

Qualité: BLIP-2 correspond ou bat Flamingo-80B sur VQA à tir zéro tout en étant 50 fois plus petit.

### InstructBLIP et le Q-Former qui connaît les instructions

InstructBLIP (2023) étend le Q-Former avec une entrée supplémentaire: le texte d'instruction lui-même. Au moment de l'attention croisée, les requêtes ont maintenant accès à la fois aux patchs d'image et à l'instruction. Les requêtes peuvent se spécialiser par instruction ("comptez les voitures", "décrivez l'humeur") plutôt que d'apprendre un seul résumé fixe.

### MiniGPT-4 et l'approche à projecteur seulement

MiniGPT-4 a gardé le Q-Former mais a entraîné seulement la projection linéaire de sortie tout en congelant tout le reste. Cheap, mais le coût est de qualité  les requêtes étaient de BLIP-2, pas les vôtres. Bon pour l'itération rapide, pas la meilleure architecture.

### Pourquoi LLaVA est devenu plus simple

LLaVA (2023, leçon 12.05) a remplacé le Q-Former par un MLP simple à 2 couches qui projette chaque jeton de patch ViT dans l'espace LLM  576 jetons par image pour une grille 24x24, tous alimentés au LLM. Pire compression mais laisse le LLM assister sur les patches brutes. À l'époque, cela était controversé; à la fin de 2023, il était dominant parce que les données d'instruction visuelle (LLaVA-Instruct-150k) prouvaient que le MLP pouvait être formé pour préserver suffisamment de signal. Le compromis: le contexte de LLaVA se remplit plus rapidement, mais il s'élargit naturellement à la multi-image et à la vidéo.

En 2026, le champ est divisé: Q-Former survit là où le budget des jetons compte (vidéo longue, beaucoup d'images); le projecteur MLP domine là où la qualité brute par jeton est la priorité.

### Attention croisée: Flamingo, l'ancêtre

Flamingo (Lésion 12.04) précède BLIP-2 et utilise la même idée d'attention croisée mais à chaque couche LLM gelée, pas comme un seul pont. BLIP-2 a montré que vous pouvez compresser à la couche d'entrée uniquement et toujours travailler. Gemini et Idefics combinent les deux: jetons d'entrée interleavés plus une attention croisée fermée optionnelle pour quelques coups dans le contexte.

### Les descendants de 2026

- Q-Former: BLIP-2, InstructBLIP, MiniGPT-4 et la plupart des modèles vidéo-langue pour des raisons de budget de jeton.
- Le modèle de réception: la variante Flamingo (leçon 12.04); la famille Idefics, Eagle, OmniMAE.
- Le projetor MLP: LLaVA, LLaVA-NeXT, LLaVA-OneVision, Cambrian-1.
- La salle d'attention: VILA, PaliGemma.

La question cruciale est de savoir si vous êtes limité par le budget des jetons ou par la qualité par jeton.

```figure
modality-projection
```

## Utilisez-le

`code/main.py`construit une attention croisée de style Q-Former:

1. Simuler 256 jetons de patch d'image (dim 128).
2. 32 requêtes instantanées à apprendre (dim 128).
3. Exécuter l'attention croisée produit-point-échelle (Q des requêtes, K/V des correctifs).
4. Projet à la dimension LLM (512) via une couche linéaire.
5. Sortez les 32 jetons visuels prêts à être réalisés.

Toutes les mathématiques en Python pur (boucles nichés sur des vecteurs). Jouet mais forme correcte. La matrice de poids d'attention est imprimée afin que vous puissiez voir quels patchs chaque requête est tirée de.

## La faire partir

Cette leçon produit `outputs/skill-modality-bridge-picker.md`. Compte tenu de la configuration VLM cible (compte de jetons d'encodeur de vision, budget de contexte de LLM, contraintes de déploiement, objectif de qualité), il recommande le reéchantillon Q-Former vs MLP vs Perceiver avec une courte justification et une estimation du nombre de paramètres pour chaque pont.

## Exercices

1. Implémenter le bloc d'attention croisée dans PyTorch. Vérifiez que, avec 32 requêtes et 256 touches/valeurs, la matrice de poids d'attention est 32 x 256 et que chaque rangée s'élève à 1 après softmax.

2. Dans BLIP-2 étape 1, le Q-Former effectue trois pertes simultanément: ITC, ITM, ITG. Écrivez la signature avant pour chacun en pseudo-code.

3. Comparer les nombres de paramètres: Q-Former (12 couches, 768 cachées) contre un projecteur MLP à 2 couches (1408 → 4096, deux couches).

4. Lisez la section 3.2 du document BLIP-2 (arXiv:2301.12597) sur la façon dont le Q-Former est initialisé.

5. Pour une vidéo de 10 minutes à 1 FPS échantillonnée à 60 images, calculez le coût de jeton par image à (Q-Former → 32 jetons/image) vs (MLP projecteur → 576 jetons/image). Combien de images chaque pont peut s'intégrer dans une fenêtre contextuelle de 128k-token LLM avant que le texte prompt ne trouve de la place ?

## Les termes clés

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| Q-Former | "Querying transformer" | Small transformer with 32 learnable query vectors that cross-attend to frozen ViT features |
| Learnable queries | "Soft prompt for vision" | A fixed set of parameters that serve as the query side of cross-attention; learned per model, shared across all inputs |
| Cross-attention | "Q from here, K/V from there" | Attention where query, key, and value come from different sources; how the queries pull from ViT patches |
| ITC | "Image-text contrastive" | CLIP-style loss applied to Q-Former pooled queries vs text CLS |
| ITM | "Image-text matching" | Binary classifier on hard-negative-mined pairs; forces the queries to discriminate fine-grained mismatches |
| ITG | "Image-grounded text generation" | Causal LM loss where text is generated conditioned on queries; forces queries to encode text-decodable content |
| Two-stage pretraining | "Representation then generative" | Stage 1 trains Q-Former alone (ITC/ITM/ITG); Stage 2 attaches frozen LLM and trains only the projection + Q-Former |
| Frozen backbone | "Do not finetune" | The vision encoder and LLM weights are fixed; only the bridge trains |
| Projection head | "Linear to LLM dim" | Final linear layer mapping Q-Former output to the LLM's embedding dimension |
| Perceiver resampler | "Flamingo's version" | Similar learnable-query cross-attention; Flamingo runs it once per image to make fixed latents, then reads them through gated cross-attention at every LLM layer |

## Pour en savoir plus

- [Li et al. — BLIP-2 (arXiv:2301.12597)](https://arxiv.org/abs/2301.12597) le papier de base.
- [Li et al. — BLIP (arXiv:2201.12086)](https://arxiv.org/abs/2201.12086) le prédécesseur avec le trio ITC/ITM/ITG.
- [Li et al. — ALBEF (arXiv:2107.07651)](https://arxiv.org/abs/2107.07651) "align avant fusible"  l'ancêtre conceptuel de la formation de phase 1.
- [Dai et al. — InstructBLIP (arXiv:2305.06500)](https://arxiv.org/abs/2305.06500) Q-Former, qui connaît les instructions.
- [Zhu et al. — MiniGPT-4 (arXiv:2304.10592)](https://arxiv.org/abs/2304.10592) approche à projecteur seulement.
- [Jaegle et al. — Perceiver IO (arXiv:2107.14795)](https://arxiv.org/abs/2107.14795) architecture générale pour l'attention croisée entre les questions apprenantes.
