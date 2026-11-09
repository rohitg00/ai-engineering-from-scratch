# Capstone 09  Agent de migration de code (langue de niveau répo / mise à niveau du temps d'exécution)

> Le MigrationBench d'Amazon (Java 8 à 17) et le migrateur Py2-to-Py3 de Google app Engine fixent la barre de 2026. L'OpenRewrite de Moderne réécrit des réécrits déterministes à l'échelle AST. Grit cible le même problème avec le modèle de code-mod DSL. Le modèle de production combine les deux: un substrat déterministe pour les réécrits sûrs plus une couche d'agent pour les cas ambiguos, une boîte à sable pour les constructions par branche et un harnais d'essai qui se déclenche en vert avant l'ouverture du PR. Le but est de migrer 50 réels repos et de publier un taux de réussite avec une taxonomie de défaillance.

**Type:** Capstone
**Languages:** Python (agent), Java / Python (targets), TypeScript (dashboard, agent scaffold)
**Prerequisites:** Phase 5 (NLP), Phase 7 (transformers), Phase 11 (LLM engineering), Phase 13 (tools), Phase 14 (agents), Phase 15 (autonomous), Phase 17 (infrastructure)
**Phases exercised:**P5 · P7 · P11 · P13 · P14 · P15 · P17
**Time:** 30 hours

## Problème

La migration de code à grande échelle est l'une des applications de production les plus propres des agents de codage de 2026. La vérité de base est évidente (la suite de tests passe-t-elle après la migration ?), les récompenses sont réelles (une migration de flotte Java-8 est un projet à l'échelle du personnel) et les critères de référence sont publics (sous-ensemble de MigrationBench 50 répo). L'OpenRewrite de Moderne traite du côté déterministe. La couche agent gère tout ce que les recettes OpenRewrite ne peuvent pas: réécrits ambiguës, dérive du système de construction, syntaxe à longue queue, rupture de dépendance transitive.

Vous construirez un agent qui prend un repo Java 8 (ou Python 2 repo) et produit une branche migrée de CI verte. Vous mesurerez le taux de réussite, la préservation de la couverture des tests, le coût par repo et construirez une taxonomie de défaillance.

## Concept

Le pipeline a deux couches.**deterministic substrate**(OpenRewrite pour Java, libcst pour Python) exécute la plupart des réécrits mécaniques en toute sécurité: importations, signatures de méthode, modifications de sécurité nulles, essayez-les avec des ressources, remplacements d'API dépassés.**agent layer**(OpenAI Agents SDK ou LangGraph sur Claude Opus 4.7 et GPT-5.4-Codex) traite des cas que les recettes ne peuvent pas: mises à niveau de fichiers de construction (Maven/Gradle/pyproject), conflits de dépendance transitifs, feuilles de test, annotations personnalisées.

Chaque repo reçoit une boîte à sable Daytona avec le temps d'exécution cible préinstallé. L'agent itérée: exécuter la construction, classer les défaillances, appliquer la correction, réexécuter. Limits d'intensité: 30 minutes par repo, 8 $ par repo, 20 tournées d'agent. Si tous les tests passent et la couverture diminue de pas plus de 2 points de pourcentage, la branche ouvre un PR. Si non, le repo est déposé sous une classe de défaillance avec des preuves.

La taxonomie de l'échec est la livrable. Sur 50 repos, ce qui est cassé? transitive deps? annotations personnalisées? construire version de l'outil? test flocons non liés à la migration? chaque classe obtient un compte et un exemplaire différence. Les futurs auteurs de recettes peuvent cibler les trois premiers.

## Architecture

```
target repo
      |
      v
OpenRewrite / libcst deterministic recipes
   (safe, fast, auditable, ~70-80% of fixes)
      |
      v
Daytona sandbox per branch
      |
      v
agent loop (Claude Opus 4.7 / GPT-5.4-Codex):
   - run build -> capture failures
   - classify failures (build, test, lint)
   - apply fix (patch or retry recipe)
   - rerun
   - budget: 30 min, $8, 20 turns
      |
      v
test + coverage delta gate
      |
      v (passed)
open PR
      |
      v (failed)
file under failure class + attach repro
```

## La pile

- Substrate déterministe: OpenRewrite (Java) ou libcst (Python)
- Agent: OpenAI Agents SDK ou LangGraph sur Claude Opus 4.7 + GPT-5.4-Codex
- Sandbox: décontainers Daytona par branche, temps d'exécution cible préinstallé (Java 17 / Python 3.12)
- Systèmes de construction: Maven, Gradle, uv (Python)
- Les critères de référence: Amazon MigrationBench 50 répo sous-ensemble (Java 8 à 17), Google App Engine Py2-to-Py3 repos
- Harness de test: coureur parallèle, couverture via Jacoco (Java) ou couverture.py (Python)
- Observabilité: Langfuse + trace bundle par repo avec chaque différence de pièce
- Tableau de bord: tableau de bord de la taxonomie des défaillances avec le nombre par classe et les différences exemplaires

```figure
ce-migration-funnel
```

## Faites-le

1. **Recipe pass.**Exécutez d'abord des recettes OpenRewrite (Java) ou libcst (Python).

2. **Build trial.**Si c'est vert, passe aux tests, si c'est rouge, passez à l'agent.

3. **Agent loop.**LangGraph avec des outils: `run_build`- Je suis là .`read_file`- Je suis là .`edit_file`- Je suis là .`run_test`- Je suis là .`git_diff`L'agent classifie l'échec (profondeur, syntaxe, test, outil de construction) et applique une correction ciblée.

4. **Budget caps.**30 minutes de temps par répondeur, 8 $, 20 tournées d'agent.

5. **Test + coverage gate.**Après la mise en place est verte, exécutez la suite de test. Comparer la couverture à la repo de base. Si la couverture a chuté de plus de 2 points de pourcentage, le fichier sous " couverture_régrésion ".

6. **PR open.**En cas de succès, appuyez sur la branche, ouvrez la relation avec la différence et un résumé des recettes appliquées et qui engage l'agent auteur.

7. **Failure taxonomy.**Pour chaque repo raté, étiquettez avec une classe: `dep_upgrade_required`- Je suis là .`build_tool_drift`- Je suis là .`custom_annotation`- Je suis là .`test_flake`- Je suis là .`syntax_edge_case`- Je suis là .`budget_exhausted`- Faites un tableau de bord.

8. **50-repo run.**Exécuter dans le sous-ensemble MigrationBench. Rapporte le taux de réussite par classe, le coût par rapport au rapport, la couverture-conservation et une ligne de base comparative uniquement.

## Utilisez-le

```
$ migrate legacy-java-service --target java17
[recipe]   27 rewrites applied (JUnit 4->5, HashMap initializer, try-with-resources)
[build]    FAIL: cannot find symbol sun.misc.BASE64Encoder
[agent]    turn 1 classify: removed_jdk_api
[agent]    turn 2 apply: sun.misc.BASE64Encoder -> java.util.Base64
[build]    OK
[tests]    412/412 passing; coverage 84.1% -> 84.3%
[pr]       opened #1841  cost=$3.20  turns=4
```

## La faire partir

`outputs/skill-migration-agent.md`Il est le délivrable. Il exécute des recettes déterministes puis une boucle d'agent pour produire une branche migrée verte, ou dépose le repo sous une classe de taxonomie.

| Weight | Criterion | How it is measured |
|:-:|---|---|
| 25 | MigrationBench pass rate | 50-repo subset pass@1 |
| 20 | Test-coverage preservation | Mean coverage delta vs base |
| 20 | Cost per migrated repo | $/repo on passing runs |
| 20 | Agent / deterministic-tool integration | Fraction of fixes that OpenRewrite handled vs agent authored |
| 15 | Failure analysis write-up | Taxonomy completeness with exemplars |
| **100** | | |

## Exercices

1. Exécutez le pipeline de migration avec OpenRewrite seulement (pas d'agent). Comparer le taux de passage à l'ensemble du pipeline. Identifiez les cas où l'agent seul est la différence.

2. Implémenter un contrôle "lint-clean": après la migration, exécuter un style linter (semplifié pour Java, ruff pour Python). Faire défaut de la PR si de nouvelles erreurs de lint apparaissent. Mesurer le taux de couverture conservé mais style-régressés.

3. Ajouter un optimisateur de "différence minimale": après que la branche de l'agent ait passé les tests, éliminer les changements inutiles avec un deuxième passage.

4. Extension à une troisième migration: Node 18 vers Node 22. Reutilisez l'emballage de la boîte à sable; échangez la couche de recette pour un codemod personnalisé.

5. Mesurer le temps de la première construction verte (TTFGB) en tant que métrique UX. Objectif: p50 en moins de 10 minutes.

## Les termes clés

| Term | What people say | What it actually means |
|------|-----------------|------------------------|
| Deterministic substrate | "Recipe engine" | OpenRewrite / libcst: declarative AST rewrites with safety guarantees |
| Codemod | "Code-modifying program" | A rewrite rule that changes source code mechanically |
| Build drift | "Tool version skew" | Subtle Maven / Gradle / uv behavior changes between major versions |
| Failure class | "Taxonomy bucket" | A labeled reason a repo did not migrate: dep, syntax, test, build-tool, budget |
| Coverage delta | "Coverage preservation" | Change in test coverage % from base to migrated branch |
| Agent turn | "Tool-call round" | One plan -> act -> observe cycle in the agent loop |
| Budget exhaustion | "Hit the ceiling" | The repo consumed its 30-min / $8 / 20-turn limit without passing |

## Pour en savoir plus

- [Amazon MigrationBench](https://aws.amazon.com/blogs/devops/amazon-introduces-two-benchmark-datasets-for-evaluating-ai-agents-ability-on-code-migration/) le point de référence canonique de 2026
- [Moderne.io OpenRewrite platform](https://www.moderne.io) la référence déterministe du substrat
- [OpenRewrite documentation](https://docs.openrewrite.org) rédaction de recettes
- [Grit.io](https://www.grit.io) mode de code DSL alternatif
- [OpenAI sandboxed migration cookbook](https://developers.openai.com/cookbook/examples/agents_sdk/sandboxed-code-migration/sandboxed_code_migration_agent) la référence au KDD des agents
- [Google App Engine Py2 to Py3 migrator](https://cloud.google.com/appengine) référence de migration alternative
- [libcst](https://github.com/Instagram/LibCST) Substrate déterministe de Python
- [Daytona sandboxes](https://daytona.io) référence par branche
