# Capstone 01  Agent de codage natif du terminal

> D'ici 2026, la forme d'un agent de codage est réglée. Un harnais TUI, un plan d'état, une surface d'outils en boîte à sable, une boucle qui planifie, agit, observe, récupère. Claude Code, Cursor 3 et OpenCode sont tous pareils à 50 pieds. Ce capstone vous demande de construire une extrémité à l'autre  CLI, retirer la demande  et la mesurer contre mini-swe-agent et Live-SWE-agent sur SWE-bench Pro. Vous apprendrez pourquoi le plus difficile n'est pas l'appel de modèle mais la boucle d'outils, la boîte à sable et le plafond de coût sur une course de 50 tours.

**Type:** Capstone
**Languages:** TypeScript / Bun (harness, loop scaffold), Python (eval scripts)
**Prerequisites:** Phase 11 (LLM engineering), Phase 13 (tools and protocols), Phase 14 (agents), Phase 15 (autonomous systems), Phase 17 (infrastructure)
**Phases exercised:**P0 · P5 · P7 · P10 · P11 · P13 · P14 · P15 · P17 · P18
**Time:** 35 hours

## Problème

Les agents de codage sont devenus la catégorie d'application d'IA dominante en 2026. Claude Code (Anthropic), Cursor 3 avec Composer 2 et Tabs d'Agent (Cursor), Amp (Sourcegraph), OpenCode (112k étoiles), Factory Droids et Google Jules sont toutes des variantes de la même architecture: un harnais terminal, une surface d'outil autorisée, une boîte à sable et une boucle d'observation de plan-acte construite autour d'un modèle frontalier. La frontière est étroite  L'agent SWE-Live a atteint 79,2% sur le banc SWE vérifié avec Opus 4.5  mais l'ingénierie artisanal est large. La plupart des modes d'échec ne sont pas des erreurs de modèle. Il s'agit de l'instabilité de la boucle d'outils, de l'empoisonnement du contexte, du coût des jetons en fuite et des opérations destructives du système de fichiers.

Vous devez construire un, regarder la boucle s'écraser sur le virage 47 quand Ripgrep renvoie 8 MB de matches, et reconstruire la couche de tronçage.

## Concept

Le harnais a quatre surfaces.**Plan**maintient un objet d'état de style TodoWrite que le modèle réécrit à chaque tour. **Act**envoie des appels à l'outil (lire, modifier, exécuter, rechercher, git). **Observe**capture les codes de sortie / stderr / stdout, tronque et renvoie le résumé. **Recover**Il est également possible de modifier le format de la page d'accueil en fonction de la taille de l'outil.**hooks**- Je suis là .`PreToolUse`- Je suis là .`PostToolUse`- Je suis là .`SessionStart`- Je suis là .`SessionEnd`- Je suis là .`UserPromptSubmit`- Je suis là .`Notification`- Je suis là .`Stop`, et `PreCompact` points d'extension configurables où l'opérateur injecte des mesures de police, de télémétrie et de barreaux de protection.

La boîte à sable est E2B ou Daytona. Chaque tâche est exécutée dans un nouveau conteneur de développement avec une lecture-écriture montée sur un git worktree. Le harnais ne touche jamais le système de fichiers hôte. L'arbre de travail est démoli en fonction du succès ou de l'échec. Le contrôle des coûts est appliqué à trois niveaux: un plafond de jeton par tour, un budget en dollars par session et une limite de tour dur (typiquement 50). La couche d'observabilité est OpenTelemetry couvre avec les conventions sémantiques GenAI, expédié à un Langfuse auto-hébergé.

## Architecture

```
  user CLI  ->  harness (Bun + Ink TUI)
                  |
                  v
           plan / act / observe loop  <--->  Claude Sonnet 4.7 / GPT-5.4-Codex / Gemini 3 Pro
                  |                          (via OpenRouter, model-agnostic)
                  v
           tool dispatcher (MCP StreamableHTTP client)
                  |
     +------------+------------+----------+
     v            v            v          v
  read/edit    ripgrep     tree-sitter   git/run
     |            |            |          |
     +------------+------------+----------+
                  |
                  v
           E2B / Daytona sandbox  (worktree isolated)
                  |
                  v
           hooks: Pre/Post, Session, Prompt, Compact
                  |
                  v
           OpenTelemetry -> Langfuse (spans, tokens, $)
                  |
                  v
           PR via GitHub app
```

## La pile

- Durée de fonctionnement du harnais: Bun 1.2 + Ink 5 (réaction en terminal)
- Accès modèle: API unifiée OpenRouter avec Claude Sonnet 4.7, GPT-5.4-Codex, Gemini 3 Pro, Opus 4.5 (pour les tâches les plus difficiles)
- Transports d'outils: modèle de protocole contextuel StreamableHTTP (révision du MCP 2026)
- Sandbox: boîtes de sable E2B (JS SDK) ou conteneurs de développement Daytona
- Recherche de code: sous-processus ripgrep, parser de garde d'arbre pour 17 langues (précompilé)
- Isolement: `git worktree add`par tâche, nettoyage sur le succès / échec
- Harnais égal: SWE-bench Pro (sous-ensemble vérifié) + Terminal-Bench 2.0 + votre propre détenteur de 30 tâches
- Observabilité: SDK OpenTelemetry avec `gen_ai.*`semconv → Langfuse hébergée par elle-même
- Publication de relations publiques: Application GitHub avec jeton à grains fins, portée limitée au repo cible

```figure
ce-agent-loop
```

## Faites-le

1. **TUI and command loop.**Établis un projet de Bun avec de l'encre.`agent run <repo> "<task>"`. Imprimez une vue partagée: panneau de plan (en haut), flux d' appels d' outils (moyen), budget de jeton (en bas). Ajoutez annuler sur le bouton Ctrl-C qui est activé `SessionEnd`- Je vous en prie.

2. **Plan state.**Définir un schéma TodoWrite typé (en attente / en cours / objets finis avec notes). Le modèle réécrit l'état complet à chaque tour en tant qu'appel à l'outil  ne le laissez pas muter progressivement.`.agent/state.json`pour que les accidents puissent reprendre.

3. **Tool surface.**Définir six outils: `read_file`- Je suis là .`edit_file`(avec une vue d' avant différente),`ripgrep`- Je suis là .`tree_sitter_symbols`- Je suis là .`run_shell`(avec délai), `git`(état / diff / commit / push). Exposez sur MCP StreamableHTTP afin que le harnais soit transport-agnostique. Chaque outil renvoie une sortie tronquée (cap à 4k tokens par appel).

4. **Sandbox wrapping.**Chaque tâche engendre une boîte à sable E2B. `git worktree add -b agent/$TASK_ID`Toutes les appels à l'outil sont exécutés à l'intérieur de la boîte à sable.

5. **Hooks.**Mettre en œuvre les huit types de crochets 2026:`PreToolUse`- La garde de commandement destructeur qui bloque`rm -rf`à l'extérieur du bois de travail, b) `PostToolUse`comptabilité symbolique, c) `SessionStart`initialisation budgétaire, d)`Stop`écrit un dernier traceur.

6. **Eval loop.**Clonez un sous-ensemble de 30 éditions de SWE-bench Pro Python. Appliquez votre harnais contre chacun. Comparer à mini-swe-agent (la ligne de base minimale) sur pass@1, tour par tâche et $-par tâche. Écrivez les résultats à `eval/results.jsonl`- Je suis désolé .

7. **Cost control.**Des limites difficiles: 50 tours, 200 000 contextes, 5 $ par tâche. `PreCompact`Hook résume les plus anciennes virages en un bloc d'état antérieur à la marque 150K, libérant de la place pour de nouvelles observations sans perdre le plan.

8. **PR posting.**Pour réussir, la dernière étape est `git push`+ un appel à l'API GitHub qui ouvre une relation avec le plan et le résumé différent dans le corps.

## Utilisez-le

```
$ agent run ./my-repo "Fix the race condition in worker.rs"
[plan]  1 locate worker.rs and enumerate mutex uses
        2 identify shared state under contention
        3 propose fix, verify tests
[tool]  ripgrep mutex.*lock -t rust           (44 matches, truncated)
[tool]  read_file src/worker.rs 120..180
[tool]  edit_file src/worker.rs (+8 -3)
[tool]  run_shell cargo test worker::          (passed)
[plan]  1 done · 2 done · 3 done
[done]  PR opened: #482   turns=9   tokens=38k   cost=$0.41
```

## La faire partir

La compétence délivrable vit dans `outputs/skill-terminal-coding-agent.md`. En fonction d'un chemin de référencement et d'une description de tâche, il exécute la boucle complète plan-acte-observer dans une boîte à sable et renvoie une URL PR plus un paquet de traces.

| Weight | Criterion | How it is measured |
|:-:|---|---|
| 25 | SWE-bench Pro pass@1 vs baseline | Your harness vs mini-swe-agent on 30 matched Python tasks |
| 20 | Architecture clarity | Plan/act/observe separation, hook surface, tool schema — reviewed against Live-SWE-agent layout |
| 20 | Safety | Sandbox escape tests, permission prompts, destructive-command guard passes red-team |
| 20 | Observability | Trace completeness (100% of tool calls spanned), token accounting per turn |
| 15 | Developer UX | Cold-start < 2s, crash recovery resumes plan, Ctrl-C cancels mid-tool cleanly |
| **100** | | |

## Exercices

1. Changer le modèle de support de Claude Sonnet 4.7 vers Qwen3-Coder-30B servi sur vLLM. Comparer pass@1 et $-per-task. Rapporte où le modèle ouvert fonctionne moins bien.

2. Ajouter un `reviewer`- sous-agent qui lit le diff avant la publication des relations publiques et peut demander une boucle de révision. Mesurer si les avis faux positifs font baisser le taux de réussite du bench SWE en dessous de la ligne de base pour un seul agent (indice: généralement oui).

3. Test de stress: écrire une tâche qui tente de `curl`une URL externe et une tâche qui écrit en dehors de l'arbre de travail. Confirmez que les deux sont bloqués par le crochet PreToolUse.

4. Mise en œuvre `PreCompact`La résolution de la répartition des données est réalisée avec un modèle plus petit (Haiku 4.5).

5. Échangez le transport MCP StreamableHTTP pour le studio, marquez le démarrage à froid et la latence par appel, choisissez un gagnant pour un usage local.

## Les termes clés

| Term | What people say | What it actually means |
|------|-----------------|------------------------|
| Harness | "The agent loop" | The code surrounding the model that dispatches tools, maintains plan state, and enforces budgets |
| Hook | "Agent event listener" | A user-authored script run on one of eight lifecycle events by the harness |
| Worktree | "Git sandbox" | A linked git checkout at a separate path; disposable without touching the main clone |
| TodoWrite | "Plan state" | A typed list of pending/in-progress/done items the model rewrites each turn |
| StreamableHTTP | "MCP transport" | 2026 MCP revision: long-lived HTTP connection with bidirectional streaming; replaces SSE |
| Token ceiling | "Context budget" | Per-turn or per-session cap on input+output tokens; triggers compaction or termination |
| pass@1 | "Single-attempt pass rate" | Fraction of SWE-bench tasks solved on the first run without retry or test-set peeking |

## Pour en savoir plus

- [Claude Code documentation](https://docs.anthropic.com/en/docs/claude-code) harnais de référence d'Anthropic
- [Cursor 3 changelog](https://cursor.com/changelog) Agents Tabs et notes de produit compositeur 2
- [mini-swe-agent](https://github.com/SWE-agent/mini-swe-agent) limite minimale de référence pour la comparaison entre le harnais de banc et le harnais de la SWE
- [Live-SWE-agent](https://github.com/OpenAutoCoder/live-swe-agent) 79,2% de la banque SWE vérifiée avec Opus 4.5
- [OpenCode](https://opencode.ai)- Une harnais ouverte, 112 000 étoiles
- [SWE-bench Pro leaderboard](https://www.swebench.com) l'évaluation des objectifs de cette pierre angulaire
- [Model Context Protocol 2026 roadmap](https://blog.modelcontextprotocol.io/posts/2026-mcp-roadmap/) StreamableHTTP, métadonnées de capacité
- [OpenTelemetry GenAI semantic conventions](https://opentelemetry.io/docs/specs/semconv/gen-ai/) schéma de durée pour les appels à l' outil et l'utilisation des jetons
