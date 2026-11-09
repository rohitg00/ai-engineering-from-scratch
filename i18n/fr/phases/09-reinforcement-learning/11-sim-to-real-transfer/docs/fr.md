# Transfert sim-réel

> Une politique formée dans un simulateur qui échoue sur le matériel est une politique qui mémorise le simulateur.

**Type:** Learn
**Languages:** Python, TypeScript
**Prerequisites:** Phase 9 · 08 (PPO), Phase 2 · 10 (Bias/Variance)
**Time:** ~45 minutes

## Le problème

Un vrai robot est lent, dangereux et coûteux. Un bipède a besoin de millions d'épisodes d'entraînement pour apprendre à marcher; un bipède qui tombe même une fois qu'il casse le matériel.

Les simulateurs ont des effets négatifs, mais les simulateurs ont tort. Les roulements ont plus de friction que les modèles MuJoCo. Les caméras ont des distorsions de lentilles que le simulateur n'inclut pas. Les moteurs ont des retards, des réactions négatives et une saturation que 99% des modèles sim sautent. Le vent, la poussière et l'éclairage variable sabotent une politique formée sur le rendu stérile.**reality gap** La différence systématique entre la distribution sim et la distribution réelle  est le problème central de la RL déployée pour la robotique.

Vous avez besoin d'une politique qui soit *robuste pour le sim-to-real distribution shift*. Trois approches historiques: randomiser le simulateur (randomisation de domaine), adapter la politique avec un peu de données réelles (adaptation / ajustement du domaine), ou identifier les paramètres du système réel et les correspondre (identification du système). En 2026, la recette dominante combine les trois avec une simulation parallèle massive (Isaac Sim, Isaac Lab, Mujoco MJX sur GPU).

## Le concept

![Three sim-to-real regimes: domain randomization, adaptation, system identification](../assets/sim-to-real.svg)

**Domain Randomization (DR).**Tobin et al. En 2017, Peng et al. En 2018, il y a eu une récession. Pendant l'entraînement, randomiser tous les paramètres sim qui pourraient différer sur le robot réel: masses, coefficients de friction, gains de PD du moteur, bruit du capteur, position de la caméra, éclairage, textures, modèles de contact. La politique apprend une distribution conditionnelle sur "quel sim est aujourd'hui" et généralise à travers toute la durée. Si le vrai robot est dans le cadre de la formation, la politique fonctionne.

- **Upside:**Il n'y a pas besoin de données réelles.
- **Downside:**La formation sur randomisée produit une politique "universelle" mais trop prudente.

**System Identification (SI).**Si vous pouvez mesurer l'affrontement entre les bras et les articulations sur le robot réel, branchez-le sur le simulateur. Ensuite, entraînez une politique qui s'attend à ces valeurs.

- **Upside:**cible d'entraînement précise et à faible bruit.
- **Downside:**L'erreur résiduelle du modèle est invisible pour la politique; de petits effets non identifiés (par exemple, la bande morte du moteur) perturbent toujours le déploiement.

**Domain Adaptation.**En train en sim, en réglage avec une petite quantité de données réelles.

- **Real2Sim2Real:**Apprendre un simulateur résiduel $f(s, a, z) - f_{\text{sim}}(s, a)$En utilisant des déploiements réels, entraînons dans le sim correct.
- **Observation adaptation:**entraîner une politique qui cartographient un véritable obs → sim-like obs via un extracteur de fonctionnalités appris (par exemple, GAN pixel-à-pixel).

**Privileged learning / teacher-student.**Miki et coll. 2022 (Annimal quadruped). Formez un *professeur* dans une simulation qui a accès à des informations privilégiées (truth friction au sol, altitude du terrain, dérive IMU). Dédistribuez un *étudiant* qui ne voit que des observations à capteur réel. L'étudiant apprend à déduire des caractéristiques privilégiées de l'histoire, robustes sur les paramètres physiques.

**Massively parallel simulation.**Isaac Lab, Mujoco MJX, Brax exécutent tous des milliers de robots parallèles sur un seul GPU. PPO avec 4 096 humanoïdes parallèles recueille des années d'expérience en quelques heures.

**The real-world 2026 recipe (quadruped walking example):**

1. Simulation parallèle avec gravité randomisée, friction, gain moteur, charge utile.
2. Politique des enseignants formés avec des informations privilégiées (carte du terrain, vérité sur la vitesse du corps au sol).
3. Les politiques étudiantes distillées de l'enseignant en utilisant uniquement la proprioception (encodateurs des articulations des jambes).
4. Adaptation optionnelle de l'observation par autoencodeur sur l'UIM réel.
5. Déployer, ne pas tirer sur plus de 10 environnements, et si ça ne marche pas, faire quelques minutes de réglage réel avec PPO.

```figure
f3-reality-gap
```

## Faites-le

Le code de cette leçon est une petite démonstration de la randomisation de domaine sur un GridWorld avec des transitions * bruyantes *. Nous entraînons une politique qui expérimente des probabilités de glissement randomisées dans "sim" et évalue sur "réel" avec un niveau de glissement qu'il n'a jamais vu lors de la formation.

### Étape 1: sim paramétrifié

```python
def step(state, action, slip):
    if rng.random() < slip:
        action = random_perpendicular(action)
    ...
```

`slip`En robotique réelle, il pourrait s'agir de friction, de masse, de gain moteur, tout ce qui se déplace entre sim et réel.

### Étape 2: entraînement avec DR

Au début de chaque épisode, échantillon `slip ~ Uniform[0.0, 0.4]`- Prenez le PPO, l'apprentissage Q, tout.

### Étape 3: évaluer les tirages zéro sur les feuilles "réelles"

Évaluer `slip ∈ {0.0, 0.1, 0.2, 0.3, 0.5, 0.7}`- les quatre premiers sont placés dans le cadre d'un soutien à la formation; `0.5`et `0.7`Une politique de formation en DR devrait rester presque optimale à l'intérieur du support et dégrader gracieusement à l'extérieur.

### Étape 4: comparer à une formation étroite

Formez une deuxième politique avec `slip = 0.0`- Je ne peux pas le faire.`slip`Vous devriez voir une chute catastrophique dès que le glissement réel > 0.

## Les pièges

- **Too much randomization.**Le train est en marche .`slip ∈ [0, 0.9]`et votre politique est si averse au risque qu'elle n'essaie jamais de suivre le chemin optimal.
- **Too little randomization.**Traînez sur une tranche mince et la politique ne peut pas être généralisée du tout. Utilisez un programme adaptatif (Randomisation automatique de domaine) qui élargit la distribution à mesure que la politique s'améliore.
- **Misidentified parameter space.**Remplissez le mauvais truc (tune de la caméra quand le vrai écart est le retard moteur) et DR n'aide pas.
- **Privileged info leakage.**Un enseignant qui utilise l'état global pour des actions, pas seulement des observations, peut produire un élève qui ne peut pas le rattraper.
- **Sim-to-sim transfer failure.**Si votre politique n'est pas robuste à une variante sim plus difficile, elle ne sera pas robuste au monde réel non plus.
- **No real-world safety envelope.**Une politique qui fonctionne en sim et "fonctionne en réalité" sans un bouclier de sécurité de faible niveau peut toujours briser le matériel.

## Utilisez-le

La série sim-to-real de 2026:

| Domain | Stack |
|--------|-------|
| Legged locomotion (ANYmal, Spot, humanoid) | Isaac Lab + DR + privileged teacher / student |
| Manipulation (dexterous hands, pick-and-place) | Isaac Lab + DR + DR-GAN for vision |
| Autonomous driving | CARLA / NVIDIA DRIVE Sim + DR + real fine-tune |
| Drone racing | RotorS / Flightmare + DR + online adaptation |
| Finger/in-hand manipulation | OpenAI Dactyl (DR at unprecedented scale) |
| Industrial arms | MuJoCo-Warp + SI + small real fine-tune |

Pour le contrôle à toutes les échelles, le flux de travail est cohérent: adapter le sim le mieux possible, randomiser ce que vous ne pouvez pas adapter, entraîner des politiques énormes, distiller, déployer avec un bouclier de sécurité.

## La faire partir

- Je ne sais pas .`outputs/skill-sim2real-planner.md`- Le numéro de la liste:

```markdown
---
name: sim2real-planner
description: Plan a sim-to-real transfer pipeline for a given robot + task, covering DR, SI, and safety.
version: 1.0.0
phase: 9
lesson: 11
tags: [rl, sim2real, robotics, domain-randomization]
---

Given a robot platform, a task, and access to real hardware time, output:

1. Reality gap inventory. Suspected sources ranked by expected impact (contact, sensing, actuation delay, vision).
2. DR parameters. Exact list, ranges, distribution. Justify each range against real measurements.
3. SI steps. Which parameters to measure; measurement method.
4. Teacher/student split. What privileged info the teacher uses; what obs the student uses.
5. Safety envelope. Low-level limits, emergency stops, backup controller.

Refuse to deploy without (a) a zero-shot sim-variant test, (b) a safety shield, (c) a rollback plan. Flag any DR range wider than 3× measured real variability as likely over-randomized.
```

## Exercices

1. **Easy.**Former un agent Q-apprentissage sur le GridWorld à glissement fixe (slip=0.0).$\text{slip} \in \lbrace 0.0, 0.1, 0.3, 0.5 \rbrace$- Le retour contre le glissement.
2. **Medium.**Formation d' un agent d' apprentissage DR Q`slip ~ Uniform[0, 0.3]`- Combien DR achète à slip=0,5 (en dehors de la distribution)?
3. **Hard.**Mettre en œuvre un programme: commencer par slip=0,0, élargir la plage DR chaque fois que la politique atteint 90% de l'optimal. Mesurer les étapes de l'environnement totale pour atteindre slip=0,3 nul-shot par rapport à une plage de base DR fixe.

## Les termes clés

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| Reality gap | "Sim-to-real difference" | Distribution shift between training and deployment physics/sensing. |
| Domain randomization (DR) | "Train across random sims" | Randomize sim parameters during training so policy generalizes. |
| System identification (SI) | "Measure real and fit sim" | Estimate real physical parameters; set sim to match. |
| Domain adaptation | "Fine-tune on real data" | Small real-world fine-tune after sim training; may adapt obs or dynamics. |
| Privileged info | "Ground truth for teacher" | Information only the sim has; student must infer it from obs history. |
| Teacher/student | "Distill privileged -> observable" | Teacher trained with shortcuts; student learns to mimic without them. |
| ADR | "Automatic Domain Randomization" | Curriculum that widens DR ranges as the policy improves. |
| Real2Sim | "Close the gap with real data" | Learn a residual to make the sim mimic real rollouts. |

## Pour en savoir plus

- [Tobin et al. (2017). Domain Randomization for Transferring Deep Neural Networks from Simulation to the Real World](https://arxiv.org/abs/1703.06907) le document original de DR (vision pour la robotique).
- [Peng et al. (2018). Sim-to-Real Transfer of Robotic Control with Dynamics Randomization](https://arxiv.org/abs/1710.06537) DR pour la dynamique, la locomotion quadruple.
- [OpenAI et al. (2019). Solving Rubik's Cube with a Robot Hand](https://arxiv.org/abs/1910.07113) Dactyl, ADR à l'échelle.
- [Miki et al. (2022). Learning robust perceptive locomotion for quadrupedal robots in the wild](https://www.science.org/doi/10.1126/scirobotics.abk2822) enseignant-étudiant pour ANYmal.
- [Makoviychuk et al. (2021). Isaac Gym: High Performance GPU Based Physics Simulation for Robot Learning](https://arxiv.org/abs/2108.10470) la simulation massiquement parallèle qui conduit les déploiements 2025-2026.
- [Akkaya et al. (2019). Automatic Domain Randomization](https://arxiv.org/abs/1910.07113) Métode du programme d'ADR.
- [Sutton & Barto (2018). Ch. 8 — Planning and Learning with Tabular Methods](http://incompleteideas.net/book/RLbook2020.pdf) le cadrage Dyna (utiliser un modèle pour la planification + les déploiements) qui sous-tend les pipelines sim-to-real modernes.
- [Zhao, Queralta & Westerlund (2020). Sim-to-Real Transfer in Deep Reinforcement Learning for Robotics: a Survey](https://arxiv.org/abs/2009.13303) taxonomie des méthodes sim-to-real avec des résultats de référence.
