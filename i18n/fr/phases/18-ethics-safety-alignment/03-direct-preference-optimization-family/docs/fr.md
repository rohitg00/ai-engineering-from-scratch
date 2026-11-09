# La famille de l'optimisation des préférences directes

> Raphaïlov et al. (2023) a montré que l'optimisation de RLHF a une forme fermée en termes de données de préférence, de sorte que vous pouvez sauter le modèle de récompense explicite et optimiser la politique directement. Cette compréhension a donné naissance à une famille  IPO, KTO, SimPO, ORPO, BPO  chacun fixant un mode d'échec de DPO. En 2026, les algorithmes d'alignement direct envoient plus de courses post-entraînement frontalières que les PPO. Mais la courbe de suroptimisation de la leçon 2 s'applique toujours: les DAA ne fuient pas Goodhart, ils se déplacent simplement là où il mord.

**Type:** Learn
**Languages:** Python (stdlib, six-variant preference-loss comparator), TypeScript
**Prerequisites:** Phase 18 · 01 (InstructGPT), Phase 18 · 02 (Reward hacking), Phase 10 · 08 (DPO basics)
**Time:** ~75 minutes

## Objectifs d'apprentissage

- Dériver la forme fermée du DPO de l'optimisme RLHF-avec-KL.
- Indiquez le mode d'échec de chacune des corrections d'IPO, KTO, SimPO, ORPO et BPO dans le DPO.
- Distinguer "l'écart de récompense implicite" de "la force de préférence" et expliquer pourquoi la cartographie de l'identité de l'IPO est importante.
- Expliquez pourquoi Rafailov et coll. (NeurIPS 2024) prouvent que les DAA sont suroptimisés en dépit de leur absence de RM explicite.

## Le problème

L'objectif du RLHF (leçon 1) est le suivant:

```math
\max_{\pi} \; \mathbb{E}_{x, y \sim \pi} \big[ r(x, y) \big] - \beta \, \mathrm{KL}(\pi \,\|\, \pi_{\text{ref}})
```

a un optimum connu:

```math
\pi^*(y \mid x) = \frac{1}{Z(x)} \, \pi_{\text{ref}}(y \mid x) \exp\!\left(\frac{r(x, y)}{\beta}\right)
```

Ainsi, la récompense est implicitement définie par le rapport entre la politique optimale et la référence:

```math
r(x, y) = \beta \log \frac{\pi^*(y \mid x)}{\pi_{\text{ref}}(y \mid x)} + \beta \log Z(x)
```

Remplacez cela par la probabilité de préférence Bradley-Terry et la fonction de partition .`Z(x)`annuler parce que cela dépend uniquement de `x`. Ce qui reste, c'est une perte dans les paramètres de politique seulement  pas besoin de modèle de récompense.

La dérive: la dérive suppose que l'optimal est atteignable, les données de préférence sont en distribution et la politique de référence est l'ancre de mode vrai. Aucun de ces éléments ne s'applique exactement. Chaque membre de la famille fixe une hypothèse différente violée.

## Le concept

### DPO (Rafailov et coll., 2023)

```math
L_{\text{DPO}} = -\log \sigma\!\left(
  \beta \log \frac{\pi(y_w \mid x)}{\pi_{\text{ref}}(y_w \mid x)}
  - \beta \log \frac{\pi(y_l \mid x)}{\pi_{\text{ref}}(y_l \mid x)}
\right)
```

Qu'est-ce qui peut aller mal ?

- L' écart de récompense implicite `beta * (log(pi/pi_ref)_w - log(pi/pi_ref)_l)`Une petite préférence peut créer un écart arbitrairement grand.
- Les disques de perte choisissent et rejettent les log-probes dans des directions opposées. Il peut pousser le log-prob absolu choisi vers le bas tant que le rejet tombe plus rapidement.
- Les préférences hors distribution (pares où les deux réponses sont rares dans le cadre de la politique de référence) produisent des récompenses implicites arbitraires.

### Les actions d'investissement (Azar et coll., 2024)

L'optimisation des préférences d'identité remplace le log-sigmoid par une carte d'identité sur la probabilité de préférence.

```math
L_{\text{IPO}} = \left( \log \frac{\pi(y_w \mid x)}{\pi_{\text{ref}}(y_w \mid x)} - \log \frac{\pi(y_l \mid x)}{\pi_{\text{ref}}(y_l \mid x)} - \frac{1}{2\beta} \right)^2
```

La marge est délimitée par `1/(2 beta)`- La force de préférence et l'écart entre les récompenses implicites sont proportionnels.

### Les mesures de sécurité sont prises en application de la directive 2009/65/UE.

L'optimisation Kahneman-Tversky réduit entièrement la structure parallèle.

```math
v(x, y) = \sigma\!\left(\beta \log \frac{\pi(y \mid x)}{\pi_{\text{ref}}(y \mid x)} - z_{\text{ref}}\right)
```

Les données de l'entreprise sont utilisées pour les données de l'entreprise, mais elles sont utilisées pour les données de l'entreprise.

### SimPO (Meng et coll., 2024)

L'optimisation des préférences simple aligne le signal d'entraînement avec la génération.

```math
L_{\text{SimPO}} = -\log \sigma\!\left(
  \frac{\beta}{|y_w|} \log \pi(y_w \mid x)
  - \frac{\beta}{|y_l|} \log \pi(y_l \mid x)
  - \gamma
\right)
```

avec une marge `gamma`La normalisation de la longueur élimine l'incitation à exploiter le mode d'échec du biais de longueur du DPO (plus long `y_w`donne un écart plus grand entre les logs et les probes par construction).

### ORPO (Hong et coll., 2024)

L'optimisation des préférences par rapport aux cotes ajoute un terme de préférence à la probabilité de log négatif standard de la FFT:

```math
\begin{aligned}
L_{\text{ORPO}} &= L_{\text{NLL}}(y_w) + \lambda L_{\text{OR}} \\
L_{\text{OR}} &= -\log \sigma\!\left(\log \frac{\text{odds}(y_w)}{\text{odds}(y_l)}\right)
\end{aligned}
```

Aucune politique de référence  le terme SFT est le régulateur. entraînement en une seule étape du modèle de base au modèle aligné. Aucun point de contrôle SFT séparé.

### BPO (déclaration ICLR 2026, OpenReview id=b97EwMUWu7)

Identifie le problème des réponses dégradées choisies: le DPO conserve le classement `y_w > y_l`Mais le log-prob absolu de `y_w`Le BPO ajoute une correction à une seule ligne qui pénalise les mouvements descendants sur la réponse choisie.

### Le résultat universel: les DAI continuent à suroptimiser

Rafailov et coll. "Leges d'échelle pour la suroptimisation des modèles de récompense dans les algorithmes d'alignement direct" (NeurIPS 2024) ont formé des politiques avec DPO, IPO, SLiC sur plusieurs ensembles de données sur les budgets KL. Les courbes doré-récompense-versus-KL ont la même forme Gao et coll. La requête implicite de récompense demande des échantillons hors de distribution pendant la formation; la normalisation KL ne stabilise pas cela.

Les DAA ne s'échapperont pas à Goodhart. Ils changent la surface où il mord de "modèle de récompense suroptimisé" à "ratio de politique de référence suroptimisé".

### Choisir parmi eux (2026)

- Si vous avez de grandes données de préférence partagées: DPO avec bêta conservateur, SimPO si le biais de longueur est évident.
- Si vous avez des retours binaires non couplés: KTO.
- Si vous voulez un pipeline à étape unique d'un modèle de base: ORPO.
- Si vous voyez des sondes de journaux choisies dégradées dans les journaux du DPO: BPO.
- Si les valeurs de préférence varient considérablement et que le DPO est saturant: IPO.

Chaque laboratoire utilise une batterie pour choisir le gagnant par tâche.

```figure
dpo-margin
```

## Utilisez-le

`code/main.py`Comparer six pertes (DPO, IPO, KTO, SimPO, ORPO, BPO) sur un ensemble de données de préférence de jouets où la force de préférence réelle varie par paire. Chaque perte est optimisée contre le même échantillon de 500 paires avec une petite politique de softmax.

## La faire partir

Cette leçon produit `outputs/skill-preference-loss-selector.md`. Compte tenu des statistiques des ensembles de données (parées contre nonparées, variables contre force de préférence uniforme, distribution de longueur) et d'une cible (étape unique ou SFT-then-preference), recommander une perte de préférence et signaler le mode de défaillance contre lequel il protège.

## Exercices

1. On court .`code/main.py`. Rapporte la dernière baisse de l'enquête de logue choisie pour le DPO et le BPO.

2. Modifiez les données de préférence afin que toutes les paires aient la même force.

3. Faites en moyenne 2 fois plus longues les réponses rejetées que celles choisies.

4. Rafailov et coll. (NeurIPS 2024) affirment que les DAA sont suroptimisées.

5. Lisez le résumé du document BPO (OpenReview b97EwMUWu7).`code/main.py`- Je suis désolé .

## Les termes clés

| Term | What people say | What it actually means |
|------|-----------------|------------------------|
| DPO | "RLHF without a reward model" | Loss derived from the closed-form RLHF optimum; policy parameters only |
| Implicit reward | "the log-ratio" | `beta * log(pi(y\|x) / pi_ref(y\|x))` — the DPO-implied reward |
| IPO | "bounded DPO" | Replaces log-sigmoid with identity; implicit reward gap capped by `1/(2 beta)` |
| KTO | "unpaired DPO" | Prospect-theory utility over single labels with loss aversion |
| SimPO | "reference-free DPO" | Length-normalized log-likelihood + margin; no reference policy |
| ORPO | "one-stage DPO" | NLL + odds-ratio preference term; trains from base model in one pass |
| BPO | "chosen-preserving DPO" | DPO plus a penalty for decreasing the chosen response's absolute log-prob |
| Degraded Chosen | "chosen goes down" | DPO decreases chosen log-prob so long as rejected falls faster |
| DAA | "direct alignment algorithm" | Any preference-loss method that skips an explicit RM |

## Pour en savoir plus

- [Rafailov et al. — Direct Preference Optimization (NeurIPS 2023, arXiv:2305.18290)](https://arxiv.org/abs/2305.18290)
- [Azar et al. — A General Theoretical Paradigm to Understand Learning from Human Preferences (AISTATS 2024, arXiv:2310.12036)](https://arxiv.org/abs/2310.12036) OPC
- [Ethayarajh et al. — KTO: Model Alignment as Prospect Theoretic Optimization (arXiv:2402.01306)](https://arxiv.org/abs/2402.01306)
- [Meng, Xia, Chen — SimPO (NeurIPS 2024, arXiv:2405.14734)](https://arxiv.org/abs/2405.14734)
- [Hong, Lee, Thorne — ORPO (EMNLP 2024, arXiv:2403.07691)](https://arxiv.org/abs/2403.07691)
- [BPO — Behavior Preservation Optimization (ICLR 2026 OpenReview b97EwMUWu7)](https://openreview.net/forum?id=b97EwMUWu7)
- [Rafailov et al. — Scaling Laws for RM Overoptimization in DAAs (NeurIPS 2024, arXiv:2406.02900)](https://arxiv.org/abs/2406.02900)
