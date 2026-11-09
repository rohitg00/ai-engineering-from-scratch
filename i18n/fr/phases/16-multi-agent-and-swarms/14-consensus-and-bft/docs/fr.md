# Consensus et tolérance des agents à la faute byzantine

> Les systèmes classiques distribués BFT répondent aux LLM stochastiques.**CP-WBFT**(arXiv:2511.10400) pèse chaque vote par une enquête de confiance; **DecentLLMs**(arXiv:2507.14928) est sans leader avec des propositions parallèles de travailleurs et une aggregation géométrique-médiane; **WBFT**(arXiv:2505.05103) combine le vote pondéré avec le regroupement de structures hiérarchiques pour diviser les nœuds Core et Edge. Le résultat empirique honnête de "Peut-être les agents de l'IA sont d'accord?" (arXiv:2603.01213) est que même l'accord scalaire est fragile aujourd'hui  un seul agent trompeur peut compromettre un mélange d'agents. Le BFT est nécessaire mais pas suffisant. Cette leçon construit un protocole BFT minimal, injecte trois attaques spécifiques à l'agent (menton byzantin, conformité sycophantique, monoculture d'erreur corrélative) et mesure comment chaque variante de consensus fait face.

**Type:** Learn + Build
**Languages:** Python (stdlib), TypeScript
**Prerequisites:** Phase 16 · 07 (Society of Mind and Debate), Phase 16 · 13 (Shared Memory)
**Time:** ~75 minutes

## Problème

Vous avez N LLM agents qui produisent chacun une réponse. Ils ne sont pas d'accord. La majorité vote le mauvais parce que deux agents sont corrélés (le même modèle de base, les mêmes données de formation, les mêmes modes d'échec). Un troisième agent se trouve être faux d'une manière nouvelle  donc la majorité est une fausse majorité.

Maintenant, ajoutez un agent trompeur: il est intentionnellement. Ou un agent sycophantique: il est d'accord avec qui a parlé le dernier. Dans la BFT classique, l'hypothèse est que les nœuds byzantins sont une fraction.`f < n/3`La réalité de 2026 est que les nœuds LLM sont stochastiques même quand ils sont honnêtes, corrélés entre les modèles et influencés par les résultats de l'autre.

Le BFT classique (PBFT, 1999) n'est pas faux  il est incomplet. Il traite des détournements de bits arbitraires. Il ne traite pas "trois agents honnêtes partagent une hallucination parce qu'ils partagent des données de formation".

## Concept

### Ce que le BFT classique vous donne

La tolérance pratique à la faute byzantine (Castro et Liskov, OSDI 1999) tolère `f < n/3`Les nœuds byzantins. Le protocole a trois phases (préparation, préparation, engagement) et deux primitives (messages signés, certificats de quorum).`n >= 3f + 1`des nœuds honnêtes ou malveillants.

Les garanties sont solides mais supposent:

1. **Independent faults.**Les Byzantins ne se coordonnent pas.
2. **Honest nodes are truly honest.**La précision des résultats honnêtes n'est pas un problème; le protocole ne fait que régler les désaccords.
3. **The question has a ground-truth answer.**Un consensus sur un fait erroné est toujours un consensus.

Les agents de la LLM violent les trois. Deux agents qui utilisent le même modèle de base partagent des défauts. Un LLM "honnête" hallucine toujours. Et sur des questions ambiguës, la "vérité" est ce que les agents décident  il n'y a pas d'oracle externe.

### Les trois attaques spécifiques à la LLM

**Byzantine lie.**Un agent donne une réponse délibérément fausse.`f < n/3`- Je suis désolé .

**Sycophantic conformity.**Un agent lit les réponses des autres avant de voter et s'aligne avec celui qui a parlé le dernier.

**Correlated-error monoculture.**Trois agents partagent un modèle de base. Ils hallucinent la même réponse fausse. La majorité est fausse.

### Les réponses de 2025 à 2026

**CP-WBFT**(arXiv:2511.10400)  BFT pondéré à la confiance. Chaque électeur attache une sonde de confiance à sa réponse (une probabilité auto-déclarée ou une prédiction de modèle d'étalonnage séparé).

**DecentLLMs**Les agents de travail proposent en parallèle, les agents d'évaluation notent les propositions, la réponse finale est la médiane géométrique des positions notées.`f < n/2`- L'atténuation de: mensonge byzantin et erreurs corrélatives (la médiane géométrique est robuste à des valeurs étrangères et s'avance vers le grappillage dense, et non vers la moyenne modélisée).

**WBFT**(arXiv:2505.05103)  Pise BFT avec Clustering structure hiérarchique. Les poids des votes sont attribués par la qualité de réponse plus un score de confiance appris de l'histoire. Les agents de cluster dans le noyau et l'extrémité; les agents de noyau doivent obtenir le consensus d'abord, les agents de l'extrémité suivent. Atténuation pour: évolutivité (le consensus du noyau est petit et rapide) et partiellement pour la monoculture (le noyau peut être choisi pour la diversité).

### En empirie: " Les agents de l'IA peuvent-ils être d'accord ? "

Le document mesure l'accord scalaire (agents LLM se mettant d'accord sur une seule valeur numérique) sur plusieurs modèles frontaliers.

- Même sans adversaires, les agents de LLM ne sont pas d'accord sur les questions scalaires à des taux supérieurs à 30% sur de nombreux critères de référence.
- Un agent qui adopte une personnalité trompeuse peut retirer le consensus de mélange d'agents de 40 points de pourcentage de la ligne de base honnête.
- Les taux de désaccord sont corrélés à la diversité des modèles  les ensembles hétérogènes sont plus en désaccord que les ensembles homogènes (bien: erreurs non corrélatives) mais dérivent aussi plus lentement (mauvais: plus de temps pour l'accord).

Le résultat: BFT vous donne un dispositif pour aligner les sorties, mais il ne vous indique pas si la sortie alignée est correcte.

### Le protocole de base, dépouillé

Un tour BFT minimal pour les agents de LLM:

```
1. task arrives; each agent i produces answer a_i
2. each agent attaches confidence probe c_i in [0, 1]
3. aggregator collects (a_i, c_i) from all n agents
4. aggregator groups by semantic cluster (equivalent answers)
5. aggregator computes weight for each cluster C:
     w(C) = sum_{i in C} c_i
6. winner = cluster with max weight, if max > threshold * sum(c_i)
   else: retry or escalate
7. minority clusters logged with provenance for post-hoc audit
```

La phase de clustering sémantique est la tournure spécifique du LLM. Deux réponses "les rapports d'étude 4,2%" et "l'amélioration de 4,2%" sont le même cluster.

### Régularisation des seuils

Le `threshold`Paramètre décide quand accepter et quand réessayer. trop bas: vous acceptez les faibles majorités. trop haut: vous n'acceptez jamais rien.`n=5-7`Les agents, plus élevés pour les plus petits `n`En dessous d'un seuil, escaladez vers un humain ou un ensemble d'agents différents.

### Lorsque le consensus ne contribue pas

- **Ambiguous questions.**Si la question n'a pas de vérité fondamentale, le consensus est une opinion.
- **Compound questions.**"Écrivez un code et expliquez-le"  deux réponses.
- **Adversarial multi-round.**Si les agents peuvent observer les tours précédents et imiter (débat du 2023), ils commencent à s'entendre les uns avec les autres indépendamment de la vérité.

```figure
swarm-consensus-wave
```

## Faites-le

`code/main.py`les implémentations:

- `AgentVoter` une politique écrite avec (réponse, confiance).
- `MajorityVote` pluralité classique.
- `CPWBFT` vote pondéré par la confiance avec regroupement sémantique.
- `DecentLLMs` Aggrégation géométrique-médiane des propositions obtenues.
- `Scenario` exploite chaque agrégateur sous trois modèles d'attaque.

Modèles d'attaque mis en œuvre:

1. `byzantine`Un agent ment avec une grande confiance.
2. `sycophancy`Un agent copie la première réponse qu'il voit, avec la même confiance.
3. `monoculture`: trois agents partagent une réponse erronée (erreur corrélative) avec confiance modérée.

Je vais courir .

```
python3 code/main.py
npx tsx code/main.ts
```

Les résultats attendus: une table de (attaque, agrégateur) -> réponse finale, avec la réponse correcte mise en évidence. La pluralité échoue dans le cas de la monoculture. La pondération de confiance du CPWBFT atténue la sycophancy.

## Utilisez-le

`outputs/skill-consensus-designer.md`conçoit un protocole de consensus pour un ensemble multi-agents: méthode de regroupement, pondération, seuil et politique d'escalade pour les tours sous-seuils.

## La faire partir

Avant l'expédition de tout mécanisme de consensus:

- **Attack-test with at least the three patterns**Votre protocole devrait échouer de façon prévisible, pas silencieuse.
- **Log every minority cluster**Les groupes minoritaires sont votre système d'alerte précoce pour les erreurs corrélatives.
- **Enforce bounded rounds.**Pas de "continuer à débattre jusqu'à un accord" qui récompense la sycophancy.
- **Separate agreement from correctness.**La sortie de consensus est envoyée à un vérificateur; le vérificateur est indépendant de l'ensemble.
- **Monitor the agreement rate.**Une hausse rapide signifie un biais de conformité; une chute rapide signifie une dérive du modèle.

## Exercices

1. On court .`code/main.py`- Confirmer la pluralité échoue à l'attaque des monocultures, mais le CPWBFT l'atténue partiellement lorsque la confiance des monocultures est inférieure à 0,7.
2. Ajoutez un quatrième modèle d' attaque:**silent abstention** un agent refuse de répondre ("Je ne sais pas"). Comment chaque agrégateur doit-il traiter les abstentions?
3. S'il vous plaît modifier le clustering sémantique de la canonisation de chaîne à la simulation d'intégration (utilisez n'importe quel modèle d'intégration open source).
4. Lire CP-WBFT (arXiv:2511.10400). Mettre en œuvre l'étape d'étalonnage de la sonde de confiance (un modèle d'étalonnage séparé vérifie la confiance déclarée par chaque agent). Mesurer le gain de précision sur le scénario de monocultures.
5. Lisez " Les agents de l'IA peuvent-ils être d'accord ? " (arXiv:2603.01213). Reproduire une expérience simplifiée d'accord scalaire: trois agents, une question scalaire, la requête de la personne trompeuse.

## Les termes clés

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| BFT | "Byzantine fault tolerance" | Castro-Liskov 1999 protocol for consensus with `f < n/3` arbitrary faults. |
| Byzantine | "Any bad behavior" | A node that can lie, drop messages, fail silently — anything but crash safely. |
| Confidence probe | "How sure are you?" | Self-reported or calibrator-predicted probability attached to a vote. |
| Semantic clustering | "Same answer, different words" | Grouping equivalent answers before counting votes. |
| Geometric median | "Robust center" | The point minimizing sum of distances to sample points. Robust to outliers, unlike the mean. |
| Monoculture | "Same model, same failures" | Correlated errors when agents share training data or base model. |
| Sycophantic conformity | "Agreeing with the loud voice" | An agent's vote biases toward whoever spoke first/loudest. |
| Core/Edge | "Hierarchical BFT" | WBFT split: small Core consensus first, Edge nodes follow. Bounds latency. |

## Pour en savoir plus

- [Castro & Liskov — Practical Byzantine Fault Tolerance (OSDI 1999)](https://www.usenix.org/conference/osdi-99/practical-byzantine-fault-tolerance) la fondation
- [CP-WBFT — Confidence-Probe Weighted BFT](https://arxiv.org/abs/2511.10400) pondération des voix par confiance
- [DecentLLMs — leaderless multi-agent consensus](https://arxiv.org/abs/2507.14928) Aggrégation géométrique-médiane
- [WBFT — Weighted BFT with Hierarchical Structure Clustering](https://arxiv.org/abs/2505.05103) Split de base/extrémité pour une latence limitée
- [Can AI Agents Agree?](https://arxiv.org/abs/2603.01213) Fragilité des accords scalaires et attaque de personnes trompeuses
