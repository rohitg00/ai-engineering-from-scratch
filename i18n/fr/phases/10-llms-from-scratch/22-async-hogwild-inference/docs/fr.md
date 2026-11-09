# Async et Hogwild !

> Le décoding spéculatif (phase 10 · 15) parallèle les jetons dans une séquence. Les cadres multi-agents se parallèlementent sur des séquences entières mais forcent une coordination explicite (voting, division des sous-tâches). Il est mort. L'inference (Rodionov et coll., arXiv:2504.06261) fait autre chose: exécute N instances du même LLM en parallèle contre un cache de valeur de clé SHARED. Chaque travailleur voit instantanément les jetons générés par les autres. Les modèles de raisonnement modernes  QwQ, DeepSeek-R1  peuvent s'auto-coordonner à travers ce cache partagé sans aucune mise à jour fine. L'approche est expérimentale mais elle ouvre un tout nouveau axe de parallélisme d'inférence qui se trouve orthogonal au décodeur de spécifications. Cette leçon met en œuvre un Hogwild à deux ouvriers ! C'est un simulateur en stdlib Python et explique pourquoi la collaboration partagée en cache émerge des capacités de raisonnement du modèle existant.

**Type:** Build
**Languages:** Python (stdlib), Rust
**Prerequisites:** Phase 10 · 12 (inference optimization), Phase 10 · 15 (speculative decoding)
**Time:** ~60 minutes

## Objectifs d'apprentissage

- Décrivez les trois topologies communes parallèles de la LLL (voting, sub-task, Hogwild!) et nommez les problèmes qui concernent chacun des objectifs.
- Décrivez la configuration de base de Hogwild: plusieurs travailleurs, un cache KV partagé, coordination émergente via l'auto-invitation.
- Calculer l'accélération du temps de la paroi de Hogwild ! en fonction du nombre de travailleurs `N`, parallélisme au niveau des tâches `p`, et les frais généraux de coordination `c`- Je suis désolé .
- Mettez en place un simulateur Hogwild! à deux ouvriers sur un problème de jouet et observez la division des tâches émergentes.

## Le problème

Les LLM modernes résolvent des problèmes difficiles en produisant de longues chaînes de raisonnement  5000 jetons de logique étape par étape est courant, des dizaines de milliers de jetons se produisent sur des problèmes mathématiques profonds. À 35 jetons / seconde décode sur un modèle 70B, 50k jetons est de 24 minutes.

Le décoding spéculatif (phase 10 · 15) vous donne un accélération de 3-5x en parallélisant dans une séquence.

La question évidente: pouvons-nous paralléliser les séquences ? Exécuter plusieurs copies du même modèle sur le même problème, les laisser coopérer, les faire partager le travail ?

Les travaux antérieurs: ensembles de vote (exécuter des modèles N, choisir la réponse majoritaire), arbres de pensée (roues de raisonnement des branches et recombiner), et cadres multi-agent (attribuer à chaque agent une sous-tasque, utiliser un coordonnateur). Tous ceux-ci aident dans des domaines de tâches spécifiques. Ils introduisent également une machine de coordination explicite  règles de vote, logique branche-et-prune, protocoles de messagerie agent-agent.

Il est mort. L'inference adopte une approche différente. N travailleurs partagent un seul cache KV. Chaque travailleur voit immédiatement les jetons générés par chaque autre travailleur, comme s'ils étaient son propre contexte. Les travailleurs  sans formation ni ajustement  trouvent comment diviser le travail. Les modèles de raisonnement modernes (QwQ, DeepSeek-R1, mode de raisonnement de famille Claude) peuvent lire le cache partagé et dire des choses comme "Je vois que le travailleur 2 a déjà géré le cas de base, alors je vais travailler sur l'étape inductive".

La vitesse est dépendante de la charge de travail et expérimentale à partir d'avril 2026. Mais l'idée vaut la peine d'être connue car elle ouvre un nouvel axe de parallélisme d'inférence.

## Le concept

### Le réglage

Initializer N processus de travail, tous exécutant le même LLM. Au lieu de KV caches par travailleur, maintenir un caché partagé.`i`génère des jetons `t_j`, le jeton est écrit dans le cache partagé à la position suivante.`k`Il est donc possible de faire une analyse de la situation actuelle du cache (qui comprend tout ce que tous les travailleurs N ont généré jusqu'à présent).

Au moment de la mise en marche, les travailleurs se précipitent pour écrire des jetons. Il n'y a pas d'index de position par travailleur.

### Pourquoi la coordination est nécessaire

Les ouvriers partagent une demande. Généralement quelque chose comme "Vous êtes l'une des N instances travaillant ensemble sur ce problème. Chaque instance lit la mémoire partagée et peut voir ce que les autres instances ont écrit. Évitez les travaux redondants. " Le prompt plus le cache partagé suffisent. Les modèles de raisonnement lisent le cache, notent quelles parties du problème ont déjà été tentées et (souvent mais pas toujours) tournent vers des parties inexplorées.

Le document Hogwild! (Rodionov et coll., 2025) rapporte des observations comme:

- Les travailleurs formulent des plans et les communiquent à d'autres travailleurs via le cache.
- Les travailleurs remarquent des erreurs dans le raisonnement des autres travailleurs et les dénoncent.
- Les travailleurs s'adaptent lorsqu'un plan échoue et proposent des alternatives.
- Quand on leur demande de vérifier si une personne a été licenciée, ils la détectent et se tournent.

Le comportement émergent provient des capacités de raisonnement que le modèle possède déjà.

### Le nom

Le nom du papier se réfère à Hogwild! SGD (Recht et coll., 2011), un optimisateur de mise à jour asynchrone. L'analogie: les travailleurs asynchrones de SGD écrivent tous à un vecteur de paramètres partagé; Hogwild!

### La RoPE rend cette méthode traitable.

Les embellissements de position rotative (RoPE, Su et al. 2021) encode les informations de position par rotation dans les vecteurs Q et K. Parce que le score d'attention entre une requête tournée et une clé tournée dépend uniquement de leur distance relative, un bloc entier d'entrées cachées peut passer à un nouveau décalage sans recompte: tourner la requête au lieu de re-roter chaque clé caché. Il est mort. Inference le fait une fois par bloc de cache: pour une requête à position `i_q`et un bloc qui commence à `i_k`Pour ce travailleur, la requête est rotée par la distance relative `i_q - i_k`C'est ainsi que chaque travailleur voit les blocs de cache partagés dans son propre ordre. Le truc fonctionne pour un déplacement uniforme d'un bloc contigu. déplacer des jetons individuels vers différentes positions changerait leurs rotations et nécessiterait toujours un recomptage.

Dans un modèle de position apprise ou de position absolue, Hogwild! aurait besoin d'invalider le cache sur chaque écriture simultanée.

### Mathématiques par temps

Je vous laisse .`T_serial`Il est donc important que les travailleurs soient prêts à résoudre le problème seuls.`p`soit la fraction parallèle au niveau de la tâche.`c`être le coût de coordination par étape (lecture du cache étendu, décision de ce qu'il faut écrire).

Temps de travail à titre monoparental: `T_serial`- Je suis désolé .
N-travailleur Hogwild! temps, si la coordination est libre: `T_serial * ((1 - p) + p / N)`- C'est un Amdahl classique.
Avec coordonnées générales: `T_serial * ((1 - p) + p / N) + c * steps_per_worker`- Je suis désolé .

Pour qu'un travailleur soit productif,`c`Les modèles de raisonnement qui produisent plus de 5k tokens peuvent se permettre des centaines de tokens de coordination et encore sortir en avant.

### Exemple concret

Le problème de la raison: 10 000 jetons de chaîne de pensée.`p = 0.7`contenu parallèle (stratégies de preuve différentes, analyses de cas différentes) et `c = 200`Les coûts généraux de coordination par travailleur sont indiqués.`N = 4`les travailleurs:

- Temps de série: 10000 étapes de décode.
- Temps de Hogwild: 10000 * (0,3 + 0,7 / 4) + 200 * 4 = 10000 * 0,475 + 800 = 5550 étapes de décode.
- Accélération: 10000 / 5550 = 1,8x.

C'est modeste. Mais sur des problèmes de raisonnement plus longs (50k tokens), le coordonné dépense amorti et la vitesse de poussée 2.5-3x. Hogwild! est l'équivalent d'inférence de parallélisme au niveau des fils dans un langage qui vous permet d'écrire du code multi-thread naturellement.

### Quand atteindre Hogwild !

- Problèmes de raisonnement longs (mille de jetons) où la tâche peut être parallélisée à travers des sous-objectifs indépendants.
- Les modèles raisonnables qui ont été formés à penser étape par étape.
- Les déploiements à n'importe quel nœud avec suffisamment de VRAM pour contenir le cache partagé plus N processus de travail. Le cache est partagé, mais chaque travailleur a sa propre mémoire d'activation.

### Quand ne pas faire

- Une courte conversation interactive, la coordination est la principale.
- Les tâches qui ne sont pas parallèles (prouvante linéaire unique, compilation unique). N = 1 est le maximum.
- Des modèles non raisonnables, aucune coordination n'apparaît.
- Les déploiements multi-nœuds. Le cache partagé a besoin d'une synchronisation très rapide entre les travailleurs. L'intranœud est bien; le cross-nœud est un désastre de latence.

### Le statut expérimental

En avril 2026, Hogwild! est une méthode de recherche avec une mise en œuvre PyTorch open source.

1. La gestion partagée du cache KV sur des processus concurrents est un ingénierie non triviale.
2. La coordination émergente est fonction de la tâche; des critères de référence sont encore en cours de construction.
3. Les accélérations sont modestes par rapport à ce que le décoding spéculatif offre déjà, et les deux peuvent être combinés mais l'ingénierie combinée est une autre couche.

Ça vaut la peine d'être connu, d'expérimenter, mais pas encore de parier sur un produit.

```figure
continuous-batching
```

## Faites-le

`code/main.py`Il utilise un simulateur de jouets Hogwild !

- Deux processus de travail, chacun un "LLM" déterministe qui produit une des plusieurs catégories de jetons (work-token, observe-token, coordonné-token) avec des probabilités connues.
- Un cache partagé (uniquement une liste de jetons) que les deux travailleurs lisent et écrivent.
- Une logique de coordination simple: lorsqu'un travailleur voit que l'autre travaille déjà assez de jetons de travail dans une catégorie, il choisit une autre catégorie.

Le simulateur fonctionne pour un budget fixe et rapporte:

- Total des jetons de travail produits.
- Temps total de paroi (nombre d'étapes des travailleurs).
- Accélération efficace sur un seul travailleur.
- Une trace de qui a écrit quel symbole.

### Étape 1: le cache partagé

Une liste à laquelle les deux travailleurs s'ajoutent.`threading.Lock`) dans une mise en œuvre réelle; nous simulons avec un compteur.

### Étape 2: la boucle de travail

Chaque travailleur, à chaque étape:

- Il lit le cache partagé actuel.
- Décide de quelle catégorie de jeton écrire en fonction de ce qui existe déjà.
- Il écrit un jeton.

### Étape 3: l'héuristique de coordination

Si la catégorie X a déjà des jetons K dans le cache et que la catégorie prévue du travailleur est X, le travailleur passe à la catégorie Y. Il s'agit d'un jouet remplaçant le comportement du modèle de raisonnement de " remarquez que cela est déjà couvert, faites autre chose à la place ".

### Étape 4: accélération mesurée

Exécutez le simulateur avec N=1 ouvrier et avec N=2 ouvriers, même budget total de étape.

### Étape 5: mettre l'accent sur la coordination

Réduire la sensibilité de l'héuristique de coordination. Retournez. Observez que sans bonne coordination, N=2 produit redondamment les mêmes jetons et que l'accélération tombe en dessous de 1.

## Utilisez-le

L'intégration de Hogwild! en production à partir d'avril 2026 est de qualité de recherche.

Voie d'adoption pragmatique:

1. Profiliser votre charge de travail de travail de raisonnement. Mesurer la fraction de jetons qui sont exploratoires (stratégies multiples, analyses de cas, recherche) vs linéaire.
2. Si l'exploration domine, faites une expérience Hogwild à deux ouvriers.
3. Si l'amélioration est inférieure à 1,3 fois, vous êtes dans le régime de coordination dominé.
4. Si l'amélioration est supérieure à 1,5x, appuyez sur N=4 et mesurez à nouveau.

Combinez avec le décodeur spéculatif: chaque travailleur de Hogwild! peut utiliser indépendamment le décodeur de spécifications. Les deux accélérations se multiplient (environ), ce qui porte un décodeur de spécifications de 3x et un décodeur de Hogwild! de 1,8x à un décodeur efficace de 5,4x par rapport au décodeur de travail simple naïf.

## La faire partir

Cette leçon produit `outputs/skill-parallel-inference-router.md`. Compte tenu d'un profil de charge de travail de raisonnement (budget de jeton, profil de parallélisme de tâche, famille de modèles, cible de déploiement), il se dirige entre les stratégies de vote, de pensée, multi-agent, Hogwild! et de décoding spéculatif.

## Exercices

1. On court .`code/main.py`Confirmez que la configuration N=2 Hogwild! produit plus de jetons de travail que la ligne de base N=1 dans le même temps de paroi.

2. Réduire la force de l'heuristique de coordination (ensemble `coordination_weight=0.1`Rééduquez, montrez que le speedup s'effondre, expliquez pourquoi: les travailleurs dupliquent leurs efforts lorsqu'ils ne peuvent pas se coordonner.

3. Calculez l'accélération de Hogwild ! attendue pour une tâche de raisonnement de 50k-token avec `p=0.8, c=500`Faites la même chose pour une tâche de chat de 1k-token avec `p=0.3, c=200`Pourquoi l'un est une victoire et l'autre une perte ?

4. Lisez la section 4 (évaluation préliminaire) du document Hogwild! Identifiez les deux modes d'échec rapportés par les auteurs.

5. Combinez Hogwild! avec le décoding spéculatif dans le jouet: chaque travailleur utilise un décode spécifique à 2 jetons à l'intérieur. Rapportez l'accélération multiplicative. Quel problème de comptabilité se pose lorsque deux travailleurs veulent tous deux étendre le même préfixe de cache partagé?

## Les termes clés

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| Hogwild! | "Parallel workers, shared cache" | N instances of the same LLM running concurrently with one shared KV cache; emergent coordination via self-prompting |
| Shared KV cache | "The coordination medium" | A single growing KV buffer that all workers read and write; enables instant token visibility across workers |
| Emergent coordination | "No training needed" | Reasoning-capable LLMs can read the shared cache and divide work without any fine-tuning or explicit protocol |
| Coordination overhead (c) | "Tokens spent orienting" | The per-worker cost of reading the extended cache and deciding what to do; must stay small vs total decode time |
| Parallelizable fraction (p) | "What can run in parallel" | Task-level parallelism: the fraction of the total work that is not intrinsically sequential |
| RoPE enables Hogwild! | "Rotary positions are shift-invariant" | Because positions are rotations, writing into a shared cache does not require recomputing prior tokens |
| Voting ensemble | "Run N, pick the majority" | The simplest parallel inference topology; useful for classification, less for long-form reasoning |
| Tree of thought | "Branch and prune" | Reasoning strategy that explores multiple branches and prunes; explicit coordination logic |
| Multi-agent framework | "Assign sub-tasks" | Each agent gets a role; a coordinator orchestrates; heavy protocol overhead |

## Pour en savoir plus

- [Rodionov et al. — Hogwild! Inference: Parallel LLM Generation via Concurrent Attention (arXiv:2504.06261)](https://arxiv.org/abs/2504.06261) le document Hogwild!, évaluation préliminaire de QwQ et de DeepSeek-R1
- [Recht, Re, Wright, Niu — Hogwild!: A Lock-Free Approach to Parallelizing Stochastic Gradient Descent (arXiv:1106.5730, NeurIPS 2011)](https://arxiv.org/abs/1106.5730) le Hogwild original !, l'origine du nom
- [Su et al. — RoFormer: Enhanced Transformer with Rotary Position Embedding (arXiv:2104.09864)](https://arxiv.org/abs/2104.09864) RoPE, la propriété qui rend traitable l'inférence partagée
- [Yao et al. — Tree of Thoughts: Deliberate Problem Solving with Large Language Models (arXiv:2305.10601)](https://arxiv.org/abs/2305.10601) la stratégie de raisonnement de l'arbre de pensée Hogwild! est orthogonale à
- [Leviathan et al. — Fast Inference from Transformers via Speculative Decoding (arXiv:2211.17192)](https://arxiv.org/abs/2211.17192) décoding spéculatif, le parallélisme interne de séquence Hogwild!
- [Hogwild! reference PyTorch implementation](https://github.com/eqimp/hogwild_llm) la seule source de vérité pour les expériences du journal
