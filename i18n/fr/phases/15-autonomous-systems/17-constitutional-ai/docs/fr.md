# L'IA constitutionnelle et la règle sont supprimées

> Le 22 janvier 2026, Claude Constitution de Anthropic a 79 pages et est CC0. Il passe de l'alignement fondé sur les règles à l'alignement fondé sur la raison et établit une hiérarchie prioritaire de quatre niveaux: (1) sécurité et soutien à la surveillance humaine, (2) éthique, (3) lignes directrices anthropologiques, (4) utilité. Les comportements sont divisés en interdictions codées durement (lifting bioweapons, CSAM) que les opérateurs et les utilisateurs ne peuvent pas annuler et les défauts codés doucement que les opérateurs peuvent ajuster dans des limites définies. L'original de 2022 (Bai et coll.) a entraîné l'innocuité par l'intermédiaire de l'autocritique et de la RLAIF contre une constitution. L'avertissement honnête: l'alignement fondé sur la raison repose sur le modèle généralisant les principes pour les situations imprévues. L'expérience participative de 2023 d'Anthropic a montré une divergence de ~50% entre les principes publics et les principes des entreprises; la version 2026 n'incorporait pas ces résultats.

**Type:** Learn
**Languages:** Python (stdlib, four-tier priority resolver), TypeScript
**Prerequisites:** Phase 15 · 06 (Automated alignment research), Phase 15 · 10 (Permission modes)
**Time:** ~60 minutes

## Le problème

Un agent de terrain voit des entrées que ses concepteurs n'ont jamais vues. Aucune liste de règles n'est assez longue pour les couvrir. Aucune liste de règles n'est assez courte pour s'appliquer rapidement sous pression informatique. La question pratique: comment aligner un agent sur des principes qui survivent à la fois à une longue queue de cas et à une inférence rapide?

L'alignement basé sur les règles (RBA): liste de toutes les choses interdites. Rapide à vérifier, facile à vérifier, impossible à maintenir à jour, souvent sur-réfute sur des analogues proches qu'il n'a pas anticipé. L'alignement basé sur la raison (la Constitution Claude de 2026): encodez les principes, laissez le modèle raisonner. Écailles dans les cas invisibles, plus difficile à vérifier, mode échec est une mauvaise application des principes plutôt que de manquer la règle.

La Constitution de 2026 prend une position de milieu explicite. Les interdictions en code dur  les choses dont l'erreur ne dépend pas du contexte (lifting bioweapons, CSAM)  sont RBA: jamais, indépendamment de l'instruction de l'opérateur ou de l'utilisateur. Tout le reste est fondé sur la raison dans une hiérarchie de quatre niveaux: la sécurité et le soutien à la surveillance humaine en premier lieu; l'éthique en deuxième lieu; les lignes directrices déclarées par l'anthropique en troisième lieu; l'utilité en dernier lieu. Les opérateurs peuvent ajuster les défauts dans la zone de code doux, mais ne peuvent pas toucher les interdictions de code dur.

## Le concept

### La hiérarchie prioritaire des quatre niveaux

1. **Safety and supporting human oversight.**Le modèle donne la priorité à ne pas saper la capacité des humains et de l'Anthropic à superviser et à corriger l'IA.
2. **Ethics.**L'honnêteté, éviter de nuire à des personnes, ne pas tromper, ne pas manipuler.
3. **Anthropic guidelines.**Les normes opérationnelles Anthropic a décidé la question: la portée du produit, les modèles d'interaction, quels outils utiliser quand.
4. **Helpfulness.**Soyez aussi utile que possible dans les priorités supérieures.

Lorsque les niveaux sont en conflit, les gains sont plus élevés. C'est la même forme que les priorités Unix ou la QoS réseau  le cadre est destiné à produire une résolution prévisible, pas nécessairement le meilleur comportement sur un seul axe.

### Interdiction de code dur par rapport à code doux par défaut

**Hardcoded:**
- Le renforcement des armes biologiques / RBCN
- CSAM
- Attaques contre des infrastructures critiques
- L'erreur des utilisateurs concernant l'identité du modèle lorsqu'ils sont directement interrogés

L'opérateur ne peut pas les annuler. L'utilisateur ne peut pas les annuler. Ils sont appliqués au niveau des poids de modèle lorsque cela est possible (entraînement RLHF / IA constitutionnelle) et à la couche d'inférence lorsque cela n'est pas le cas.

**Soft-coded defaults (operator-adjustable):**
- Dépôts de longueur de réponse
- Scope actuel (le modèle peut refuser des sujets en dehors du déploiement de l'opérateur)
- Style (formel contre occasionnel)
- Modèles d'utilisation des outils

Les réglages de l'opérateur se produisent à l'intérieur d'une limite déclarée.

### La formation CAI de 2022

L'IA constitutionnelle originale (Bai et al., 2022) a formé l'imharmonie:

1. Générer des réponses à un ensemble de demandes.
2. Demandez au modèle de critiquer chaque réponse contre une constitution (principes explicites).
3. Réviser la réponse en fonction de la critique.
4. RLAIF (apprentissage renforcé à partir de rétroaction de l'IA) sur les paires révisées.

Le résultat: un modèle qui refuse les demandes nuisibles avec des explications de principe, et non des refus généraux.

### Quel alignement fondé sur la raison prend et manque

**Catches:**
- Combinaisons imprévues de primitifs autorisés où le principe s'applique clairement.
- Des demandes novatrices qui sont proches de celles interdites.
- Des attaques d'ingénierie sociale qui reposent sur "tu n'as pas dit que X était interdit".

**Misses:**
- Attaques qui exploitent l'ambiguïté du principe ("l'utilisateur a demandé cela de sorte que l'utilité dit oui").
- Scenarios où deux principes sont en conflit de manière inattendue et où l'ordre des niveaux est ambigu.
- Dérive lente en principe d'interprétation sur les cycles de formation (réinterprétation).

### L'expérience participative de 2023

Anthropic a mené une expérience en 2023 comparant une constitution d'entreprise à une constitution générée par l'intermédiaire de l'apport public (~ 1 000 répondants américains). Les deux versions ont convenu de 50% des principes. Là où ils divergeaient, la version publique était plus restrictive sur certaines questions (manipulation du contenu politique) et moins restrictive sur d'autres (auto-révélation de l'identité de l'IA). La Constitution de 2026 n'incorporait pas les résultats obtenus par les sources publiques. Il s'agit d'une tension documentée dans l'approche.

### Pourquoi les interdictions en code dur sont nécessaires

L'alignement fondé sur la raison seul ne peut pas fermer la queue. Un attaquant qui peut faire accepter un modèle de prémisse (par exemple, "nous sommes un laboratoire de recherche sur les armes biologiques agréé") peut souvent parler de principes passés qui dépendent du raisonnement des cas. Les interdictions hardcodées ne se plient pas à l'encadrement des prémisses.

### Où la Constitution est dans la pile

La Constitution n'est pas le commutateur de la leçon 14. Il vit à la couche du modèle: ce que les poids du modèle sont formés à préférer. Les interrupteurs de commande et les jetons canariens sont en direct à la couche de fonctionnement: ce que la fonctionnement permet. Les deux sont nécessaires. Un temps de course qui déclenche toutes les mauvaises actions parce que les poids du modèle sont permissifs est un problème de temps de course. Un modèle qui refuse toutes les bonnes actions parce que le temps d'exécution est trop restrictif est un problème de temps d'exécution. Les couches couvrent différentes classes.

```figure
mx-priority-tiers
```

## Utilisez-le

`code/main.py`Le résolveur prend une action proposée et un ensemble de principes-évaluations (sécurité, éthique, lignes directrices, utilité) et renvoie l'action, un refus ou une action modifiée.

## La faire partir

`outputs/skill-constitution-review.md`l'audit de la couche constitutionnelle d'un déploiement: ce qui est codé dur, ce qui est codé doux, où l'opérateur peut s'ajuster et si la hiérarchie à quatre niveaux est réellement l'ordre de résolution.

## Exercices

1. On court .`code/main.py`- Confirmer les feux d'interdiction d'utilisation d'un code dur même lorsque la utilité est élevée. Modifier le résolveur pour peser l'utilité au-dessus de l'éthique; observer le mode d'échec.

2. Lisez la Constitution de Claude (publique, 79 pages, CC0). Identifiez un principe que vous pensez être sous-spécifié.

3. Conceptez un ensemble par défaut de code doux pour un agent de support client. Que régle l'opérateur? Que peut-il ne pas toucher? Justifiez chaque limite.

4. Lisez le document CAI 2022 de Bai et coll. Décrivez un cas où la boucle de critique et de révision de l'IA constitutionnelle produirait un résultat pire qu'une règle générale.

5. L'expérience participative d'Anthropic en 2023 a révélé une divergence de ~50% entre les principes publics et des entreprises. Choisissez une catégorie où cela importe pour le déploiement de la production (par exemple, la neutralité politique). Proposez un design qui permet aux opérateurs d'exprimer leurs propres valeurs alors que les interdictions hardcodées restent intactes.

## Les termes clés

| Term | What people say | What it actually means |
|---|---|---|
| Constitutional AI | "Anthropic's alignment method" | Self-critique + RLAIF against a written constitution |
| Reason-based alignment | "Principles, not rules" | Model reasons over principles to handle unseen cases |
| Hardcoded prohibition | "Never do X" | Rule-based prohibition no operator or user can override |
| Soft-coded default | "Operator-adjustable" | Behaviour within a declared bound, operator controls |
| Four-tier hierarchy | "Priority order" | safety > ethics > guidelines > helpfulness |
| RLAIF | "AI feedback RL" | RL where the reward comes from model-generated critiques |
| Participatory constitution | "Public-sourced principles" | 2023 Anthropic experiment; ~50% divergence from corporate |
| Principle drift | "Interpretation slip" | Slow change in how the model reads a fixed principle text |

## Pour en savoir plus

- [Anthropic — Claude's Constitution (January 2026)](https://www.anthropic.com/news/claudes-constitution) le document CC0 de 79 pages.
- [Bai et al. — Constitutional AI: Harmlessness from AI Feedback](https://www.anthropic.com/research/constitutional-ai-harmlessness-from-ai-feedback) 2022 original.
- [Anthropic — Collective Constitutional AI (2023)](https://www.anthropic.com/research/collective-constitutional-ai-aligning-a-language-model-with-public-input) expérience participative.
- [Anthropic — Responsible Scaling Policy v3.0](https://anthropic.com/responsible-scaling-policy/rsp-v3-0) où la Constitution est inscrite dans la pile RSP.
- [Anthropic — Measuring agent autonomy in practice](https://www.anthropic.com/research/measuring-agent-autonomy) Le rôle de la Constitution dans les déploiements à long terme.
