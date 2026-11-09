# Les VLA incorporés: RT-2, OpenVLA, π0, GR00T

> La première fois qu'un modèle a lu une recette sur un site Web et l'a exécutée dans un robot de cuisine a été RT-2 (Google DeepMind, juillet 2023). RT-2 a discrétisé les actions en tant que jetons de texte, co-finitionné un VLM sur les données Web plus les données d'action robot, et prouvé que la connaissance du langage de vision à l'échelle Web transfère au contrôle robotique. OpenVLA (juin 2024) a expédié la référence 7B ouverte. La série π0 de Physical Intelligence (2024-2025) a ajouté des experts en action de correspondance de flux. Le GR00T N1 de NVIDIA (mars 2025) a fourni un contrôle à double système (Système 1 / Système 2) pour les robots humanoïdes à grande échelle. Le VLA primitif  vision-langue-action, un modèle unique qui voit, lit et agit  est le pont entre les modèles de compréhension de cette phase et les systèmes autonomes de la phase 15.

**Type:** Learn
**Languages:** Python (stdlib, action tokenizer + VLA inference skeleton), TypeScript
**Prerequisites:** Phase 12 · 05 (LLaVA), Phase 15 (Autonomous Systems, referenced)
**Time:** ~180 minutes

## Objectifs d'apprentissage

- Décrire la tokenization d'action: codage discrète en bin (RT-2), jetons d'action efficaces FAST, actions de correspondance continue des flux (π0).
- Expliquez pourquoi la co-finition des données sur le web + les robots préserve le transfert de connaissances générales vers de nouvelles tâches.
- Comparer OpenVLA (ouverte 7B Llama+VLM), π0 (correspondance de flux) et GR00T N1 (dual-système) sur la même tâche robot.
- Nombre de données sur l'Open X-Embodiment et son rôle de corps de formation RT-X.

## Le problème

Un robot qui fait des tâches ménagères à partir d'instructions de langage naturel a été une cible de recherche depuis les années 1970. La réponse des années 2020: un modèle d'action de langage de vision (VLA). La même architecture VLM utilisée pour VQA, mais la sortie est des actions (tombes conjoints, poses d'effet de fin, commandes discrètes) au lieu de texte.

Défis spécifiques aux VLA:

1. Les espaces d'action sont continus (angle commun, forces) et à haute dimension (7 bras DOF + poignée 3-DOF = 10 dims à 30 Hz).
2. Les données de formation spécifiques aux robots sont rares. Open X-Embodiment a environ 1M de trajectoires; image de texte Web est 5B+.
3. La fréquence de contrôle est importante.
4. Une mauvaise action endommage le matériel, les personnes ou les biens.

## Le concept

### Tokenization des actions (RT-2)

RT-2: représente chaque cible conjointe comme un jeton de texte quantifié. Discrète la plage normalisée [-1, 1] en 256 poubelles, carte chaque poubelle à un ID vocabulaire. Une action de 10 DOF devient 10 jetons à chaque étape de contrôle.

Co-finition d'un VLM PaLM-X sur un mélange:

- Parmi les éléments suivants, il y a:
- Des démonstrations de robots, des actions en tant que jetons.

Le modèle voit " pick up the red cube " (langue) → image (vision) → séquence d'action de 10 jetons (objectifs conjoints discrétisés). Le prétrainage Web préserve le transfert de connaissances générales: RT-2 peut suivre " le mouvement vers l'objet en mouvement rapide " même si " le mouvement rapide " n'est pas dans les données de formation.

L'inference à 3-5 Hz dans le papier RT-2, limitée par le décode autorégressif VLM.

### OpenVLA  la référence 7B ouverte

OpenVLA (Kim et coll., juin 2024) est l'équivalent RT-2 à poids ouvert. 7B Llama spine dorsale, DINOv2 + SigLIP double vision encodeur, action Tokenization sur 256 poubelles.

Formé sur Open X-Embodiment (970 000 trajectoires sur 22 robots).

Inference: 4 à 5 Hz sur un A100 avec quantification.

### FAST Tokenizer  décodeur d'action plus rapide

Pertsch et coll. (2024) ont montré que la jetonisation discrète bin est inefficace  la plupart des actions se regroupent dans une petite région de bin-space. FAST (Frequency-domain Action Sequence Tokenizer) comprime les séquences d'action via DCT et quantifie les coefficients.

Une trajectoire d'action de 30 étapes devient ~ 10 jetons FAST au lieu de 300 jetons discret-bin.

### π0 et actions de correspondance des flux

Le π0 de Physical Intelligence (Black et al., octobre 2024) remplace les jetons d'action discrets par un expert en action de correspondance de flux:

- Un petit transformateur d'action lit les états cachés du VLM et produit une séquence d'action continue de 50 étapes via un flux rectifié.
- La tête d'action s'entraîne avec une perte de correspondance de débit; la VLM reste inchangée avant l'entraînement.
- Inference: séquence d'action complète émise en ~5 étapes dénonciatrices, contrôle efficace à 50 Hz.

L'acte continu de la formulation préserve la douceur que la discrétion détruit.

π0.5 et π0-FAST sont des améliorations progressives. π0-FAST combine la symbolisation FAST avec le flux de correspondance.

### GR00T N1  système double pour les humanoïdes

Le GR00T N1 (mars 2025) de NVIDIA est conçu pour les robots humanoïdes (> 30 DOF, corps complet):

- Système 2: une grande scène de lecture VLM + instruction, produisant des sous-objectifs de haut niveau à ~ 1 Hz.
- Système 1: un petit transformateur à tête d'action produisant des commandes conjointes de bas niveau de 50 à 100 Hz conditionnées sur les sous-objectifs.

Les cartes divisées à Kahneman de la pensée rapide et lente: Système 2 plans, Système 1 agit.

GR00T N1.7 (fin 2025) améliore l'évolutivité des données. GR00T est affiné avec des données sim-to-real de l'Omniverse.

### Le corps X ouvert

Les données de formation. RT-X (octobre 2023) a assemblé 22 ensembles de données couvrant 1M de trajectoires sur 22 robots. Open X-Embodiment est le corpus que tout le monde utilise:

- ALOHA / Bridge V2 / Droid / RT-2 Cuisine / Tableau de langue.
- Chaque échantillon: (état du robot, vue de la caméra, instruction, séquence d'action).
- L'hygiène de formation: unifier l'espace d'action, normaliser les rangées articulaires, redimensionner les caméras.

OpenVLA et π0 se développent sur Open X-Embodiment.

### Co-ajustement par rapport aux robots seulement

Le co-ajustement mélange les données VQA web avec les trajectoires des robots. Le rapport importe: trop de VQA et le modèle oublie les actions; trop de données robot et le modèle perd les connaissances générales.

Le rapport RT-2 est un hyperparamètre à régler par taille de jeu de données.

L'entraînement robot seulement produit des modèles spécifiques à la tâche qui échouent sur les instructions hors de distribution. Co-finition est la différence entre "pick up the red cube (en démo) " et "pick up the third largest object from the left (novel phrasing)".

### Limits de sécurité et d'action

Chaque VLA de production est équipée de:

- Limits d'articulation dures (ne peut pas dépasser le couple spécifique).
- Limite de vitesse (coupe douce).
- Limits de l'espace de travail (l'éffecteur final ne peut pas quitter la table).
- Approbation humaine en cours pour des tâches nouvelles.

Ces éléments sont placés à l'extérieur du VLA comme contrôles de couche de contrôle.

```figure
mm-action-tokens
```

## Utilisez-le

`code/main.py`- Le numéro de la liste:

- Il met en œuvre la tokenization et la détokenization d'action 256 bin.
- Dessine un jeton FAST basé sur la quantification DCT +.
- Comparer le nombre de jetons par étape d'action (bin discrète, FAST, flux continu).
- Imprime un résumé de lignée de RT-2 → OpenVLA → π0 → GR00T.

## La faire partir

Cette leçon produit `outputs/skill-vla-action-format-picker.md`. En raison d'une tâche robot (manipulation, navigation, corps entier humanoïde), choisissez entre bin discret + RT-2, FAST + OpenVLA, flux-matching + π0, ou système double + GR00T.

## Exercices

1. Un bras de 10 DOF à 30 Hz, une tokenization discrète à 256 poubelles, combien de jetons par seconde émet un VLM 7B ?

2. La symbolisation FAST comprime les trajectoires de 30 étapes à ~ 10 jetons. Que perd l'utilisateur si la trajectoire a un mouvement à haute fréquence (par exemple, le tambour)?

3. Le débit de la tête de coïncidence de π0 se détecte en ~ 5 étapes.

4. Le système 1 / système 2 de GR00T divise les cartes de Kahneman.

5. Lisez la section 4 de l'Open X-Embodiment sur la conservation des ensembles de données.

## Les termes clés

| Term | What people say | What it actually means |
|------|-----------------|------------------------|
| VLA | "Vision-language-action" | Model that takes image + instruction and outputs action commands |
| Action tokenization | "Discrete bins" | Quantize continuous joint targets into 256 bins per dim, each a vocab ID |
| FAST tokenizer | "Frequency action tokens" | DCT + quantize to compress 30-step trajectories to ~10 tokens |
| Co-fine-tune | "Mix web + robot" | Train on web VQA data alongside robot demos to preserve general knowledge |
| Flow-matching action head | "π0 continuous output" | Small transformer that outputs a 50-step action sequence via rectified flow |
| System 1 / System 2 | "Dual-system control" | Large VLM plans slowly, small action head acts quickly; GR00T pattern |
| Open X-Embodiment | "RT-X dataset" | 1M-trajectory cross-robot dataset; the training corpus |

## Pour en savoir plus

- [Brohan et al. — RT-2 (arXiv:2307.15818)](https://arxiv.org/abs/2307.15818)
- [Kim et al. — OpenVLA (arXiv:2406.09246)](https://arxiv.org/abs/2406.09246)
- [Black et al. — π0 (arXiv:2410.24164)](https://arxiv.org/abs/2410.24164)
- [NVIDIA — GR00T N1 (arXiv:2503.14734)](https://arxiv.org/abs/2503.14734)
- [Open X-Embodiment Collab — RT-X (arXiv:2310.08864)](https://arxiv.org/abs/2310.08864)
