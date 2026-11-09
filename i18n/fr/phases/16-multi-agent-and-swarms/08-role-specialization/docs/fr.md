# Spécialisation du rôle  Planificateur, critique, exécuteur, vérificateur

> La décomposition multi-agent la plus courante en 2026: un agent planifie, un exécute, un critique ou vérifie. MetaGPT (arXiv:2308.00352) formalite cela en tant que SOP codés en instructions de rôle  Product Manager, Architect, Project Manager, Engineer, QA Engineer  suivant `Code = SOP(Team)`- Je suis désolé . ChatDev (arXiv:2307.07924) renferme le concepteur, le programmeur, l'examen, le testeur à travers une "chaîne de chat" avec "déhallucination communicative" (les agents demandent explicitement des détails manquants). Le vérificateur est porteur de charge: Cemri et al. (MAST, arXiv:2503.13657) montre que chaque défaillance multi-agent peut être tracée à la vérification manquante ou cassée. PwC a rapporté un gain de précision de 7 fois (10% → 70%) à partir de boucles de validation structurées dans CrewAI.

**Type:** Learn + Build
**Languages:** Python (stdlib), TypeScript
**Prerequisites:** Phase 16 · 04 (Primitive Model), Phase 16 · 05 (Supervisor)
**Time:** ~60 minutes

## Problème

Les systèmes multi-agents génériques produisent des sorties génériques. Trois codeurs dans un chat de groupe écrivent trois saveurs du même code médiocre. Vous pouvez ajouter plus d'agents, ajouter plus de tours, et toujours ne pas franchir le seuil de qualité.

La solution n'est pas plus d'agents  c'est * différents * agents. Assignez des rôles distincts. Donnez aux outils critiques que le planificateur n'a pas. Donnez au vérificateur une suite de tests objective. Maintenant, le système a un désaccord interne avec la correction à la terre, pas seulement des devinettes parallèles.

## Concept

### Les quatre rôles canoniques

**Planner.**Lire l'objectif, produire une liste d'étapes ou une spécification.

**Executor.**Lire un plan étape par étape, produire l'artefact. outils: les outils de travail réels (compilateur de code, shell, client API).

**Critic.**Lire l'exécution de l'exécuteur contre l'intention du planificateur. outils: accès uniquement en lecture à l'artefact, analyse statique.

**Verifier.**Lire l'artefact et effectuer un contrôle déterministe. outils: test runner, type checker, validateur de schéma. sortie: passer/échouer avec des preuves.

Le critique est subjectif, opinionné, souvent basé sur le LLM. Le vérificateur est objectif, déterministe, souvent basé sur le code.

### Le modèle de traitement des méta-gPT

MetaGPT (arXiv:2308.00352) code les SOP de l'ingénierie logicielle comme des instructions de rôle:

- **Product Manager**écrit le PRD.
- **Architect**produit la conception du système.
- **Project Manager**- Il partage les tâches.
- **Engineer**les outils.
- **QA Engineer**Il fait des tests.

Chaque rôle a un schéma d'entrée/sortie strict.`Code = SOP(Team)`Les SOP déterministes transforment une équipe de LLM en un pipeline prévisible.

### La déhallucination communicative de ChatDev

ChatDev ajoute un mouvement clé: lorsqu'un exécuteur a besoin d'un détail spécifique qui n'était pas dans le plan, il demande explicitement au concepteur avant de continuer.

Mise en œuvre: le prompt de rôle comprend "lorsque vous avez besoin d'informations spécifiques qui ne vous ont pas été données, demandez le rôle pertinent par son nom avant de produire une sortie".

### Pourquoi le vérificateur est le plus important

Cemri et al. (MAST) ont suivi 1642 échecs d'exécution multi-agent. 21,3% étaient des lacunes de vérification  le système a envoyé une réponse que personne n'avait vérifiée. Les 79% restants remontent souvent à "il y avait un contrôle qui a échoué silencieusement ou n'a jamais été exécuté. " La vérification est le rôle porteur de charge.

PwC a rapporté (CrewAI deployments, 2025) que l'ajout d'une boucle de validation structurée a déplacé la précision de 10% à 70%.

### Critic vs vérificateur

- Un critique est un maître d'école qui examine un artefact pour la qualité.
- Un vérificateur est un programme déterministe exécuté sur l'artefact. objectif. donne le passage/échec avec des preuves.

Utilisez les deux. Le critique capture les problèmes de goût que le vérificateur ne peut pas articuler. Le vérificateur capture les bugs que le critique ne peut pas voir parce qu'ils ne se montrent que pendant la mise en marche.

### Le modèle anti-

Chaque rôle dans votre système est un LLM et chaque rôle est "il me semble bon". Mode de défaillance MAST classique. Ajoutez au moins un vérificateur dont le passage/fail est décidé par code, pas par un LLM.

### Cartographie du cadre

- **CrewAI** `Agent(role, goal, backstory)`est la surface de spécialisation du livre.
- **LangGraph** les nœuds peuvent avoir des instructions spécialisées; les bords forcent le pipeline.
- **AutoGen** Agents conversables spécifiques à un rôle avec des noms d'un mot dans un chat de groupe.
- **OpenAI Agents SDK** les outils de transfert entre les agents spécialisés dans les rôles.

```figure
swarm-roles
```

## Faites-le

`code/main.py`met en œuvre un pipeline à 4 rôles construisant une fonction Python simple:

- **Planner**produit une spécification.
- **Executor**génère une chaîne de code.
- **Critic**(SIMULATION de L'ALM) indique des problèmes évidents.
- **Verifier**exécute le code généré dans une boîte à sable (`exec`) contre un cas d'essai.

La démo se déroule deux fois: une fois où l'exécuteur produit un code correct (critique + vérificateur tous les deux passent), une fois où l'exécuteur produit un code hors spécificité (critique manque le bug parce qu'il semble plausible, vérificateur le capture parce que le test échoue).

Je vais courir .

```
python3 code/main.py
npx tsx code/main.ts
```

## Utilisez-le

`outputs/skill-role-designer.md`Il prend une tâche et produit la liste de rôles (3-5 rôles), le schéma d'entrée/sortie par rôle et le contrôle du vérificateur.

## La faire partir

Liste de contrôle:

- **At least one deterministic verifier.**Jamais tout-LLM.
- **Explicit I/O schema per role.**Le planificateur renvoie une spécification, pas de la prose; l'exécuteur lit ce schéma.
- **Communicative dehallucination.**L'exécuteur doit demander à l'organisateur quand les informations manquent; ne jamais les inventer.
- **Critic/verifier ordering.**Exécutez le critique d'abord (bon marché, il capture des problèmes de conception), le vérificateur en second (légers, il capture des bugs).
- **Loop budget.**Max 2 critique-exécuteur revue rounds avant d'escalader à humain.

## Exercices

1. On court .`code/main.py`et observez comment le vérificateur détecte le bug que le critique a raté.`return`En ce qui concerne les tests de fonctionnement, qu'est-ce qui est pris en compte si le test de fonctionnement est manqué ?
2. Ajouter un cinquième rôle: "analyste des exigences" qui traduit le souhait de l'utilisateur en spécification prête à l'emploi.
3. Lisez la section 3 de MetaGPT ("Agent"). Lisez le schéma d'entrée/sortie de chacun des 5 rôles de MetaGPT.
4. Lisez le diagramme de la chaîne de chat de ChatDev (arXiv:2307.07924 Figure 3). Identifiez où la déhallucination communicative rompt une boucle qui serait autrement infinie.
5. L'augmentation de la précision de 7 fois de PwC est venue des boucles de vérification.

## Les termes clés

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| Role specialization | "Different agents, different jobs" | Distinct system prompts tuned for planner/executor/critic/verifier roles. |
| SOP pattern | "Encoded standard operating procedure" | MetaGPT's framing: strict I/O schemas per role turn a team into a pipeline. |
| Communicative dehallucination | "Ask before inventing" | ChatDev pattern: executor asks planner when a detail is missing rather than making one up. |
| Critic | "LLM reviewer" | Subjective, opinionated reviewer. Catches taste issues. Can be fooled by plausible prose. |
| Verifier | "Deterministic check" | Code-based pass/fail. Test runner, type checker, schema validator. Cannot be fooled. |
| Verification gap | "No one checked" | 21.3% of MAST failures. Answer shipped without a check that would have caught the bug. |
| Revision loop | "Critic sends it back" | Critic rejection triggers executor re-run with feedback. Needs a budget. |
| All-LLM anti-pattern | "Looks good to me" | Every role is an LLM, no deterministic check. Classic MAST failure. |

## Pour en savoir plus

- [Hong et al. — MetaGPT: Meta Programming for Multi-Agent Collaboration](https://arxiv.org/abs/2308.00352) le document de référence du PPS en tant que rôle
- [Qian et al. — Communicative Agents for Software Development (ChatDev)](https://arxiv.org/abs/2307.07924) Chaîne de chat + déhallucination communicative
- [Cemri et al. — Why Do Multi-Agent LLM Systems Fail?](https://arxiv.org/abs/2503.13657) Taxonomie MAST; les lacunes de vérification représentent 21,3% des défaillances
- [CrewAI docs — Agent roles](https://docs.crewai.com/en/introduction) surface spécifique de rôle de production
