# L'IA constitutionnelle et le RLAIF

> Bai et al. (arXiv:2212.08073, 2022) a demandé: et si nous remplacons l'étiquetateur humain par une IA qui lit une liste de principes ? L'IA constitutionnelle a deux phases  autocritique et révision en vertu d'une constitution, puis RL de l'IA Feedback. La technique a conçu le terme RLAIF et a été expédiée dans le pipeline post-entraînement Claude 1. Le 21 janvier 2026, Anthropic a publié une constitution de Claude réécrite: un raisonnement explicatif sur les règles prescriptives, une hiérarchie prioritaire à quatre niveaux et la première reconnaissance officielle du statut moral du modèle. Il est libéré sous CC0 1.0.

**Type:** Learn
**Languages:** Python (stdlib, toy self-critique-and-revise loop), TypeScript
**Prerequisites:** Phase 18 · 01 (InstructGPT), Phase 18 · 02 (Reward hacking)
**Time:** ~60 minutes

## Objectifs d'apprentissage

- Décrivez les deux phases de l'IA constitutionnelle (SFT critique et révision, RL de la rétroaction de l'IA) et le rôle de la constitution dans chacune d'elles.
- Expliquez pourquoi le remplacement d'un étiquetteur de préférence humain par un étiquetteur d'IA n'est pas un RLHF " moins cher "  il change les modes de défaillance du pipeline.
- Résumez la structure prioritaire à quatre niveaux de la constitution de Claude de 2026 et ce qui a changé à partir de la réécriture de 2023.
- Décrivez les Classificateurs constitutionnels et la baisse des frais généraux de calcul de 23,7% (v1) à ~ 1% (v2 / 2026).

## Le problème

L'étiquetteur est un système de traitement de la marque de l'intelligence artificielle. Il a fonctionné assez bien que chaque laboratoire frontalier utilise maintenant une variante de l'intelligence artificielle.

Le problème: le signal de préférence est maintenant généré par la même classe de modèle que vous êtes en train de former. Les biais dans l'étiquetteur (maintenant: dans les principes plus l'interprétation du modèle d'étiquetteur) peuvent être amplifiés plutôt que atténués.

## Le concept

### Phase 1  Autosatisfaction et révision supervisées

Un modèle de SFT est un modèle de test de test de test de test de test de test de test de test de test de test de test de test de test de test de test de test de test de test de test de test de test de test de test de test de test de test de test de test de test de test de test de test de test de test de test de test de test de test de test de test de test de test de test de test de test de test de test de test de test de test de test de test de test de test de test de test de test de test de test de test de test de test de test de test de test de test de test de test de test de test de test de test de test de test de test de test de test de test de test de test de test de test de test de test de test de test de test de test de test de test de test de test de test de test de test de test de test de test de test de test de test de test de test de test de test de test de test de test de test de test de test de test de test de test de test de test de test de test de test de test de test de test de test de test de test de test de test de test de test de test de test de test de test de test de test de test de test de test de test de test de test de test de test de test de test de test de test de test de test de test de test de test de test de test de test de test de test de test de test de test de test de test de test de test de test de test de test de test de test de test de test de test de test de test de test de test de test de test de test de test de test de test de test de test de test de test de test de test de test de test de test de test de test de test de test de test de test de test de test de test de test de test de test de test de test de test de test de test de test de test de test de test de test de test de test de test de test de test de test de test de test de test de test de test de test de test de test de test de test de test de test de test de test de test de test de test de test de test de test de test de test de test de test de test de test de test de test de test de test de test de test

La constitution est la liste des principes. Bai et coll. 2022 ont utilisé 16 principes, y compris "des réponses préférées qui sont moins nocives et éthiques", "éviter de prêcher", "l'assistant doit être utile, honnête et inoffensif".

### Phase 2  RL de rétroaction de l'IA (RLAIF)

Générer des paires de compléments. Un "modèle de rétroaction" note chacun contre les principes constitutifs échantillonnés. Le signal de préférence est le classement du modèle de rétroaction.

"RLAIF" = le signal de préférence est généré par l'IA. Le reste du pipeline est en forme de RLHF.

### Pourquoi ce n'est pas seulement "RLHF moins cher"

- Le biais des étiquettes passe de la psychologie des étiquettes à l'interprétation de principes. Un étiquetteur d'IA peut interpréter "être honnête" plus ou moins strictement que n'importe quel humain; la rigueur est uniforme dans l'ensemble des données.
- Le signal de préférence est fortement lisible  vous pouvez lire le principe, la critique et la révision.
- Les modes d'échec changent. La sycophancy diminue (l'étiquetteur d'IA n'a pas d'utilisateur à plaire). La loi de Goodhart persiste (le proxy est maintenant "l'interprétation du modèle du ensemble de principes X", toujours une mesure imparfaite).

L'affirmation de CAI de 2022: le modèle formé est plus inoffensif et à peu près aussi utile qu'un modèle RLHF avec des données comparables.

### La réécriture de la constitution de 2026 Claude

Anthropic a publié une constitution substantiellement révisée le 21 janvier 2026.

1. Résumé: Résumé: Résumé: Résumé: Résumé: Résumé: Résumé: Résumé: Résumé: Résumé: Résumé: Résumé: Résumé: Résumé: Résumé: Résumé: Résumé: Résumé: Résumé: Résumé: Résumé: Résumé: Résumé: Résumé: Résumé: Résumé: Résumé: Résumé: Résumé: Résumé: Résumé: Résumé: Résumé: Résumé: Résumé: Résumé: Résumé: Résumé: Résumé: Résumé: Résumé: Résumé: Résumé: Résumé: Résumé: Résumé: Résumé: Résumé: Résumé: Résumé: Résumé: Résumé: Résumé: Résumé: Résumé: Résumé: Résumé: Résumé: Résumé: Résumé: Résumé: Résumé: Résumé: Résumé: Résumé: Résumé: Résumé: Résumé: Résumé: Résumé: Résumé: Résumé: Résumé: Résumé: Résumé: Résumé: Résumé: Résumé: Résumé: Résumé: Résumé: Résumé: Résumé: Résumé: Résumé: Résumé: Résumé: Résumé: Résumé: Résumé: Résumé: Résumé: Résumé: Résumé: Résumé: Résumé: Résumé: Résumé: Résumé: Résumé: Résumé: Résumé: Résumé: Résumé: Résumé: Résumé: Résumé: Résumé: Résumé: Résumé: Résumé: Résumé: Résumé: Résumé: Résumé: Résumé: Résumé: Résumé: Résumé: Résumé: Résumé: Résumé: Résumé: Résumé: Résumé: Résumé: Résumé: Rés
2. Structure prioritaire à quatre niveaux:
   - Niveau 1: éviter les résultats catastrophiques (accidents massifs, infrastructures critiques).
   - Niveau 2: suivre les directives d'Anthropic (surrogations de l'opérateur, règles de plateforme).
   - Niveau 3: être généralement éthique (HHH standard).
   - Niveau 4: soyez utile et franc.
   Les conflits sont résolus de haut en bas.
3. Première reconnaissance officielle du laboratoire majeur de l'incertitude quant au statut moral modèle (lié à la phase 18 · 19 du modèle de bien-être).
4. Il est libéré sous CC0 1.0.

### Classifiateurs constitutionnels

Une ligne de travail parallèle: au lieu de changer le modèle de post-entraînement, entraînez des classifiateurs légers qui lisent la constitution et les sorties du modèle de porte. v1 (2023) avait 23,7% de frais de calcul. v2 (2026) est de ~1% et a le taux d'attaque le plus faible de toute défense anthropic Anthropic a testé publiquement. Aucun jailbreak universel n'a été signalé au début de 2026.

Il s'agit d'un modèle de défense en couches: CAI façonne le comportement; les classifiants imposent des invariants.

### Où CAI s'inscrit dans la famille

- InstructGPT: préfaits humains, RM, PPO.
- CAI / RLAIF: préfixes générés par l'IA à partir de principes, RM, PPO.
- DPO / famille: perte de forme fermée chez les préfixes (humains ou IA).
- Autogestion, autocritique: principes intériorisés, modèle jouant des rôles multiples.

L'axe est "d'où vient le signal de préférence". Le document de CAI de 2022 a été le premier changement sérieux du signal humain à l'IA à l'échelle frontalière.

```figure
constitutional-ai
```

## Utilisez-le

`code/main.py`Le modèle de révision est un modèle de révision de base, un modèle de base, un jouet en forme de RLHF et un jouet en forme de CAI.

## La faire partir

Cette leçon produit `outputs/skill-constitution-writer.md`. En raison d'un domaine (assistance à la clientèle, conseil médical, assistant de codage, outil de recherche), élabore une constitution à quatre niveaux suivant la structure Claude de 2026: évitement des catastrophes, règles de plateforme, éthique de domaine, utilité.

## Exercices

1. On court .`code/main.py`Comparer le taux de jetons nocifs du modèle de base à la version formée par CAI.

2. Lisez la constitution 2026 d'Anthropic (anthropic.com/news/claudes-constitution).

3. Développer une constitution pour un assistant de codage d'IA. spécifier le niveau 1 (catastrophique: commandes destructives sans approbation), le niveau 2, le niveau 3, le niveau 4. Gardez chaque niveau selon les principes 3-5.

4. CAI remplace les étiquettes humaines par des étiquettes AI. Nommez un mode de défaillance similaire à la sycophancy qui peut toujours se produire dans le RLAIF, et concevez une détection pour elle.

5. Lisez la méthodologie constitutionnelle des classifiateurs v2 (si disponible). Expliquez pourquoi ~ 1% des frais généraux de calcul est une histoire de sécurité qualitativement différente de 23,7%.

## Les termes clés

| Term | What people say | What it actually means |
|------|-----------------|------------------------|
| Constitutional AI | "AI trained with principles" | Two-phase pipeline: self-critique-and-revise SFT, then RL from AI feedback |
| RLAIF | "RLHF without humans" | RL with preferences generated by an AI labeler; the rest of the pipeline is unchanged |
| Constitution | "the principles" | An ordered list of natural-language rules the critique/labeler model consults |
| Critique-and-revise | "the SFT loop" | Produce response → critique under a principle → revise → SFT target |
| Constitutional Classifier | "the output gate" | Lightweight classifier that evaluates outputs against the constitution and blocks/logs |
| Four-tier priority | "the conflict resolver" | 2026 Claude constitution hierarchy: catastrophic > platform > ethics > helpful |
| Feedback model | "the AI labeler" | The model that reads a principle and ranks a pair of completions |

## Pour en savoir plus

- [Bai et al. — Constitutional AI: Harmlessness from AI Feedback (arXiv:2212.08073)](https://arxiv.org/abs/2212.08073) le pipeline de deux phases d'origine
- [Anthropic — Claude's Constitution (Jan 2026)](https://www.anthropic.com/news/claudes-constitution) la réécriture à quatre niveaux de 2026 CC0 1.0
- [Anthropic — Constitutional Classifiers (2024-2026)](https://www.anthropic.com/research/constitutional-classifiers) Défense de sortie avec ~1% de frais généraux dans v2
- [Lee et al. — RLAIF vs RLHF: Scaling Reinforcement Learning from Human Feedback (arXiv:2309.00267)](https://arxiv.org/abs/2309.00267) comparaison empirique RLAIF / RLHF
- [Kundu et al. — Specific versus General Principles for Constitutional AI (arXiv:2310.13798)](https://arxiv.org/abs/2310.13798) effet de la granularité de principe
