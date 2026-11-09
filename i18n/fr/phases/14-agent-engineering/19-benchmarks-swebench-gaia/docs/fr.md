# Les critères de référence: banc SWE, GAIA, agentBench

> Trois critères de référence évaluation des agents d'ancrage en 2026. SWE-bench teste le patchage de code. GAIA teste l'utilisation des outils généralistes. AgentBench teste le raisonnement multi-environnement. Connaître leur composition, leur histoire de contamination et ce qu'ils ne mesurent pas.

**Type:** Learn
**Languages:** Python (stdlib), TypeScript
**Prerequisites:** Phase 14 · 06 (Tool Use)
**Time:** ~60 minutes

## Objectifs d'apprentissage

- Nommez le harnais d'essai du banc SWE (FAIL_TO_PASS) et expliquez pourquoi il est exempt des tests unitaires.
- Expliquez pourquoi SWE-bench Verified (OpenAI, 500 tâches) existe et ce qu'il supprime.
- Décrivez la conception de GAIA: simple pour les humains, difficile pour l'IA; trois niveaux de difficulté.
- Nommez les huit environnements d'AgentBench et son principal bloqueur pour les LLM open source.
- Résumez la constatation de contamination du banc SWE+ et ses implications.

## Le problème

Les classements vous indiquent quel modèle gagne sur un critère de référence.

- Si le point de référence est contaminé (résolutions dans les données de formation, fuite de test).
- Si le benchmark mesure ce qui vous intéresse (code vs navigation vs généraliste).
- Si l'évaluateur est robuste (conformité AST, vérification de l'état, examen humain).

Connaître les trois indicateurs d'ancrage et leurs modes d'échec avant de citer un nombre.

## Le concept

### SWE-bench (Jimenez et coll., ICLR 2024 orale)

- 2 294 problèmes réels de GitHub provenant de 12 repositories Python populaires.
- L'agent obtient: la base de code à la préfix commit + description du problème en langage naturel.
- L'agent produit un patch.
- Évaluateur: appliquer le correctif, exécuter la suite de tests du repo. Le correctif doit faire revenir les tests FAIL_TO_PASS (anciennement échecs, maintenant réussissant) sans casser les tests PASS_TO_PASS.

SWE-agent (Yang et coll., 2024) a atteint 12,5% à la sortie en mettant l'accent sur les interfaces agent-ordinateur (commandes de l'éditeur de fichiers, syntaxe de recherche que le modèle comprend).

### Banque SWE vérifiée

OpenAI, août 2024. sous-ensemble de 500 tâches géré par l'homme. Élimine les problèmes ambiguës, les tests peu fiables et les tâches où la correction n'était pas claire.

### Contamination

- Plus de 94% des émissions de banque SWE précèdent la plupart des coupes de modèle.
- **SWE-bench+**Il a été constaté que 32,67% des correctifs réussis ont vu des solutions fuites dans le texte de l'émission (le modèle a vu la correction dans la description), et 31,08% étaient suspects en raison de la faible couverture des tests.
- Il est plus propre, mais pas sans contamination.

Implication pratique: un modèle qui obtient 50% de score sur le banc SWE peut obtenir 35% sur le banc SWE+. Rapporte toujours les deux si vous revendiquez des performances sur le banc SWE.

### GAIA (Mialon et coll., novembre 2023)

- 466 questions; 300 ont été conservées pour le classement privé à huggingface.co/gaia-benchmark.
- Philosophie de conception: "conceptuellement simple pour les humains (92%) mais difficile pour l'IA (GPT-4 avec plugins: 15%)."
- Tests de raisonnement, de multi-modalité, de web, d'utilisation des outils.
- Trois niveaux de difficulté; le niveau 3 nécessite de longues chaînes d'outils sur les différentes modalités.

GAIA est ce que vous utilisez pour mesurer la "capacité généraliste". Ne la confond pas avec des critères de référence spécifiques au code.

### L'agent Bench (Liu et coll., ICLR 2024)

- 8 environnements à travers le code (Bash, DB, KG), les jeux (Alfworld, LTP), le web (WebShop, Mind2Web) et la génération ouverte.
- Multi-tours, environ 4K-13K de tours par partage.
- Résumé: Le raisonnement à long terme, la prise de décision et l'instruction suivantes sont les obstacles aux LLM OSS qui arrivent à la commercialisation.

### Ce que ces mesures ne mesurent pas

- Coût opérationnel réel (tokens, horloge murale).
- Comportement de sécurité dans des conditions adverses.
- Performance sur votre domaine (utilisez vos propres évaluations, leçon 30).
- Les défaillances de la queue (moyenne des points de référence; les opérateurs de production s'occupent des 1% les plus graves).

### Lorsque l'analyse comparative se trompe

- **Single-number fixation.**Le SWE-bench 50% vous indique moins que le coût P50/P75/P95 + distribution étape.
- **Contaminated claims.**Le fait de déclarer le benchmark SWE sans mentionner le benchmark Verified ou le benchmark SWE+ est trompeur.
- **Benchmark-as-development-target.**L'optimisation pour le point de référence diffère de l'utilité de la production.

```figure
ae-swebench-gate
```

## Faites-le

`code/main.py`met en place un harnais de jeu SWE-bench:

- Les tâches de correction de bugs synthétiques (3 tâches).
- Un "agent" avec un script qui propose des correctifs.
- Un test qui vérifie FAIL_TO_PASS (bug maintenant corrigé) et PASS_TO_PASS (rien cassé).
- Un classificateur de difficulté de style GAIA basé sur la profondeur de la décomposition des questions.

- Je vais le faire.

```
python3 code/main.py
npx tsx code/main.ts
```

La sortie montre le taux de résolution par tâche + par difficulté et rend les règles de l'évaluateur concrètes.

## Utilisez-le

- **SWE-bench Verified**Pour les agents de code, rapportez toujours les scores vérifiés.
- **GAIA**Pour les agents généralistes, utilisez la division privée.
- **AgentBench**pour la comparaison multi-environnement.
- **Custom evals**(Létion 30) pour la forme réelle de votre produit.

## La faire partir

`outputs/skill-benchmark-harness.md`construit un harnais de style SWE-bench pour toute paire de tâches de base de code avec une fermeture FAIL_TO_PASS / PASS_TO_PASS.

## Exercices

1. Portez le harnais de jouet pour qu'il fonctionne sur un réel repo (en choisissez un de vos).
2. Pour les 3 tâches, combien d'acteurs par résolution ?
3. Lire le document SWE-bench+.Mettre en œuvre une vérification de fuite de solution (parallèlement du modèle du texte de la question par rapport au diff).
4. Téléchargez une question de l'Agence de l'Agence de l'Agence de l'Agence de l'Agence de l'Agence de l'Agence de l'Agence de l'Agence de l'Agence de l'Agence de l'Agence de l'Agence de l'Agence de l'Agence de l'Agence de l'Agence de l'Agence de l'Agence de l'Agence de l'Agence de l'Agence de l'Agence de l'Agence de l'Agence de l'Agence de l'Agence de l'Agence de l'Agence de l'Agence de l'Agence de l'Agence de l'Agence de l'Agence de l'Agence de l'Agence de l'Agence de l'Agence de l'Agence de l'Agence de l'Agence de la recherche sur la recherche et de la recherche sur le suivi du public.
5. Lisez l'analyse de l'agent Bench sur l'environnement, quel environnement reflète la surface de votre produit, à quoi ressemble le "SOTA" ?

## Les termes clés

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| SWE-bench | "Code agent benchmark" | 2,294 GitHub issues; patch must flip FAIL_TO_PASS tests |
| SWE-bench Verified | "Clean SWE-bench" | 500 human-curated tasks, OpenAI |
| FAIL_TO_PASS | "Fix gate" | Tests previously failing that must pass after the patch |
| PASS_TO_PASS | "No-regression gate" | Tests that were passing and must still pass |
| GAIA | "Generalist benchmark" | 466 human-easy / AI-hard multi-tool questions |
| AgentBench | "Multi-env benchmark" | 8 environments; long-horizon multi-turn |
| Contamination | "Training-set leak" | Benchmark tasks present in model training |
| SWE-bench+ | "Contamination audit" | 32.67% solution leakage found in successful SWE-bench patches |

## Pour en savoir plus

- [Jimenez et al., SWE-bench (arXiv:2310.06770)](https://arxiv.org/abs/2310.06770) l'indice de référence initial
- [OpenAI, SWE-bench Verified](https://openai.com/index/introducing-swe-bench-verified/) le sous-ensemble sélectionné
- [Mialon et al., GAIA (arXiv:2311.12983)](https://arxiv.org/abs/2311.12983) référence générale
- [Liu et al., AgentBench (arXiv:2308.03688)](https://arxiv.org/abs/2308.03688) suite multi-environnement
