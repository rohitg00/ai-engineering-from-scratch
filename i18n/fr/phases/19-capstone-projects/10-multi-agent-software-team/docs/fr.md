# Capstone 10  Équipe d'ingénierie logicielle multi-agents

> La forme de 2026 d'une équipe d'ingénierie multi-agents s'est convergue: un architecte planifie, N codeurs travaillent dans des arbres de travail parallèles, un réviseur porte, un testeur vérifie. L'architecture d'usine de SWE-AF, la mise en place de la mise en place de métaGPT, le graphique d'acteurs typé d'AutoGen 0.4, Devin de Cognition et les droïdes de Factory y sont tous arrivés indépendamment. Les arbres de travail parallèles convertissent les horloges murales en débit. Les protocoles d'état et de transfert partagés deviennent la surface de l'échec. Le but est de construire l'équipe, d'évaluer sur le banc SWE Pro, et de signaler quelles offres se brisent et à quelle fréquence.

**Type:** Capstone
**Languages:** Python / TypeScript (agents, task board scaffold), Shell (worktree scripts)
**Prerequisites:** Phase 11 (LLM engineering), Phase 13 (tools), Phase 14 (agents), Phase 15 (autonomous), Phase 16 (multi-agent), Phase 17 (infrastructure)
**Phases exercised:**P11 · P13 · P14 · P15 · P16 · P17
**Time:** 40 hours

## Problème

Les harnais de codage à agent unique atteignent un plafond pour les grandes tâches. Non pas parce que n'importe quel agent individuel est faible, mais parce qu'un contexte de 200k-token ne peut pas contenir un plan d'architecture plus quatre tranches de base de code parallèles plus commentaires de critique plus sortie de test. Les usines multi-agents divisent le problème: un architecte possède le plan, les codeurs possèdent la mise en œuvre dans des arbres de travail parallèles, un réviseur les portes, un testeur vérifie. L'architecture "factorielle" de SWE-AF, les rôles de MetaGPT, le graphique d'acteurs typé d'AutoGen  les trois cadres décrivent la même forme.

L'architecte planifie quelque chose que les codeurs ne peuvent pas mettre en œuvre. Les codeurs produisent des différences contradictoires. L'examen approuve une correction hallucinée. Le testeur court un codeur en écriture fixe. Vous construirez une de ces équipes, vous l'exécuterez sur 50 éditions Pro du banc SWE, vous suivrez chaque dépôt et publierez le post-mortem.

## Concept

Les rôles sont des agents de type.**Architect**(Claude Opus 4.7) lit le numéro, écrive un plan et le découple en sous-tâches avec des interfaces explicites. **Coders**(Claude Sonnet 4.7, N cas parallèles, chacun dans un `git worktree`+ Daytona sandbox) mettre en œuvre des sous-tâches de manière indépendante. **Reviewer**(GPT-5.4) lit la différence fusionnée et approuve ou demande des modifications spécifiques. **Tester**(Gemini 2.5 Pro) exécute la suite de tests en isolement et rapporte des défaillances avec des objets.

La communication se fait par le biais d'un tableau de tâches partagé (fichier-backed ou Redis). Chaque rôle consomme des tâches qu'il est autorisé à accomplir. Les remises sont des messages de type protocole A2A. Les problèmes de coordination: résolution des conflits de fusion (rôle de coordonnateur ou fusion automatique en trois sens), synchronisation partagée (le plan est gelé une fois que les codateurs ont commencé; les réaménagements sont des événements distincts) et la surveillance des portes des réviseurs (le réviseur ne peut approuver ses propres changements ou les changements qu'il a proposés).

L'amplification des jetons est le coût caché. Chaque limite de rôle ajoute des instructions de résumé et un contexte de remise. Une course à un seul agent de 40 tours devient 160 tours totaux sur quatre rôles. La rubrique pèse spécifiquement l'efficacité des jetons par rapport à la ligne de base d'un seul agent parce que la question n'est pas "fait-il du travail multi-agent" mais "fait-il gagner par dollar".

## Architecture

```
GitHub issue URL
      |
      v
Architect (Opus 4.7)
   reads issue, produces plan with subtasks + interfaces
      |
      v
Task board (file / Redis)
      |
   +-- subtask 1 ---+-- subtask 2 ---+-- subtask 3 ---+-- subtask 4 ---+
   v                v                v                v                v
Coder A          Coder B          Coder C          Coder D          (4 parallel)
 (Sonnet)         (Sonnet)         (Sonnet)         (Sonnet)
 worktree A       worktree B       worktree C       worktree D
 Daytona          Daytona          Daytona          Daytona
      |                |                |                |
      +--------+-------+-------+--------+
               v
           merge coordinator  (three-way merge + conflict resolution)
               |
               v
           Reviewer (GPT-5.4)
               |
               v
           Tester  (Gemini 2.5 Pro)  -> passes? -> open PR
                                     -> fails?  -> route back to coder
```

## La pile

- Orchestration: LangGraph avec état partagé + sous-graphes par agent
- Messagerie: protocole A2A (Google 2025) pour les messages entre agents typés
- Modèles: Opus 4.7 (architecte), Sonnet 4.7 (codeur), GPT-5.4 (réviseur), Gemini 2.5 Pro (testeur)
- Isolement des arbres de travail: `git worktree add`par codeur + sable de Daytona
- Coordinateur de fusion: fusion trilatérale sur mesure + résolution de conflits médiée par la LLM
- Eval: SWE-bench Pro (50 éditions), scénarios SWE-AF, HumanEval++ pour les essais unitaires
- Observabilité: Langfuse avec des délais de roulement, comptabilité des jetons par agent
- Déploiement: K8 avec chacun des rôles de déploiement séparé + HPA sur backlog

```figure
ce-team-handoff
```

## Faites-le

1. **Task board.**JSONL avec fichier sauvegardé avec des messages typés: `plan_request`- Je suis là .`subtask`- Je suis là .`diff_ready`- Je suis là .`review_needed`- Je suis là .`test_needed`- Je suis là .`approved`- Je suis là .`rejected`- Je suis là .`replan_needed`Les agents s'abonnent aux étiquettes.

2. **Architect.**Lisez le numéro de GitHub, exécute Opus 4.7 avec un modèle de plan nécessitant des interfaces de sous-tâche explicites (fichiers touchés, fonctions publiques, impact de test).`plan_request`avec un jour de sous-tâches.

3. **Coders.**N travailleurs parallèles, chacun revendique une sous-tâche de la commission.`git worktree add`La branche plus une boîte à sable de Daytona.`diff_ready`avec le patch + delta de test.

4. **Merge coordinator.**En mode codateur complet, le tripartite fusionne les branches N en une branche de mise en scène.

5. **Reviewer.**GPT-5.4 lit la différence fusionnée.`approved`(no-op) ou `review_feedback`avec des demandes de modification spécifiques redirigées vers le codeur concerné.

6. **Tester.**Gemini 2.5 Pro utilise une boîte à sable propre pour les tests.`test_passed`ou `test_failed`Les tests ratés retournent au codeur qui possède la sous-tâche défaillante.

7. **Handoff accounting.**Chaque message traversant une limite de rôle obtient une durée dans Langfuse avec la taille de la charge utile et le modèle utilisé.

8. **Eval.**Exécutez sur 50 émissions SWE-bench Pro. Comparer pass@1 et $-par-émission résolue avec une ligne de base d'agent unique (un Sonnet 4.7 dans un seul arbre de travail).

9. **Post-mortem.**Pour chaque émission ratée, identifiez l'expérience qui a été cassée (plan trop vague, conflit de fusion, faux approbation du réviseur, flaque du testeur).

## Utilisez-le

```
$ team run --issue https://github.com/acme/widget/issues/842
[architect] plan: 4 subtasks (parser, cache, api, migration)
[board]     dispatched to 4 coders in parallel worktrees
[coder-A]   subtask parser  -> 42 lines, tests pass locally
[coder-B]   subtask cache   -> 88 lines, tests pass locally
[coder-C]   subtask api     -> 31 lines, tests pass locally
[coder-D]   subtask migration -> 19 lines, tests pass locally
[merge]     3-way merge: 0 conflicts
[reviewer]  comments on cache (thread pool sizing); routed to coder-B
[coder-B]   revision: 92 lines; submits
[reviewer]  approved
[tester]    all 412 tests pass
[pr]        opened #3382   4 coders, 1 revision, $4.90, 18m
```

## La faire partir

`outputs/skill-multi-agent-team.md`En fonction de l'URL de l'émission et du niveau de parallélisme, l'équipe produit un PR prêt à fusion avec la comptabilité des jetons par rôle.

| Weight | Criterion | How it is measured |
|:-:|---|---|
| 25 | SWE-bench Pro pass@1 | Matched 50-issue subset, pass@1 |
| 20 | Parallel speedup | Wall-clock vs single-agent baseline |
| 20 | Review quality | False-approval rate on injected-bug probe |
| 20 | Token efficiency | Total tokens per solved issue vs single-agent |
| 15 | Coordination engineering | Merge-conflict resolution, handoff-failure histogram |
| **100** | | |

## Exercices

1. Injecter un bug évident dans un diff mid- run (extra `return None`La mesure du taux de fausse approbation de l'examinateur.

2. Réduire à deux codeurs (architecte + deux codeurs + réviseur + testeur, chaque codeur exécute deux sous-tâches séquentiellement).

3. Remplacez le coordinateur de fusion par une contrainte de rédacteur unique (les sous-tâches touchent des ensembles de fichiers disjoints). Mesurer la charge de planification sur l'architecte.

4. Réviseur de swap de GPT-5.4 à Claude Opus 4.7. Mesurer le taux de fausse approbation et le delta des coûts des jetons.

5. Ajouter un cinquième rôle: documentateur (Haiku 4.5). Après examen, il produit une entrée de changelog. Mesurer si la qualité de la documentation justifie la dépense supplémentaire de jetons.

## Les termes clés

| Term | What people say | What it actually means |
|------|-----------------|------------------------|
| Parallel worktree | "Isolated branch" | `git worktree add` producing a fresh working tree per coder |
| Task board | "Shared message bus" | File or Redis store of typed messages agents subscribe to |
| Handoff | "Role boundary" | Any message crossing from one role's context to another's |
| Token amplification | "Multi-agent overhead" | Total tokens across roles / single-agent tokens for the same task |
| A2A protocol | "Agent-to-agent" | Google's 2025 spec for typed inter-agent messages |
| Merge coordinator | "Integrator" | Component that runs three-way merge and mediates conflicts |
| False approval | "Reviewer hallucination" | Reviewer approves a diff with known bugs |

## Pour en savoir plus

- [SWE-AF factory architecture](https://github.com/Agent-Field/SWE-AF) l'usine de référence 2026 multi-agents
- [MetaGPT](https://github.com/FoundationAgents/MetaGPT) cadre multi-agents fondé sur les rôles
- [AutoGen v0.4](https://github.com/microsoft/autogen) Le cadre d'acteurs de type de Microsoft
- [Cognition AI (Devin)](https://cognition.ai) produit de référence
- [Factory Droids](https://www.factory.ai) produit de référence alternatif
- [Google A2A protocol](https://a2a-protocol.org/latest/) spécifications de messagerie interagentes
- [git worktree documentation](https://git-scm.com/docs/git-worktree) le substrat d'isolation
- [SWE-bench Pro](https://www.swebench.com) l'objectif d'évaluation
