# Des conceptions limitées pour améliorer soi-même

> La recherche s'est convergue sur quatre primitives pour délimiter une boucle d'amélioration de soi. Des invariants formels qui doivent être conservés à chaque édition. Anchures d'alignement qui ne peuvent être modifiées. Les contraintes multi-objectives dans lesquelles chaque dimension (sécurité, équité, robustesse) doit être maintenue, pas seulement la performance. Détection de régression qui arrête la boucle lorsque les métriques historiques suggèrent une perte de capacité. Aucun d'entre eux n'est une preuve de sécurité  résultats théoriques de l'information (complexité Kolmogorov, théorème de Lob) lié à ce que tout système peut prouver sur ses propres successeurs. Ce sont des atténuations qui augmentent le coût de l'échec silencieux.

**Type:** Learn
**Languages:** Python, TypeScript (stdlib, bounded-loop with invariant check)
**Prerequisites:** Phase 15 · 07 (RSI), Phase 15 · 04 (DGM)
**Time:** ~60 minutes

## Le problème

Le simulateur de course de la leçon 7 a montré que de petites différences de taux se combinent en de grands espaces. L'étude de cas DGM de la leçon 4 a montré que les boucles peuvent jouer activement leurs propres évaluateurs.

Le résumé de l'atelier ICLR 2026 RSI (openreview.net/pdf?id=OsPQ6zTQXV) identifie quatre de ces primitifs.

Les résultats théoriques de l'information lient ce que tout système peut prouver sur son successeur, et aucune conception actuelle ne ferme formellement le problème. Une boucle bien limitée est plus sûre qu'une boucle non limitée, pas sûre en termes absolus.

## Le concept

### Primitive 1: invariants formels

Une invariante est une propriété qui doit être conservée avant et après chaque auto-modification.

- La distribution des produits est conditionnée par un titre constitutionnel fixe (leçon 17).
- Aucun appel à l'outil ne va à un point final non autorisé.
- Les écrits de mémoire traversent un chemin signé.
- Le module hash de l'évaluateur correspond à la version approuvée.

Les invariables sont vérifiés par un code externe que la boucle ne peut pas modifier. Si une modification proposée viole une invariante, elle est rejetée.

La partie difficile consiste à choisir des invariants nécessaires à la sécurité et calculables dans un temps raisonnable.

### Primitive 2: ancres d'alignement

Une ancre d'alignement est une représentation immuable de l'objectif principal de la boucle, fixée à l'extérieur de la surface de modification de la boucle.

- Un texte constitutionnel (leçon 17) qui est chargé à partir d'un endroit réservé à la lecture à chaque invocation.
- Un évaluateur dans un référentiel séparé avec contrôle d'accès indépendant.
- Un manifeste d'autorisation d'outil signé par un humain et vérifié à nouveau à chaque cycle.

Le rôle de l'ancre est d'empêcher la dérive objective.

Le mode de défaillance subtile: une ancre que la boucle ne peut pas modifier peut toujours être réinterprétée par une boucle qui dérive dans la façon dont elle lit l'ancre. L'IA constitutionnelle (leçon 17) est explicitement fondée sur la raison pour gérer des situations nouvelles; cette couche de raisonnement est où l'interprétation dérive vit.

### Première étape 3: contraintes multiobjectives

Une boucle qui optimise un seul score scalaire trouvera des raccourcis. Une boucle qui doit satisfaire simultanément plusieurs contraintes dures a moins de raccourcis disponibles.

- Performance (indice de référence au niveau des tâches)
- Sécurité (évaluations par équipe rouge, taux de refus sur les mauvaises connaissances)
- L'équité (limites d'impact différent pour les sous-groupes sensibles)
- Robustesse (ensemble de tests OOD, manipulation des entrées adverses)

Une modification n'est acceptée que si toutes les contraintes sont valides. Le gouverneur des coûts de la leçon 13 l'emporte sur des contraintes financières.

### Primo 4: détection de régression

Les scores de chaque cycle sont comparés à des distributions historiques. Une chute au-delà de la tolérance configurée arrête la boucle. Cela attire une perte de capacité silencieuse qui serait autrement absorbée dans la moyenne en cours de fonctionnement à mesure que la boucle l'améliore.

Une mise en œuvre pratique: stocker les scores par tâche des derniers cycles N. Chaque nouveau cycle compute un delta par tâche. Si un delta tombe en dessous d'un seuil, le cycle est rejeté et une revue humaine est effectuée.

### Limits théoriques de l'information

La complexité de Kolmogorov et le théorème de Lob fixent des limites supérieures à ce qu'un système peut prouver sur lui-même. La machine formelle de Godel de Schmidhuber (leçon 4) visait à la plus haute limite de ce type; personne n'a terminé une preuve non triviale. Le résultat de Lob dit: si un système croit prouvablement " Je ferai X si je prouve que je devrais faire X ", il fera X sans prouver qu'il le devrait, un échec bien connu en matière d'auto-références.

La conséquence pour nos primitifs: ils ne peuvent pas fermer le problème de sécurité. Ils rendent l'échec silencieux plus coûteux. Une boucle malveillante ou dérivé qui contournerait tranquillement un chèque manquant doit maintenant activement saper un explicite, qui est une signature plus détectable.

### Un exemple bien réussi

Supposons qu'un agent propose une modification.

1. Vérifie invariable: hashes de module, manifeste d'autorisation d'outil, en-tête constitutionnel.
2. Vérifie de l'ancrage: l'énoncé objectif correspond à la version approuvée (en termes de octets ou de semantiques).
3. Évaluation multi-objectif: axes de performance, de sécurité, d'équité et de robustesse.
4. Détection de régression: aucun axe ne tombe plus que la tolérance.

Les quatre doivent passer pour que la modification atterrisse.

```figure
bounded-gates
```

## Utilisez-le

`code/main.py`La démonstration est que chaque primitive capture une classe de défaillance spécifique, et que la suppression de l'une d'entre elles permet à cette classe de défaillance de passer.

## La faire partir

`outputs/skill-bounded-loop-review.md`Il examine une boucle limitée proposée et note laquelle des quatre primitives qu'il implique réellement par rapport aux revendications.

## Exercices

1. On court .`code/main.py`Confirmez que la boucle s'améliore sur la métrique primaire sans laisser le pirate gagner.

2. Désactiver la détection de régression. Construire une entrée où cela conduit à une perte de capacité silencieuse acceptée.

3. Désactivez la contrainte multiobjectif. Affichez la convergence de la boucle sur l'axe de performance alors qu'un axe de sécurité tombe.

4. Conçonnez un ancrage d'alignement pour un agent de codage.

5. Lisez le résumé de l'atelier RSI ICLR 2026 et choisissez l'une des quatre primitives et proposez une amélioration concrète de l'état actuel de l'art.

## Les termes clés

| Term | What people say | What it actually means |
|---|---|---|
| Invariant | "Always-true property" | A property checked by external code before and after every edit |
| Alignment anchor | "Pinned objective" | Immutable core-goal representation outside the loop's edit surface |
| Multi-objective constraint | "All axes must hold" | Performance, safety, fairness, robustness — all required |
| Regression detection | "Pause on drop" | Pause the loop when historical metric deltas suggest capability loss |
| Kolmogorov bound | "Information-theoretic limit" | Limits what a system can prove about its own successor |
| Lob's theorem | "Self-reference trap" | System can act on "I should" without proving it should |
| Gate stack | "Layered check" | Multiple primitives combined; any failure rejects the edit |
| Bounded improvement | "Mitigation, not proof" | Raises silent-failure cost; does not close the safety problem |

## Pour en savoir plus

- [ICLR 2026 RSI Workshop summary (OpenReview)](https://openreview.net/pdf?id=OsPQ6zTQXV) la convergence des quatre primitifs.
- [Anthropic Responsible Scaling Policy v3.0](https://anthropic.com/responsible-scaling-policy/rsp-v3-0) seuils de capacité multiobjectifs.
- [DeepMind Frontier Safety Framework v3](https://deepmind.google/blog/strengthening-our-frontier-safety-framework/) le suivi de l'alignement trompeur comme un primitif invariant.
- [Schmidhuber (2003). Godel Machines](https://people.idsia.ch/~juergen/goedelmachine.html) l'ancêtre formel-prouvé de ces primitifs.
- [Anthropic — Claude's Constitution (January 2026)](https://www.anthropic.com/news/claudes-constitution) l'ancre d'alignement fondé sur la raison.
