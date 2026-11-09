# Suivre les instructions comme signal d'alignement

> Chaque critique ultérieure de RLHF s'oppose à ce pipeline. Avant d'étudier comment la pression d'optimisation déforme un proxy, vous devez voir le proxy. InstructGPT (Ouyang et coll., 2022) a défini l'architecture de référence: réglage supervisé sur les paires d'instructions-réponse, un modèle de récompense formé sur les classements de préférence par paires et PPO contre le modèle de récompense avec une pénalité KL à la politique SFT. Un GPT Instruct 1.3B a été préféré à un GPT 175B-3. Ce résultat unique est la raison pour laquelle chaque laboratoire frontalier en 2026 envoie toujours un pipeline post-entraînement en forme de RLHF.

**Type:** Learn
**Languages:** Python (stdlib, toy three-stage pipeline), TypeScript
**Prerequisites:** Phase 10 · 06 (SFT), Phase 10 · 07 (RLHF), Phase 10 · 08 (DPO)
**Time:** ~45 minutes

## Objectifs d'apprentissage

- Nombre des trois étapes du pipeline InstructGPT et la perte utilisée dans chacune d'elles.
- Expliquez pourquoi un modèle ajusté aux instructions 1.3B a dépassé le modèle brut 175B GPT-3 sur l'évaluation des préférences humaines.
- Expliquez à quoi la sanction KL de l'étape 3 protège et pourquoi la suppression de celle-ci entraîne un comportement de recherche de mode.
- Décrivez l'impôt d'alignement et l'atténuation du PPO-ptx appliquée à l'égard de Ouyang et coll.

## Le problème

Les modèles de langage prétraînés complètent le texte. Ils ne répondent pas aux questions. Demandez à GPT-3 "écrire une fonction Python qui renverse une liste" et vous obtenez souvent une autre demande, car la plupart de la distribution de formation est un texte Web qui se poursuit avec plus de texte Web. Le modèle fait son travail  le travail est faux.

Le proxy utilisé par chaque laboratoire sérieux pour corriger cela est la préférence humaine. Deux compléments vont à un évaluateur; le évaluateur choisit le meilleur; un modèle de récompense apprend le évaluateur. Puis une boucle RL déplace la politique vers les résultats du modèle de récompense score élevé. C'est la thèse complète de InstructGPT en trois phrases. Le reste du papier est l'ingénierie.

## Le concept

### Étape 1: réglage fin supervisé (SFT)

Rassembler des paires de réponses rapides où la réponse est ce qu'un humain bien intentionné écrirait. Ouyang et al. ont utilisé des demandes 13k de labélistes et de l'API OpenAI.

Ce que la SFT vous donne: le modèle répond maintenant aux questions au lieu de les poursuivre. Ce qu'il ne vous donne pas: tout signal sur la réponse que le rater préfère lorsque plusieurs sont plausibles.

### Étape 2: modèle de récompense (RM)

Pour chaque prompt, prenez l'échantillon des compléments K du modèle SFT. Un étiqueteur les classe.`y_w`était préféré à `y_l`- Le numéro de la liste:

```math
L_{\text{RM}} = -\log \sigma\big(r(x, y_w) - r(x, y_l)\big)
```

C'est la perte de préférence par paire Bradley-Terry. Le RM est généralement initialement défini à partir du modèle SFT avec la tête LM remplacée par une tête escalare.

Les modèles de récompense sont petits: 6B suffisait pour le 175B InstructGPT. Ils sont également fragiles  section 5 du document concerne principalement les comportements de piratage de la récompense qui se sont produits à petite échelle.

### Étape 3: PPO avec une pénalité KL

Définir l'objectif:

```math
J(\pi) = \mathbb{E}_{x \sim D,\, y \sim \pi(\cdot \mid x)} \big[ r(x, y) \big] - \beta \, \mathrm{KL}\big(\pi(\cdot \mid x) \,\|\, \pi_{\text{SFT}}(\cdot \mid x)\big)
```

Le terme KL est conservé.`pi`Sans elle, l'optimisateur trouve des exemples contradictoires  des chaînes qui marquent bien sous le RM parce que le RM ne les a jamais vus, pas parce que les humains les préfèrent réellement.

Le coefficient KL `beta`trop bas: piratage de la récompense trop élevé: aucune amélioration par rapport à la SFT.

### Taxe d'alignement

Après la RLHF, le modèle est préféré par les humains mais régresse sur les critères de référence standard (SQuAD, HellaSwag, DROP). Ouyang et al. appellent cela la taxe d'alignement et le fixent avec PPO-ptx: mélangez les gradients pré-entraînement dans l'objectif de RL afin que le modèle n'oublie pas comment effectuer des tâches en aval pour lesquelles il n'a jamais été récompensé.

```math
J_{\text{ptx}}(\pi) = J(\pi) + \gamma \, \mathbb{E}_{x \sim D_{\text{pretrain}}} \big[ \log \pi(x) \big]
```

Le PPO-ptx est devenu standard. Anthropic, DeepMind et Meta utilisent tous une variante.

### Le résultat

Un 1.3B InstructGPT (SFT + RM + PPO-ptx) est préféré par les étiquetteurs au GPT-3 de base 175B environ 70% du temps.

1. L'alignement est un axe différent de la capacité. Le modèle 175B avait plus de capacité; le modèle 1.3B avait plus d'alignement; les étiquetteurs préféraient celui aligné.
2. Le niveau de capacité est fixé par le modèle de base.

### Pourquoi c'est le point de référence de la phase 18

Chaque critique dans les leçons ultérieures  récompense de piratage (leçon 2), DPO (leçon 3), sycophancy (leçon 4), CAI (leçon 5), agents endormis (leçon 7), alignement de fausse (leçon 9)  s'oppose à une partie de ce pipeline. Les attaques de piratage récompensent étape 2. Le DPO s'effondre dans les étapes 2 et 3. CAI remplace l'étiquetateur humain. La sycophancy montre que l'étiquetage est un signal biaisé. Les faux alignements montrent que la politique peut se diriger entièrement autour de l'étape 3. Vous ne pouvez suivre aucune de ces critiques sans d'abord avoir le pipeline dans votre tête.

```figure
al-instruct-pipeline
```

## Utilisez-le

`code/main.py`simulation des trois étapes sur les données de préférence des jouets. La "politique" de base est une pièce biaisée sur les actions {A, B, C}. La phase 1 du SFT imite les actions de l'étiquetage sur 200 demandes. La deuxième étape correspond à un modèle de récompense Bradley-Terry de 500 classements par paires. La phase 3 consiste à simplifier la mise à jour de l'OPP avec une pénalité KL à l'égard de la politique de FFT. Vous pouvez regarder la hausse des récompenses, la divergence KL croître, et la dérive des politiques  et vous pouvez désactiver le terme KL pour voir le piratage de récompense apparaître dans 50 étapes de mise à jour.

À quoi regarder:

- Trajectorie de récompense avec `beta = 0.1`contre`beta = 0.0`- Je suis désolé .
- $\mathrm{KL}(\pi \Vert \pi_{\text{SFT}})$sur les étapes d'entraînement.
- Répartition finale des actions par rapport à la préférence de l'étiquetage.

## La faire partir

Cette leçon produit `outputs/skill-instructgpt-explainer.md`. Une description du pipeline RLHF ou un résumé papier indiquent quelle des trois étapes est modifiée, quelle perte est utilisée à chaque étape et si une pénalité KL ou un régulateur équivalent est présent.

## Exercices

1. On court .`code/main.py`- Je suis prêt .`beta = 0.0`et de signaler la répartition de l'action après 200 étapes de PPO. Expliquez le comportement de recherche de mode en un paragraphe.

2. Modifiez le modèle de récompense pour avoir un biais de +0,5 pour l'action B (un bug de récompense simulé).`beta = 0.1`La sanction KL empêche-t-elle la politique d'exploiter le biais ?`beta`l'exploitation devient visible ?

3. Lisez Ouyang et coll. (arXiv:2203.02155) Figure 1. Reproduire la courbe de préférence étiquetateur en exécutant PPO pour 1, 5, 20, 100 étapes et en mesurant la préférence par rapport au modèle SFT.

4. La section 4.3 du journal rapporte qu'un GPT Instruct 1.3B dépasse 175B GPT-3 environ 70% du temps. Pourquoi le ratio serait-il plus élevé sur les instructions de production cachées que sur les instructions du label?

5. Remplacez la perte de PPO par DPO (phase 10 · 08) sur les mêmes données de préférence. Comparer la dérive finale de la politique (KL à SFT) et la récompense finale. Quelle méthode dérive plus loin à la récompense correspondante?

## Les termes clés

| Term | What people say | What it actually means |
|------|-----------------|------------------------|
| SFT | "instruction tuning" | Stage 1: cross-entropy fine-tune on prompt-response pairs |
| Reward model | "the RM" | Scalar regressor over (prompt, response) trained with Bradley-Terry on pairwise labels |
| Bradley-Terry | "pairwise preference loss" | $-\log \sigma(r_w - r_l)$; reduces pairwise ranking to binary classification |
| KL penalty | "the regularizer" | `beta * KL(pi \|\| pi_SFT)` — keeps the RL policy near the SFT anchor |
| PPO-ptx | "PPO with pretraining mix" | Adds a fraction of pre-training log-likelihood to the PPO objective to offset the alignment tax |
| Alignment tax | "the RLHF regression" | Post-RLHF drop on standard benchmarks that RLHF did not target |
| Labeler preference | "the ground truth" | Sample of human rankings; the RM is a statistical proxy for this, not for "human values" |

## Pour en savoir plus

- [Ouyang et al. — Training language models to follow instructions with human feedback (arXiv:2203.02155)](https://arxiv.org/abs/2203.02155) le papier InstructGPT, fondement de chaque pipeline RLHF qui a suivi
- [Stiennon et al. — Learning to summarize from human feedback (arXiv:2009.01325)](https://arxiv.org/abs/2009.01325) le prédécesseur du RLHF pour résumé
- [Christiano et al. — Deep reinforcement learning from human preferences (arXiv:1706.03741)](https://arxiv.org/abs/1706.03741) la formule de RL originale basée sur les préférences
- [Bai et al. — Training a Helpful and Harmless Assistant with RLHF (arXiv:2204.05862)](https://arxiv.org/abs/2204.05862) L'extension de la HH de l'oléoduc InstructGPT par Anthropic
