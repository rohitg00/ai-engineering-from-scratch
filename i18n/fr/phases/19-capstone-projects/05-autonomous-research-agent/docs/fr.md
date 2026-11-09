# Capstone 05  Agent de recherche autonome (classe de scientifique en IA)

> L'AI-Scientist-v2 de Sakana a publié des articles complets. L'agent Laboratoire a fait les expériences. Allen AI a partagé des traces. La forme 2026 est la recherche d'arbres sur les expériences, le coût budgétaire, l'exécution du code sandboxé, un rédacteur LaTeX à rétroaction visuelle et un ensemble d'examenurs de style NeurIPS automatisé. Le but est de construire un, de le faire fonctionner de bout en bout à 30 $ par papier, et de survivre à l'équipe rouge de sandbox-escape que Sakana a documenté.

**Type:** Capstone
**Languages:** Python (agent + sandbox), TypeScript, LaTeX (output)
**Prerequisites:** Phase 2 (ML), Phase 3 (deep learning), Phase 7 (transformers), Phase 10 (LLMs from scratch), Phase 14 (agents), Phase 15 (autonomous), Phase 16 (multi-agent), Phase 18 (safety)
**Phases exercised:**P0 · P2 · P3 · P7 · P10 · P14 · P15 · P16 · P18
**Time:** 40 hours

## Problème

Les agents de recherche autonomes ont franchi un seuil en 2026. L'étude AI-Scientist-v2 de Sakana AI a été publiée dans Nature avec des documents générés qui ont permis l'examen par les pairs de l'atelier. ShinkaEvolve (ICLR 2026) a étendu la ligne aux hypothèses en évolution. Le laboratoire d'agents de l'AMD a envoyé des traces reproducibles. Les agents ne sont pas magiques, ils sont une boucle de vérification des projets, avec des limites de coûts, des boîtes de sable et des examens automatisés. Le bateau est en phase, le budget et l'histoire de sécurité.

Vous apprenez la boucle en appliquant une contre une idée de semence dans un domaine étroit (par exemple, des ablations d'attention-sparsité sur un transformateur de paramètre 100M). La valeur n'est pas de découvrir quelque chose de nouveau dès le premier coup. La valeur est dans l'infrastructure: la recherche en arbre, la boîte à sable des expériences, la boucle écrivain-réviseur, le rapport de l'équipe rouge. L'équipe de Sakana a documenté des échecs de fuite de la boîte à sable. Votre agent doit passer la même équipe rouge.

## Concept

L'agent est un premier arbre de recherche. Les nœuds sont des spécifications de l'expérience: (hypothèse, configuration, code, résultat attendu). Une étape d'expansion propose aux enfants de modifier de petites choses (optimisateur de swap, taille de lot de changement, ablate un composant). Chaque enfant court dans une boîte à sable fraîche avec un capot de ressources dur. Les résultats sont transmis dans une fonction de notation qui classe les nœuds par (nouvelles × qualité × budget restant). L'arbre pousse jusqu'à ce que le budget soit épuisé, puis la meilleure branche est écrite.

L'écrivain est multimodal. Il génère un projet LaTeX, le compile, rend les chiffres et renvoie le PDF rendu dans le mode de vision de Claude Opus 4.7 pour critiquer la mise en page, la lisibilité des figures et l'alignement des preuves de revendications. Un ensemble de réviseurs de cinq juges de la LLM émet des scores de style NeurIPS (nouveauté, rigueur, clarté, reproductibilité, impact); si la moyenne tombe en dessous du seuil, le papier revient à l'écrivain avec critique.

La sécurité est assurée. Chaque expérience se déroule dans une boîte à sable E2B ou Daytona sans sortie réseau, horloge murale limitée et limites de ressources fichées.

## Architecture

```
seed idea + domain
      |
      v
  literature search (Semantic Scholar + OpenAlex + FAISS cache)
      |
      v
  LangGraph plan-execute-verify tree
      |
      v
  +--- expand node ----+      per-node sandbox
  |                    |      (E2B / Daytona)
  v                    v      resource caps
  child_1           child_k   no network egress
  |                    |      deterministic seeds
  v                    v
  run experiment       run experiment
  |                    |
  v                    v
  score nodes by (novelty, quality, budget)
      |
      v
  best branch -> LaTeX writer
      |
      v
  compile + vision critique (Opus 4.7 vision)
      |
      v
  reviewer ensemble (5 LLM judges, NeurIPS rubric)
      |
      v
  paper.pdf + review.md + trace.json
```

## La pile

- Orchestration: LangGraph avec points de contrôle et portes d'homologation
- Recherche d'arbre: meilleur premier sur les nœuds d'expérience personnalisés (style AB-MCTS de Sakana v2)
- Sandbox: E2B par expérience, Docker-in-Docker retrait; limites des ressources par cgroups
- Littérature: API de graphique sémantique + OpenAlex + cache local de résumés FAISS
- Écrivain: modèle LaTeX + Claude Opus 4.7 (mode vision) pour la critique et la mise en page des figures
- Réviseur: ensemble de 5 juges (Opus 4.7, GPT-5.4, Gemini 3 Pro, DeepSeek R1, Qwen3-Max) avec aggregation pondérée
- Cadre d'expérimentation: PyTorch 2.5 pour les expériences physiques, W&B pour l'exploitation forestière
- Observabilité: Langfuse pour les traces d'agent, budget difficile de 30 $ par papier

```figure
ce-experiment-tree
```

## Faites-le

1. **Seed and domain scoping.**Prenez une idée de semence (par exemple, "enquêter sur les modèles de rareté dans les cartes d'attention des transformateurs sub-1B"). Définir l'espace de recherche: modèles, ensembles de données, budget de calcul.

2. **Literature pass.**Rechercher Semantic Scholar + OpenAlex pour 50 documents pertinents les plus cités; résumés de cache localement; générer un digeste de domaine de 1 page.

3. **Tree scaffolding.**Initialement la racine avec l'hypothèse de semence.`expand(node) -> children`avec des propositions de petite modification (un changement de configuration par enfant).`score(node)`comme nouvelle pondérée × qualité × budget.

4. **Sandbox wrapping.**Chaque expérience est réalisée .`docker run --network=none --memory=8g --cpus=2 --pids-limit=256 --read-only`Les graines sont écrites dans la boîte à sable; les sorties sont montées à lire uniquement en arrière.

5. **Plan-execute-verify loop.** `plan`propose des enfants. `execute`Il exploite la boîte à sable, capture les journaux et les métriques. `verify`Les nœuds défaillants obtiennent une raison de défaillance stockée sur l'arbre.

6. **Writer.**Après le budget, sélectionnez la meilleure branche. Render des chiffres avec matplotlib. Générer un projet LaTeX via Claude Opus 4.7 avec la trace de branche dans le contexte. Compiler. Donner le PDF compilé à la vision Opus 4.7 pour la critique. Iterer.

7. **Reviewer ensemble.**Cinq juges notent le projet sur (nouvelle, rigueur, clarté, reproductibilité, impact) avec des rubriques de style NeurIPS. Si la moyenne est <4,0/5, retournez à l'écrivain avec critique. Arrêt dur après 3 réécrits.

8. **Red team.**Construire ou intégrer un ensemble de tâches adversitaires ciblant la boîte à sable: bombes à fourchette, tentatives d'exfiltration du réseau, échappements du système de fichiers, métacharacters de coquille écrits par LLM. Confirmer que tous sont bloqués. Écrire les résultats.

9. **Reproducibility.**Chaque papier est livré avec son arbre de recherche JSON, graines, W & B run links, sandbox configurations, et un README reproduisant de bout en bout.

## Utilisez-le

```
$ ai-scientist run --seed "attention sparsity in sub-1B transformers" --budget 30
[lit]    50 papers, digest in 12s
[tree]   expanded 8 nodes, budget 12/30
[exec]   node #3 sparsity=top-8, loss=2.83 (best so far)
[exec]   node #6 sparsity=top-4, loss=3.12 (worse)
[exec]   ...
[tree]   chose branch rooted at node #3 (novelty 0.62, quality 0.81)
[write]  LaTeX draft v1 complete
[vision] critique: figure 2 legend too small, claim-evidence ok
[write]  draft v2 after 3 edits
[review] mean 4.2/5 (novelty 3.9, rigor 4.3, clarity 4.1, repro 4.5, impact 4.2)
[done]   paper.pdf + review.md + trace.json     $28.40 spent
```

## La faire partir

`outputs/skill-ai-scientist.md`Si vous avez une idée de semence + un domaine + un budget de 30 $, il fonctionne complètement et émet un document révisable plus un paquet de reproductibilité.

| Weight | Criterion | How it is measured |
|:-:|---|---|
| 25 | Paper quality | Blind rubric review against published workshop papers |
| 20 | Experimental rigor | Baselines, seeds, ablations; every claim backed by a cell in the results table |
| 20 | Cost and compute discipline | $30/paper ceiling enforced, Langfuse-traced |
| 20 | Safety | Sandbox red team passes; network policy and kill-switch verified |
| 15 | Reproducibility | One-command rerun with identical seeds reproduces the paper |
| **100** | | |

## Exercices

1. Exécutez le pipeline contre trois idées de semences différentes dans le même domaine. Comparer quelles parties de la recherche sur l'arbre se chevauchent. Identifier le calcul gaspillé dupliqué.

2. Ajouter une passerelle humaine avant l'exécution de l'expérience pour les nœuds estimés à plus de 5 $. Mesurer la diminution du coût total.

3. Échangez l'ensemble des critiques pour un seul juge, mesurez le taux de faux acceptés sur un ensemble de mauvais articles connus.

4. Introduire un test d' équipe rouge d' exfiltration du réseau: l' agent écrit du code qui tente de `curl`Une adresse externe.`--network=none`La politique le bloque.

5. Comparer votre recherche sur les arbres avec une ligne de base aléatoire plate (même budget, aucune stratégie d'expansion).

## Les termes clés

| Term | What people say | What it actually means |
|------|-----------------|------------------------|
| Tree search | "AB-MCTS-style expansion" | Best-first exploration over experiment nodes with a novelty×quality×budget score |
| Sandbox | "Experiment isolation" | Container with no network, bounded CPU/memory, pinned seeds, read-only inputs |
| Vision critique | "Render-then-read" | Compile the paper to PDF, feed the PDF back to a VLM for layout and claim-evidence critique |
| Reviewer ensemble | "Automated peer review" | Multiple LLM judges scoring the paper with a NeurIPS rubric; weighted aggregate gates the pipeline |
| Novelty score | "Is this new?" | Heuristic that penalizes proximity to the 50-paper literature cache |
| Cost ceiling | "$ budget" | Hard cap on total spend per paper; Langfuse counters + pre-run estimates |
| Red team | "Sandbox-escape audit" | Adversarial tasks that would escape the sandbox if the policy is wrong |

## Pour en savoir plus

- [Sakana AI-Scientist-v2 repository](https://github.com/SakanaAI/AI-Scientist-v2) l'agent de recherche de référence en production
- [Sakana AI-Scientist-v1 paper (arXiv:2408.06292)](https://arxiv.org/abs/2408.06292) la méthodologie originale
- [ShinkaEvolve (Sakana ICLR 2026)](https://sakana.ai) Extension évolutionniste
- [Agent Laboratory (AMD)](https://github.com/SamuelSchmidgall/AgentLaboratory) Cadre multi-role de laboratoire de recherche
- [LangGraph documentation](https://langchain-ai.github.io/langgraph/) couche d'orchestration de référence
- [Semantic Scholar Graph API](https://api.semanticscholar.org/) Recherche de littérature
- [E2B sandboxes](https://e2b.dev) Isolement des expériences de référence
- [NeurIPS reviewer guidelines](https://neurips.cc/Conferences/2026/ReviewerGuidelines) la rubrique que l'ensemble de réviseurs code
