# AlphaEvolve  Agents de codage évolutionnistes

> Associer un modèle de codage frontalier avec une boucle évolutionnaire et un évaluateur vérifiable par machine. Laissez la boucle fonctionner assez longtemps. Il découvre une procédure de multiplication de matrice complexe 4x4 qui utilise 48 multiplication escalare  la première amélioration sur Strassen en 56 ans. Il trouve également une heuristique de planification Borg à l'échelle de Google qui récupère ~ 0,7% du calcul de cluster en production. L'architecture est ennuyeuse à dessein. Les gains viennent de la rigueur de l'évaluateur.

**Type:** Learn
**Languages:** Python, TypeScript (stdlib, evolutionary-loop toy)
**Prerequisites:** Phase 15 · 01 (long-horizon framing), Phase 15 · 02 (self-taught reasoning)
**Time:** ~60 minutes

## Le problème

Les grands modèles de langage peuvent écrire du code. Les algorithmes évolutionnaires peuvent rechercher sur le code. Les deux ont été testés séparément pendant des décennies; les deux ont atteint des plafonds. Le plafond du LLM est une confabulation: le modèle écrit un code plausible qui ne fait pas ce qu'il prétend. Le plafond évolutionnaire est le coût de recherche: les mutations aléatoires sur la syntaxe produisent rarement des programmes compilables, encore moins de meilleurs.

AlphaEvolve (Novikov et coll., DeepMind, arXiv:2506.13131, juin 2025) les combine. Le LLM propose des modifications ciblées à une base de données de programmes; un évaluateur automatique note chaque variante; les variantes à haut score deviennent des parents pour les générations futures. Le LLM gère la étape coûteuse d'écrire du code plausible; l'évaluateur capture les confabulations.

Les résultats rapportés: 48-scalar-multiplication 4x4 matrice complexe de multiplication (la limite de 1969 de Straßsen était 49), une heuristique de planification Borg dans la production de Google, un 32,5% FlashAttention accélération du noyau, améliorations de la capacité de formation de Gémeaux.

L'architecture fonctionne parce que l'évaluateur est vérifiable par machine. Elle ne fonctionne pas là où l'évaluateur n'est pas. Cette asymétrie est la leçon.

## Le concept

### La boucle

1. Commencez par un programme de semence `P_0`C'est vrai, mais pas optimal.
2. Maintient une base de données de programmes variants, chacun marqué par l'évaluateur.
3. Prenez l'échantillon d'un ou plusieurs parents de la base de données (à la mode MAP-elites ou à l'échelle des îles).
4. Faites appel au LLM (Gemini Flash pour de nombreux candidats, Gemini Pro pour les plus difficiles) pour produire une variante modifiée du parent.
5. Compiler, exécuter et évaluer la variante sur l'évaluateur de retard.
6. Insérer dans la base de données en fonction de son score et de son vecteur de fonctionnalités.
7. Je répète.

Deux détails sont importants. Premièrement, le LLM est invité à plus que le programme parent  généralement plusieurs variantes supérieures de la base de données, plus la signature de l'évaluateur, plus une brève description de tâche. Le travail du modèle est de proposer un changement ciblé qui pourrait améliorer le score. Deuxièmement, la base de données est structurée (réseau de MAP-élites, basée sur l'île) de sorte que la boucle explore la diversité, pas seulement le leader actuel.

### Ce qui rend l'évaluateur non négociable

Les victoires d'AlphaEvolve proviennent de domaines où l'évaluateur est rapide, déterministe et difficile à jouer:

- **Matrix multiplication algorithm**: un test unitaire qui multiplie les matrices et vérifie l'égalité par bits identiques.
- **Borg scheduling heuristic**: un simulateur de qualité de production qui reproduit la charge historique du groupe et mesure les calculs gaspillés.
- **FlashAttention kernel**: un test de précision plus une référence de l'horloge murale sur le matériel réel.
- **Gemini training throughput**: mesurées en GPU-seconde par étape.

Dans chaque cas, l'évaluateur détecte la classe d'erreurs LLM qui domineraient autrement: revendications de précision confabulates, revendications de performance qui disparaissent sur le matériel et défaillances de bord.

### Le piratage des récompenses est l'autre face de cette déclaration

L'évolution optimise pour tout ce que l'évaluateur mesure. Si l'évaluateur est imparfait, la boucle trouvera l'imperfection. Dans un domaine non vérifié, la boucle optimiserait pour la caractéristique de surface, et non le comportement prévu. DeepMind indique explicitement dans le document: les succès d'AlphaEvolve ne se transférent que dans des domaines où la rigueur de l'évaluateur correspond à l'ambition de la recherche.

Exemples concrets de piratage des récompenses dans les boucles de recherche de code de 2025 à 2026:

- Les objectifs d'optimisation qui récompensent le "temps de terminer" sont récompensés par la soumission de solutions vides.
- Les scores de référence qui récompensent les tests de précision sous test récompensés par les tests de mémorisation et les tests de surcodage.
- Un proxy de "qualité du code" récompense en supprimant les commentaires et en réécrivant les noms des variables, sans changement sémantique.

La solution dans AlphaEvolve: envoyer un évaluateur qui a été retenu par le LLM, avec des entrées générées au moment de l'évaluation.

### Pourquoi la recherche LLM + bat soit seule

Le LLM peut produire des modifications comptables et sémantiquement plausibles. Une mutation aléatoire GA sur un fichier Python de 2000 lignes produit presque toujours des erreurs de syntaxe. Le LLM concentre également la recherche sur des quartiers plausibles (changer une fonction, pas des octets aléatoires) ce qui réduit considérablement les appels d'évaluateurs gaspillés.

L'évaluateur, à son tour, capture les confabulations du LLM.$O(n \log n)$Dans la limite " quand c'est vraiment $O(n^2)$; une référence de l'horloge murale permet de résoudre la question.

### Où AlphaEvolve s' inscrit dans la pile de frontière

| System | Generator | Evaluator | Domain | Example win |
|---|---|---|---|---|
| AlphaEvolve | Gemini | correctness + benchmark | algorithms, kernels, schedulers | 48-mul 4x4 matmul |
| FunSearch (DeepMind, 2023) | PaLM / Codey | correctness | combinatorial math | cap-set lower bounds |
| AI Scientist v2 (Sakana, L5) | GPT/Claude | LLM critique + experiment | ML research | ICLR workshop paper |
| Darwin Godel Machine (L4) | agent scaffolding | SWE-bench / Polyglot | agent code | 20% → 50% SWE-bench |

Les quatre sont des variations sur la même recette: générateur plus évaluateur, boucle.

```figure
alphaevolve-loop
```

## Utilisez-le

`code/main.py`Le "LLM" est un proxy stdlib qui propose de petites mutations syntactiques à un programme qui compute une fonction cible.

Regardez !

- Comment le meilleur score s'améliore au fil des générations.
- Comment une grille de MAP-Elites maintient des solutions diverses en vie pour que la boucle ne converge pas sur un minimum local.
- Comment enlever le test prolongé (évaluateur de formation seulement) permet de surcharger la boucle de façon spectaculaire.

## La faire partir

`outputs/skill-evaluator-rigor-audit.md`est la condition préalable pour envisager une boucle de style AlphaEvolve dans un nouveau domaine: votre évaluateur détecte-t-il réellement les défaillances qui vous intéressent ?

## Exercices

1. On court .`code/main.py`- Notez la meilleure trajectoire de score.`--no-holdout`) et de refaire.

2. Lisez la section 3 du document AlphaEvolve sur la grille MAP-Elites.

3. Le résultat 48-multiplication 4x4 s'est amélioré sur la limite de 49-mul de Strassen après 56 ans. Lisez l'annexe F du document et expliquez en trois phrases pourquoi l'évaluateur pour ce problème est particulièrement facile à obtenir correctement, et pourquoi la plupart des domaines ne le sont pas.

4. Proposez un domaine où AlphaEvolve échouerait, identifiez exactement où l'évaluateur se casse et pourquoi.

5. Pour un domaine que vous connaissez, écrivez la signature de l'évaluateur que vous utiliserez. Incluez (a) les conditions de correction, (b) la métrique de performance, (c) la règle de génération de données de saisie retenue, (d) au moins une vérification anti-hacking de récompense.

## Les termes clés

| Term | What people say | What it actually means |
|---|---|---|
| AlphaEvolve | "DeepMind's evolutionary coding agent" | Gemini + program database + machine-checkable evaluator |
| MAP-elites | "Diversity-preserving archive" | Grid keyed by feature vectors; each cell holds the best variant with that descriptor |
| Island model | "Parallel evolution subpopulations" | Independent populations that migrate periodically; prevents premature convergence |
| Machine-checkable evaluator | "Deterministic oracle" | A unit test, simulator, or benchmark the LLM cannot fake — a prerequisite for this loop |
| Reward hacking | "Optimizing the measure, not the goal" | Loop finds a way to maximize score without doing the intended task |
| Seed program | "The starting point" | An initial correct-but-suboptimal program the loop evolves from |
| Held-out evaluator | "Evaluation data the LLM never saw" | Inputs generated at evaluation time to prevent memorization |

## Pour en savoir plus

- [Novikov et al. (2025). AlphaEvolve: A coding agent for scientific and algorithmic discovery](https://arxiv.org/abs/2506.13131)- Le papier complet.
- [DeepMind blog on AlphaEvolve](https://deepmind.google/blog/alphaevolve-a-gemini-powered-coding-agent-for-designing-advanced-algorithms/) répertorier le fournisseur avec les résultats.
- [AlphaEvolve results repository](https://github.com/google-deepmind/alphaevolve_results) des algorithmes découverts, y compris le matmul 4x4 à 48 moul.
- [Romera-Paredes et al. (2023). Mathematical discoveries from program search with LLMs (FunSearch)](https://www.nature.com/articles/s41586-023-06924-6) le système prédécesseur.
- [Anthropic — Responsible Scaling Policy v3.0 (Feb 2026)](https://anthropic.com/responsible-scaling-policy/rsp-v3-0) définit l'autonomie liée aux évaluateurs comme une direction de recherche clé.
