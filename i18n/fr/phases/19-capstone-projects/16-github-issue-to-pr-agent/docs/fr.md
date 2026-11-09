# Capstone 16  GitHub émission à PR agent autonome

> Étiquettez un problème, obtenez un PR  la forme du produit 2026 pour les agents de codage autonomes: exécutez un agent dans une boîte à sable en nuage, vérifiez le succès des tests et publiez un PR prêt à être examiné avec raison. Les agents AWS SWE à distance, les agents de fond de cursor, le cloud OpenAI Codex et Google Jules le livrent tous. Les parties difficiles sont la reproduction automatique de l'environnement de construction du repo, empêchant la fuite de crédits, appliquant les budgets par repo, et s'assurer que l'agent ne peut pas forcer. Ce capstone construit la version auto-hébergée et la compare sur le coût et le taux de passage aux alternatives hébergées.

**Type:** Capstone
**Languages:** Python (agent), TypeScript (GitHub App, agent scaffold), YAML (Actions)
**Prerequisites:** Phase 11 (LLM engineering), Phase 13 (tools), Phase 14 (agents), Phase 15 (autonomous), Phase 17 (infrastructure)
**Phases exercised:**P11 · P13 · P14 · P15 · P17
**Time:** 30 hours

## Problème

L'agent de codage en nuage asynchrone est une catégorie de produit distincte des agents de codage interactif (capstone 01).`@agent fix this`Un travailleur se tourne dans une boîte à sable dans un nuage, clone le répo, exécute des tests, modifie des fichiers, vérifie et ouvre une relation avec la logique de l'agent dans le corps. Pas de boucle interactive, pas de terminal.

Les défis d'ingénierie sont concrets: la reproduction de l'environnement (l'agent doit construire le repo à partir de zéro sans une image de développement en cache), les tests flous (dont il faut réexécuter ou isoler), la portée des crédits (une application GitHub avec des autorisations fines minimales), l'application budgétaire par repo par jour et la politique de non-poussée.

## Concept

Le déclencheur est un lien Web GitHub (étiquette de problème ou commentaire de relations publiques). Un dispatcher fait des files d'attente sur le travail sur ECS Fargate ou Lambda. Le travailleur tire le repo dans une boîte à sable Daytona ou E2B avec un Dockerfile générique déduit du repo (langue, cadre). L'agent exécute une mini-swe-agent ou SWE-agent v2 boucle contre Claude Opus 4.7 ou GPT-5.4-Codex. Il itérée: lire le code, proposer la correction, appliquer le correctif, exécuter des tests.

La vérification est la étape de clôture. L'indicateur complet doit passer dans la boîte à sable avant l'ouverture du PR. Le delta de couverture est calculé; si le PR est négatif au-delà d'un seuil, il s'ouvre mais est étiqueté `needs-review`L' agent publie la justification comme la description de relations publiques plus un`@agent`Le réviseur peut demander des réponses.

La sécurité est évaluée à travers deux surfaces GitHub différentes: l'App fournit un jeton d'installation de courte durée avec `workflows: read`et les contenus de repo/espace de communication sont étroits; la protection des branches (pas les autorisations des applications) impose "aucune écriture directe à `main`" et " pas de poussée forcée "  l'application n'est jamais ajoutée à la liste de contournements.`.github/workflows`Le dépôt de données est un dépôt de données qui est un dépôt de données qui ne peut être effectué par un dépôt de données.

## Architecture

```
GitHub issue labeled `@agent fix` or PR comment
            |
            v
    GitHub App webhook -> AWS Lambda dispatcher
            |
            v
    ECS Fargate task (or GitHub Actions self-hosted runner)
       - pull repo
       - infer Dockerfile (language, package manager)
       - Daytona / E2B sandbox with target runtime
       - clone -> git worktree -> agent branch
            |
            v
    mini-swe-agent / SWE-agent v2 loop
       Claude Opus 4.7 or GPT-5.4-Codex
       tools: ripgrep, tree-sitter, read/edit, run_tests, git
            |
            v
    verify CI passes in-sandbox + coverage delta check
            |
            v (verified)
    git push + open PR via GitHub App
       PR body = rationale + diff summary + trace URL
       label: needs-review
            |
            v
    operator reviews; can @-mention agent for follow-ups
```

## La pile

- Trigger: Application GitHub avec jeton à grains fins; récepteur webhook via Lambda ou Fly.io
- Travailleur: tâche ECS Fargate (ou coureur hébergé par lui-même par GitHub Actions)
- Sandbox: conteneur de développement Daytona ou sandbox E2B par tâche
- Boucle d'agent: base mini-swe-agent ou SWE-agent v2 sur Claude Opus 4.7 / GPT-5.4-Codex
- Récupération: carte de référencement de l'arbre-sitter + ripgrep
- Vérification: IC complète dans la boîte à sable + porte delta de couverture
- Observabilité: Langfuse avec archive de traces par RP relié par l'organisme RP
- Budget: plafond de dollar par rapport au rapport par jour; PR max par rapport au rapport par jour

```figure
cf-issue-to-pr
```

## Faites-le

1. **GitHub App.**Les éléments de la protection des branches (la seule surface qui peut le faire) imposent "aucune pression directe à la`main`" et " pas de poussée forcée "; l'application n'est pas dans la liste de contournement.`.github/workflows`" comme une liste de contrôle des permis sur la différence proposée, puisque les autorisations de l'application GitHub ne sont pas étendues par voie.

2. **Webhook receiver.**La fonction Lambda accepte les étiquettes de problème / commentaires de relations publiques.`@agent fix this`- Les files d'attente au SQS.

3. **Dispatcher.**Il remplit des tâches de SQS, il met en œuvre un budget par jour, il fait tourner une tâche de Fargate avec l'URL du repo, le corps de l'émission et une nouvelle boîte à sable Daytona.

4. **Environment inference.**Détecter le langage (Python, Node, Go, Rust) et le gestionnaire de paquets (uv, pnpm, go mod, cargo). Générer un fichier Docker en vol si celui-ci n'existe pas.

5. **Agent loop.**outils: ripgrep, tree-sitter repo-map, read_file, edit_file, run_tests, git. Limits d'utilisation: 20 $, 30 min de temps de travail, 30 tours d'agent.

6. **Verification.**Après la fin de la boucle, exécutez la suite complète de tests dans la boîte à sable.`needs-review`l'étiquette.

7. **PR posting.**Ouvrez les relations publiques via GitHub API avec: titre, justification, résumé différent, URL de suivi, coût, tournées.

8. **Credential hygiene.**Worker fonctionne avec un jeton d'installation de l'application GitHub de courte durée. Les journaux sont effacés pour les secrets avant l'archivage.

9. **Eval.**30 questions internes de difficulté variable. Mesurer le taux de réussite, la qualité des relations publiques (dimension différente, style, couverture), le coût, la latence. Comparer avec les agents de fond de cursor et les agents AWS SWE à distance sur les mêmes questions.

## Utilisez-le

```
# on github.com
  - user labels issue #842 with `@agent fix this`
  - PR #1903 appears 14 minutes later
  - body:
    > Fixed NPE in widget.dedupe() caused by null comparator entry.
    > Added regression test widget_test.go::TestDedupeNullComparator.
    > Coverage delta: +0.12%
    > Turns: 7  Cost: $1.80  Trace: langfuse:...
    > Label: needs-review
```

## La faire partir

`outputs/skill-issue-to-pr.md`Un travailleur en nuage asynchrone GitHub App + qui transforme les problèmes étiquetés en relations publiques prêtes à être examinées avec des coûts limités et des informations d'identification à portée de main.

| Weight | Criterion | How it is measured |
|:-:|---|---|
| 25 | Pass rate on 30 issues | End-to-end success (CI green + coverage OK) |
| 20 | PR quality | Diff size, coverage delta, style conformance |
| 20 | Cost and latency per resolved issue | $ and wall-clock per PR |
| 20 | Safety | Scoped token, per-repo budget, no force-push, credential hygiene |
| 15 | Operator UX | Rationale comments, retry affordance, @-mention follow-up |
| **100** | | |

## Exercices

1. Ajouter un mode "réparation de l'essai en éclats": l'étiquette `@agent stabilize-flake TestX`Il fait 50 fois le test dans la boîte à sable et propose un changement minimal qui le stabilise.

2. Comparer les coûts par rapport aux agents de fond de cursor sur trois questions partagées.

3. Mettre en œuvre un tableau de bord budgétaire: coût par répéteur par jour, coût par utilisateur.

4. Construire un mode "dry-run" qui ouvre un projet de relations publiques sans exécuter un CI, afin que les examinateurs puissent examiner le plan à moindre coût.

5. Ajouter une politique de conservation: les succursales de relations publiques de plus de 7 jours sans fusion sont automatiquement supprimées.

## Les termes clés

| Term | What people say | What it actually means |
|------|-----------------|------------------------|
| GitHub App | "Scoped bot identity" | App with fine-grained permissions + short-lived installation token |
| Async cloud agent | "Background agent" | Non-interactive worker that runs in a cloud sandbox, not a terminal |
| Environment inference | "Dockerfile synthesis" | Detect language + package manager, generate a Dockerfile if absent |
| Verification | "CI-in-sandbox" | Run the full test suite inside the worker before opening a PR |
| Coverage delta | "Coverage preservation" | Change in test coverage % from base to agent branch |
| Per-repo budget | "Daily ceiling" | Dollar and PR-count cap enforced at the dispatcher |
| Rationale | "PR body explanation" | Agent's summary of what changed and why; required in the PR body |

## Pour en savoir plus

- [AWS Remote SWE Agents](https://github.com/aws-samples/remote-swe-agents) la référence de l'agent de nuage asynchrone canonique
- [SWE-agent](https://github.com/SWE-agent/SWE-agent) référence aux CLI
- [Cursor Background Agents](https://docs.cursor.com/background-agent) alternative commerciale
- [OpenAI Codex (cloud)](https://openai.com/codex) concurrent hébergé
- [Google Jules](https://jules.google) La version hébergée par Google
- [Factory Droids](https://www.factory.ai) référence commerciale alternative
- [GitHub App documentation](https://docs.github.com/en/apps) identité du bot à portée de main
- [Daytona cloud sandboxes](https://daytona.io) boîte à sable de référence
