# Scientifique de l'IA v2  Recherche autonome au niveau de l'atelier

> L'AI Scientist de Sakana v2 (Yamada et coll., arXiv:2504.08066) gère la boucle de recherche complète: hypothèse, code, expériences, chiffres, écriture, soumission. Il s'agit du premier système à avoir une revue par les pairs de la réussite papier générée lors d'un atelier ICLR 2025. Une évaluation indépendante (Beel et coll.) a révélé que 42% des expériences avaient échoué à cause d'erreurs de codage et que l'examen de la littérature étiquetage souvent mal les concepts établis comme nouveaux. Les docteurs de Sakana ont mis en garde que la base de code exécute le code écrit par LLM et recommandent l'isolement de Docker. Les deux parties de cette image sont le point.

**Type:** Learn
**Languages:** Python, TypeScript (stdlib, research-loop state-machine toy)
**Prerequisites:** Phase 15 · 03 (AlphaEvolve), Phase 15 · 04 (DGM)
**Time:** ~60 minutes

## Le problème

La recherche est une tâche ouverte. Contrairement à la recherche algorithmique d'AlphaEvolve ou à l'auto-modification limitée par référence de DGM, un résultat de recherche n'a pas de critère de précision vérifiable par machine. Un article est jugé par les réviseurs, pas par les tests unitaires. Cela rend la boucle plus difficile à fermer  et plus précieuse si elle est fermée, car la recherche est le lieu où vit le progrès composant.

AI Scientist v1 (Sakana, 2024) a fermé la boucle en partant des modèles écrits par l'homme. Le LLM a rempli des expériences dans un échafaudage fixe. AI Scientist v2 (Yamada et coll., 2025) supprime l'exigence de modèle en utilisant la recherche d'arbre agent avec une boucle de critique de modèle en langage de vision. Le système génère des idées, implémentera des expériences, produira des chiffres, écrira un article et réitérera les commentaires des critiques.

Résumé: un article généré par v2 a été accepté lors d'un atelier ICLR 2025 (avec révélation). Résumé: le système est loin d'être fiable.

## Le concept

### L'architecture

1. **Idea generation.**Le LLM propose des idées de recherche conditionnées sur un sujet et la littérature antérieure. v1 utilise des modèles; v2 utilise une recherche agentique sur un espace d'hypothèses.
2. **Novelty check.**Une étape de récupération de la littérature vérifie si l'idée a été publiée.
3. **Experiment plan.**L'agent rédige un protocole expérimental et écrit du code.
4. **Execution.**Le code est exécuté dans une boîte à sable. Les défaillances sont renvoyées dans une boucle de réessayer. Dans les mesures de Beel et al., 42% des expériences ont échoué à cause d'erreurs de codage à ce stade.
5. **Figure generation.**Un modèle de langage visuel lit les chiffres générés et les réécrit pour la clarté.
6. **Writeup.**Le LLM rédige un article, il y a un réviseur interne.
7. **Optional: submission.**Le document est soumis à un lieu.

### Ce que signifie le résultat de l'acceptation de l'atelier

Un article généré par v2 a passé l'examen par les pairs lors d'un atelier ICLR 2025. Les auteurs ont révélé l'origine du papier au comité du programme.

Un rapport de travail de l'équipe de recherche de l'Université de Londres (Université de Londres) a été publié en juin, et il a été publié en juin, en juin, en juin, par le journal Nature.

### Ce que l'évaluation indépendante a révélé

Beel et coll. (arXiv:2502.14297) ont mené une évaluation externe.

- **Experiment failures.**42% des expériences ont échoué en raison d'erreurs de codage (mauvaises importations, défaillances de forme, variables non définies).
- **Novelty mislabeling.**La recherche de la littérature et de la récupération ont souvent marqué les concepts établis comme nouveaux.
- **Presentation-quality gap.**La critique des figures du langage de vision a produit des visuels de qualité de publication, masquant les faiblesses expérimentales sous-jacentes.

La dernière conclusion est importante pour cette phase: un système qui produit des résultats convaincants sans faire de recherches convaincantes est plus dangereux, pas plus sûr, que celui qui échoue évidemment.

### Le problème de l'évasion des sablettes

Le propre référentiel de Sakana README prévient:

> En raison de la nature de ce logiciel, qui exécute le code généré par LLM, nous ne pouvons pas garantir la sécurité. Il y a des risques de paquets dangereux, accès non contrôlé au web et de reproduction de processus non intentionnés. Utilisez à vos risques et considérez l'isolement Docker.

Il s'agit de la forme opérationnelle de l'autonomie dans un domaine non vérifié. Le LLM écrit du code; le code fonctionne; le code peut faire tout ce que le processus est autorisé à faire. Sans une boîte à sable qui limite durement le système de fichiers, le réseau et les actions de processus, tout agent de recherche autodirectionné peut exfiltrer les données, brûler le calcul ou se réécrire.

L'histoire de la boîte à sable d'AlphaEvolve est plus facile parce que son évaluateur est serré. La boucle d'AI Scientist v2 exécute du code ouvert avec des objectifs ouverts. C'est pourquoi elle a besoin d'un isolement plus fort (Docker minimum; seccomp / gVisor préféré) et d'un examen manuel de chaque soumission avant de quitter le système.

### Où v2 se trouve dans la pile de frontière

| System | Target | Output kind | Evaluator | Known failure |
|---|---|---|---|---|
| AlphaEvolve | algorithms | code | unit + benchmark | bounded by evaluator rigor |
| DGM | agent scaffolding | code | SWE-bench | reward hacking |
| AI Scientist v2 | research papers | text + code + figures | peer review (weak) | experiment failures, mislabeling, polish masking weakness |

Le système d'évaluation automatique v2 est le plus faible des trois, la surface de sortie la plus large et le chemin le plus court vers les objets publics.

```figure
mx-research-loop
```

## Utilisez-le

`code/main.py`Simulation de la boucle v2 en tant que machine d'état: idée → vérification de la nouveauté → expérience → figure → écriture → révision → acceptation-ou-iteration. Chaque état a une probabilité de défaillance configurable tirée des résultats de Beel et al. Exécutez le simulateur pour N boucles et comptez:

- Combien d'idées sont soumises.
- Combien de soumissions auraient une faille critique expérimentale que le papier poli cache.
- Comment les budgets de réessayer échanger qualité contre rendement.

## La faire partir

`outputs/skill-ai-scientist-sandbox-review.md`est une liste de contrôle de deux portes pour tout ce produit par un agent de cycle de recherche avant qu'il ne quitte la boîte à sable.

## Exercices

1. On court .`code/main.py`Quelle fraction de circuits produit un papier " propre " ? Quelle fraction produit un papier avec une faille d'expérience-échec la figure critique poli ?

2. Les défauts utilisent déjà les 42% / 25% de Beel et al.`--experiment-failure 0.20 --novelty-mislabel 0.10`et puis avec `--experiment-failure 0.60 --novelty-mislabel 0.40`Comment se déplace la part polissée mais défectueuse entre les deux courses ?

3. Lisez le repo README de Sakana sur les exigences de la boîte à sable.

4. Lisez la section 4 sur l'écart de qualité de présentation.

5. Proposez un protocole d'examen humain pour les résultats des agents de recherche qui équivaut mieux à "un doctorant lit chaque article". Identifiez le goulet d'étranglement et la conception autour de celui-ci.

## Les termes clés

| Term | What people say | What it actually means |
|---|---|---|
| AI Scientist v1 | "Sakana's templated research agent" | Filled experiments into a fixed scaffold |
| AI Scientist v2 | "Template-free research agent" | Agentic tree search with VLM figure critique |
| Agentic tree search | "Branching research agent" | Expands multiple experiment plans in parallel; prunes by internal critic |
| Vision-language critique | "VLM polish on figures" | Multimodal model reads figures and rewrites them for clarity |
| Literature retrieval | "Novelty check" | Searches prior work to confirm idea novelty — documented to mislabel |
| Polish masking | "Pretty paper, broken research" | Presentation quality exceeds experimental quality; hides weaknesses |
| Sandbox escape | "LLM code breaks out" | Agent-executed code does things the loop designer did not intend |

## Pour en savoir plus

- [Yamada et al. (2025). The AI Scientist-v2](https://arxiv.org/abs/2504.08066)- Le papier.
- [Sakana blog on the Nature 2026 publication](https://sakana.ai/ai-scientist-nature/) résumé des fournisseurs avec contexte d'examen par les pairs.
- [Beel et al. (2025). Independent evaluation of The AI Scientist](https://arxiv.org/abs/2502.14297) numéros d'évaluation externe.
- [Sakana AI Scientist v1 paper](https://arxiv.org/abs/2408.06292) le prédécesseur templé.
- [Anthropic — Measuring AI agent autonomy](https://www.anthropic.com/research/measuring-agent-autonomy) un cadre plus large des agents de recherche à terme.
