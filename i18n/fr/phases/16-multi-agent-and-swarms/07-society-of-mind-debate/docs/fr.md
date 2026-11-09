# La société de l'esprit et le débat multi-agents

> La prémisse de Minsky de 1986  intelligence est une société de spécialistes  est redécouverte chaque décennie. En 2023, Du et al. l'ont transformé en un algorithme concret: plusieurs instances de LLM proposent des réponses, lisent les réponses, critiquent et mettent à jour les unes les autres. Au cours de N tours, ils convergent sur un consensus qui bat la CoT à zéro coup et la réflexion sur six tâches de raisonnement et de factualité. Deux résultats sont importants: les deux **multiple agents**et **multiple rounds**La société est plus forte qu'un monologue à un seul agent, l'échange à plusieurs tours est plus fort qu'un vote à un seul coup.

**Type:** Learn + Build
**Languages:** Python (stdlib), TypeScript
**Prerequisites:** Phase 16 · 04 (Primitive Model)
**Time:** ~60 minutes

## Problème

L'auto-consistance  échantillonnez un modèle plusieurs fois et prenez la réponse majoritaire  est l'amélioration de raisonnement la moins chère que vous pouvez suivre. Elle fonctionne, mais elle se saturera rapidement. Vous pouvez doubler vos échantillons et ne pas voir un autre saut significatif.

Le débat brise la saturation. Au lieu de N échantillons indépendants d'un modèle, N agents lisent les raisonnements et réviser les uns des autres. La corrélation entre les échantillons diminue (ils ne sont plus i.i.d.), et le point de convergence est souvent correct où le vote i.i.d était en toute confiance erroné.

## Concept

### L'algorithme du Du et al. 2023

Le rapport de référence est le résultat de l'analyse de l'impact de l'exploitation sur les ressources humaines.

1. Chacun des N agents produit une réponse initiale à la question.
2. Pour la ronde r = 2..R: chaque agent est montré les réponses de r-1 des autres agents et demandé "en tenant compte de ces, donnez votre réponse mise à jour".
3. Après les ronde R, votez à la majorité les réponses finales.

Les tests papier sur MMLU, GSM8K, biographies, MATH et références factuelles.

### Deux boutons indépendants

Ablations du même document:

- **Agent count alone**Le nombre de personnes qui ont été affectées par les travaux de la Commission est de 0,5% en fonction des besoins de la Commission.
- **Round count alone**1 agent qui voit son propre raisonnement préalable) aide à peine à la faiblesse connue de la réflexion.
- **Both together**L'échange multi-rounds entre plusieurs agents conduit au gain.

### Pourquoi ça marche ?

Deux mécanismes:

1. **Exposure to disagreement.**Lorsqu'un agent voit la chaîne de raisonnement d'un autre agent avec une conclusion différente, il doit soit justifier ou mettre à jour.
2. **Correlated error reduction.**En auto-cohérence, tous les échantillons proviennent du même modèle, de sorte que les erreurs corrélent  vous moyenne dans une réponse en toute confiance.

### Débat hétérogène

A-HMAD et les suivis connexes utilisent *modèles de base différents* pour différents agents. Le débat Llama + Claude + GPT réduit l'effondrement de la monoculture (leçon 26) parce que les erreurs corrélatives d'une famille de modèles ne sont pas partagées par les autres.

L'inconvénient: un modèle faible participant à un débat peut entraîner le consensus vers sa mauvaise réponse (voir " Devrions-nous devenir fous ? ", arXiv:2311.17371).

### NLSOM  l'extension 129-agent

Zhuge et al. ("Mindstorms in Natural Language-Based Societies of Mind", arXiv:2305.17066) ont étendu cette idée à 129 sociétés membres.

### Mode d'échec

- **Sycophancy cascade.**Tous les agents se délaissent à ce qui semble le plus confiant. Le débat s'effondre à la voix la plus forte.
- **Topic drift.**Les débats sur plusieurs tours dérivent de la question initiale.
- **Compute blowup.**N agents × R ronds = N·R LLM appels, chacun avec un contexte qui croît. Un débat de 5 agents, 5 ronds est de 25 appels dans un contexte croissant. Le coût par question peut dépasser 10 fois un seul appel CoT.

```figure
multi-agent-debate
```

## Faites-le

`code/main.py`Il y a un débat de 3 agents × 3 rondes sur une question mathématique où chaque agent commence avec une réponse différente (peut-être fausse).

La démo montre deux effets clés:

- Une seule ronde d'échange rapproche les agents de la bonne réponse.
- Les tours supplémentaires après le second tour montrent des rendements diminuant (matches du plateau de Du et al.).

Je vais courir .

```
python3 code/main.py
npx tsx code/main.ts
```

## Utilisez-le

`outputs/skill-debate-configurator.md`Il configure un débat pour une nouvelle tâche: nombre d'agents, nombre de tours, hétérogénéité (modèle même contre mixte), attribution de rôle (symétrique contre un adversaire).

## La faire partir

Si vous envoyez le débat:

- **Cap rounds at 3.**Du et al. montrent 3 tours capture la plupart du gain. Plus est le coût, pas la qualité.
- **Cap agents at 5.**Au-delà de 5, le contexte et les coûts dominent.
- **Heterogeneous by default.**Au moins deux modèles de base différents dans la piscine.
- **Adversarial slot.**Un agent a été incité à discuter, c'est une rupture de la sycophancy.
- **Log every round.**Les systèmes de débat qui cachent des tours intermédiaires ne peuvent être débogages ou vérifiés.

## Exercices

1. On court .`code/main.py`La convergence supplémentaire s'arrête à quelle ronde ?
2. Ajouter un quatrième agent avec un rôle adversaire: toujours en désaccord avec la majorité actuelle.
3. Le score de l'accord par round (fraction des agents sur la réponse majoritaire) atteint-il 1,0, et est-ce équivalent à "correct"?
4. Lisez les ablations du chapitre 4 et répliquez le résultat "agent seulement" contre "ronde seulement" contre "both" en utilisant ce code.
5. Lisez " Devrions-nous devenir fous ? " (arXiv:2311.17371) et énumérez deux variantes de débat au-delà du round-robin  par exemple, dirigées par un juge, en chaîne de débat, adversarielles.

## Les termes clés

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| Society of Mind | "Minsky's idea" | Intelligence as interacting specialists; 1986 framing now operationalized via LLM debate. |
| Multi-agent debate | "Agents argue" | N agents propose, critique each other, revise over R rounds, majority-vote. |
| Consensus | "They agree" | Not epistemic truth — just fraction-on-majority-answer. Can be confidently wrong. |
| Rounds | "Exchange steps" | One round = each agent reads the others and updates once. |
| Heterogeneous debate | "Mix model families" | Using different base models to decorrelate errors. |
| Sycophancy cascade | "Everyone agrees with the loud one" | Debate failure where agents defer to the most confident agent regardless of correctness. |
| NLSOM | "129-agent society" | Natural-language society of mind; Zhuge et al.'s scaled version. |
| Correlated error | "Same model, same bug" | Why self-consistency saturates; debate across different views decorrelates. |

## Pour en savoir plus

- [Du et al. — Improving Factuality and Reasoning in Language Models through Multiagent Debate](https://arxiv.org/abs/2305.14325) le document de référence, ICML 2024
- [Zhuge et al. — Mindstorms in Natural Language-Based Societies of Mind](https://arxiv.org/abs/2305.17066) 129-agent NLSOM
- [Should we be going MAD? A Look at Multi-Agent Debate Strategies for LLMs](https://arxiv.org/abs/2311.17371) des variantes de débat sur les critères de référence
- [Debate project page](https://composable-models.github.io/llm_debate/) Le code du groupe Du et al., les démos et les détails de l'ablation
