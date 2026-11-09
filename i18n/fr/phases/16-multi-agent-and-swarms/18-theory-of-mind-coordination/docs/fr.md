# La théorie de l'esprit et la coordination émergente

> Li et collègues (arXiv:2310.10701) ont montré que les agents de LLM dans une exposition de jeu de texte coopérative **emergent high-order Theory of Mind**(ToM)  raisonner sur ce qu'un autre agent croit sur les croyances d'un troisième agent  mais échouer à la planification à long terme en raison de la gestion du contexte et des hallucinations. Riedl (arXiv:2510.05174) a mesuré la synergie d'ordre supérieur dans une population et a constaté que **only**La condition ToM-prompt produit une différenciation liée à l'identité et une complémentarité axée sur l'objectif; les LLM de faible capacité ne montrent que l'émergence fausse. C'est-à-dire que l'émergence de la coordination est immédiate et conditionnelle et dépend du modèle, pas gratuite. Cette leçon met en œuvre un agent minimal conscient de la MTO, exécute une tâche de coopération avec et sans l'intervention de la MTO et mesure le delta de coordination par rapport au protocole Riedl 2025.

**Type:** Learn + Build
**Languages:** Python (stdlib), TypeScript
**Prerequisites:** Phase 16 · 07 (Society of Mind and Debate), Phase 16 · 17 (Generative Agents)
**Time:** ~75 minutes

## Problème

La coordination multi-agents semble souvent magique: les agents divisent le travail, s'anticipent les uns les autres, évitent la redondance. Généralement, cette "émergence" est un artifact de l'ingénierie rapide  quelqu'un a dit aux agents de "coordonner".

La conclusion de Riedl en 2025 est plus stricte: dans des conditions contrôlées, la coordination ne se produit que lorsque les agents sont amenés à raisonner sur **other agents' minds**(ToM). Sans le prompt ToM, même les modèles forts montrent des modèles de coordination qui ne survivent pas aux contrôles statistiques.

Cette leçon traite le ToM comme une capacité spécifique (réflexion sur les croyances sur les croyances), construit un agent minimal conscient du ToM et mesure à quoi ressemble la véritable coordination par rapport à ce que ressemble le dressage rapide.

## Concept

### Ce que signifie le TOM

Psychologie du développement: un enfant de 3 ans pense que le monde intérieur de chacun correspond à celui de l'autre. Un enfant de 5 ans comprend que les autres ont des croyances différentes. Un enfant de 7 ans explique les croyances sur les croyances ("elle pense que je pense que la balle est sous la tasse ").

Pour les agents de LLM, ToM commande une carte à:

- **Zeroth-order:**L'agent agit uniquement sur ses propres observations.
- **First-order:**"Alice croit à X".
- **Second-order:**"Alice croit que Bob croit à X".

Li et collègues 2023 ont constaté que les ToM de premier et de deuxième ordre émergent dans les agents de LLM dans les jeux coopératifs, mais se dégradent avec un long horizon et une communication peu fiable.

### Le test Sally-Anne, en bref

Un test de fausse croyance de 1985: Sally met un marbre dans le panier A, quitte. Anne le déplace dans le panier B. Où va Sally regarder quand elle revient?

Les LLM de l'ère GPT-4 passent des tests de style Sally-Anne lorsqu'ils sont posés clairement. Ils échouent lorsque le récit est long, la scène change plusieurs fois ou que la question est formulée indirectement.

### Mesure de coordination de Riedl

Riedl (arXiv:2510.05174) a construit un test à l'échelle de la population: N agents, objectif de coopération, conditions de prompt variable.

1. **Identity-linked differentiation.**Les agents développent-ils des différences de rôles stables au fil du temps?
2. **Goal-directed complementarity.**Les actions des agents se complètent-elles mutuellement (sous-tâches différentes) plutôt que de se dupliquer?
3. **Higher-order synergy.**Une mesure statistique de la réussite d'un groupe par rapport à un sous-ensemble.

Résultat: seulement dans la condition de prompt ToM les trois indicateurs produisent un signal au-dessus de la ligne de base. Sans prompt ToM, les indicateurs hover près de chance pour les modèles de capacité modérée.

### L'illusion de coordination

Sans contrôle statistique, la "coordination d'urgence" dans les démos reflète souvent:

- L'ingénierie rapide qui fonctionne en coordination (l'intervention du système qui dit "travailler ensemble").
- Préjugé observateur (nous voyons des modèles que nous attendons).
- Sélection post-hoc des courses réussies.

Les systèmes de production qui commercialisent une "coordination d'urgence" sans signal mesurable doivent être traités comme une commercialisation.

### Un agent minimal conscient de la TOM

La structure:

```
agent state:
  own_beliefs:    {facts the agent believes}
  other_models:   {other_agent_id -> {beliefs_the_agent_attributes_to_them}}
  actions_last_N: [history of others' actions]

observation update:
  - update own_beliefs from direct observation
  - update other_models[agent_id] from their action + prior beliefs

action selection:
  - enumerate candidate actions
  - for each, predict what each other agent will do next given their modeled beliefs
  - pick action that maximizes joint outcome under those predictions
```

Le `other_models`L'attribut est l'état ToM. Le premier ordre ToM ne conserve qu'un seul niveau.`other_models[i][other_models_of_j]`Ce que je pense que l'agent J croit.

### Pourquoi le long horizon fait mal

Les limites de contexte font oublier aux agents quelle croyance appartient à qui. Les hallucinations ajoutent de fausses croyances aux modèles d'autres agents.

Les mesures d'atténuation documentées dans le document et les suivis en 2024-2026:

- **Explicit ToM state in the prompt.**Format structuré: `{agent_id: belief_list}`- La récupération des forces pour préserver la liaison entre la croyance et l'identité.
- **Shorter reasoning chains.**Moins de mises à jour de ToM par tour réduisent les hallucinations composées.
- **External ToM store.**Garder le modèle hors du contexte du MLL; injecter uniquement des pièces pertinentes par tour.

### Lorsque le ToM échoue dans la production

- **Adversarial settings.**Les agents avec une bonne ToM sont plus faciles à manipuler (vous pouvez modéliser ce qu'ils modélisent de vous, puis exploiter).
- **Heterogeneous teams.**Lorsque les modèles sont différents, le modèle ToM qui fonctionne pour un adversaire ne généralise pas.
- **Ground-truth-dependent tasks.**Le TOM concerne les croyances; si la justesse dépend des faits, le TOM peut être une distraction.

### La coordination que vous pouvez vraiment mesurer

Trois signes pratiques indiquent que la coordination d'une équipe est réelle plutôt que rapide:

1. **Complementarity over time.**Sur une tâche multi-tours, les actions des agents couvrent-elles des sous-tâches disjointes ?
2. **Anticipation.**L'action de l'agent A au tour T+1 dépend-elle d'une prédiction sur l'action de B à T+2 qui s'est avérée correcte?
3. **Correction.**Lorsque A ne comprend pas correctement la croyance de B au virage T, A corrige-t-il le virage T+2?

Ces données sont mesurables dans un système multi-agents enregistré.

```figure
sw-theory-of-mind
```

## Faites-le

`code/main.py`les implémentations:

- `ToMAgent` trace ses propres croyances et les modèles de croyances par rapport à d'autres agents.
- Une tâche de coopération: trois agents doivent collecter trois jetons de trois boîtes; chaque boîte peut contenir un jeton.
- Deux configurations: `zeroth_order`(pas de TOM) et `first_order`(ToM avec modèle de croyance à un niveau).
- Mesure sur 200 essais randomisés: taux de réalisation, taux de duplication (deux agents ciblant la même boîte), moyenne de la finition.

Je vais courir .

```
python3 code/main.py
npx tsx code/main.ts
```

Expérience attendue: les agents de l'ordre zéro dupliquent l'effort à un taux de ~35% et terminent ~60% des essais en 10 tours.

## Utilisez-le

`outputs/skill-tom-auditor.md`est une compétence qui vérifie la revendication d'un système multi-agents de "coordination d'urgence".

## La faire partir

Liste de contrôle des demandes de coordination:

- **Control condition.**Une version de votre système sans la commande de coordination.
- **Statistical test.**La différence entre le système et le contrôle est-elle significative à `p < 0.05`sur votre métrique ?
- **Complementarity measure.**Des désaccords au fil du temps, pas seulement un succès final.
- **Failure-case log.**Quand les agents se trompent, à quoi ressemble l'état de la MTO ?
- **Model-capacity disclosure.**Si l'effet disparaît sur les modèles plus petits, dites-le.

## Exercices

1. On court .`code/main.py`Confirmer que le premier ordre de ToM réduit le taux de duplication de 7 fois.
2. La mise en œuvre de la deuxième classe de ToM (l'agent A modélise ce que B pense de C).
3. Injecter une**hallucination**Dans l'état de ToM, on renverse au hasard une croyance par tour.
4. Lisez Li et coll. (arXiv:2310.10701). Répétez la découverte de la " dégradation à long horizon ": à mesure que les tours passent de 10 à 30, comment votre performance de premier ordre ToM change-t-elle ?
5. Lisez Riedl 2025 (arXiv:2510.05174). Implémenter les statistiques de synergie de plus haut ordre sur vos journaux de simulation.

## Les termes clés

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| Theory of Mind | "Understanding others' minds" | The capacity to model another agent's beliefs. Graded by order (0, 1, 2+). |
| Sally-Anne test | "The false-belief test" | 1985 developmental psychology; LLMs pass plain versions, fail complex ones. |
| First-order ToM | "A believes X" | Modeling one other's beliefs about facts. |
| Second-order ToM | "A believes B believes X" | Recursive modeling one level deeper. |
| Identity-linked differentiation | "Stable roles over time" | Riedl's metric: roles persist, not random. |
| Goal-directed complementarity | "Disjoint actions" | Agents target different subtasks, not the same one. |
| Higher-order synergy | "Group exceeds any subset" | Riedl's statistical measure for real coordination. |
| Coordination illusion | "It looks coordinated" | Prompt-dressed appearance of coordination without measurable signal. |

## Pour en savoir plus

- [Li et al. — Theory of Mind for Multi-Agent Collaboration via Large Language Models](https://arxiv.org/abs/2310.10701) la gestion des risques émergente dans les jeux de coopération; modes de défaillance à long horizon
- [Riedl — Emergent Coordination in Multi-Agent Language Models](https://arxiv.org/abs/2510.05174) Mesure à l'échelle de la population; la pression à la charge est la condition de support
- [Premack & Woodruff — Does the chimpanzee have a theory of mind?](https://doi.org/10.1017/S0140525X00076512) l'origine de la notion de TOM en 1978
- [Baron-Cohen, Leslie, Frith — Does the autistic child have a theory of mind?](https://doi.org/10.1016/0010-0277(85)90022-8)  le document Sally-Anne (1985)
