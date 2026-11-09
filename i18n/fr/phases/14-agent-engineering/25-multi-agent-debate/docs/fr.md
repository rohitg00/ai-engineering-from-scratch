# Débat et collaboration entre plusieurs agents

> Du et al. (ICML 2024, "Société des esprits") exécutent des instances de modèle N qui proposent indépendamment des réponses, puis se critiquent périodiquement sur des tours R pour converger. Améliore la factualité, le respect des règles, le raisonnement.

**Type:** Learn + Build
**Languages:** Python (stdlib), TypeScript
**Prerequisites:** Phase 14 · 12 (Workflow Patterns), Phase 14 · 05 (Self-Refine and CRITIC)
**Time:** ~60 minutes

## Objectifs d'apprentissage

- Expliquez le protocole de débat: N propositions, R ronds, convergent sur une réponse partagée.
- Décrivez pourquoi les débats améliorent la réalité, le respect des règles et la raison.
- Expliquez une topologie rare: tous les débatteurs n'ont pas besoin de se voir les uns les autres.
- Mettre en œuvre un débat stdlib sur un LLM scénarisé avec des variantes à plein réseau et rares; mesurer le coût des jetons par rapport à l'exactitude.

## Le problème

L'auto-réfiguraison (leçon 05) est un modèle qui se critique  risque la pensée de groupe.

## Le concept

### Société des esprits (Du et al., ICML 2024)

- N cas de modèle proposent indépendamment des réponses à la même question.
- Au cours des tours R, chaque modèle lit les propositions des autres et les critique.
- Les modèles mettent à jour leurs réponses en fonction des critiques.
- Après R, retournez la réponse convergente.

Les expériences originales ont utilisé N=3, R=2 en raison du coût. La précision s'améliore avec plus d'agents et plus de tours sur des problèmes difficiles (MMLU, GSM8K, Validité de mouvement des échecs, génération de biographie).

Les combinaisons de modèles croisés ont battu les débats de modèles uniques: ChatGPT + Bard ensemble > soit seul.

### Topologie de la séparité

" Améliorer le débat multi-agent avec la topologie de communication Sparse " (arXiv:2406.11776, 2024-2025) a montré que le débat complet n'est pas toujours optimal. Les topologies Sparse (étoile, anneau, hub-et-spoke) peuvent correspondre à la précision à un coût de jeton inférieur. Chaque débatteur ne voit qu'un sous-ensemble de pairs.

Les conséquences:

- N=5, R=3 = 5 × 3 = 15 propositions, chaque lecture de 4 pairs = 60 critiques.
- Star N=5, R=3 (un centre + 4 spokes) = 15 propositions, les spokes lisent seulement le centre = 12 critiques.

### Quand le débat aide

- **Factuality.**N'ayant pas de propositions indépendantes, la vérification croisée réduit les hallucinations.
- **Rule-following.**Validité du mouvement d'échecs  un modèle manque une règle, d'autres la prennent.
- **Open-ended reasoning.**Plusieurs cadres restent à la bonne réponse.

### Quand le débat fait mal

- **Latency-sensitive UX.**Les tirs en série N × R sont une latence que vous ne pouvez pas avoir.
- **Cost-sensitive scale.**N × R par requête.
- **Simple factual lookups.**Une recherche est moins chère que cinq débats.

### 2026 des instances pratiques

- **Anthropic orchestrator-workers**(Létion 12)  une variante du débat avec une étape de synthèse.
- **LangGraph supervisor**(Létion 13)  routeur central + agents spécialisés peuvent mettre en œuvre le débat comme un nœud.
- **OpenAI Agents SDK**Les agents se déplacent en avant et en arrière pour une critique itérative.
- **Multi-agent evals** Débat par paire + évaluateur-optimisateur pour le signal d'évaluation.

### Où ce modèle va mal

- **Convergence collapse.**Tous les agents convergent sur la première mauvaise réponse, et l'atténuent avec les tirs nécessaires.
- **Hub failure.**Dans une topologie stellaire, un mauvais hub corrompt tout le monde.
- **Prompt homogenization.**Tous les agents utilisent le même prompt; ils produisent les mêmes réponses.

```figure
debate-converge
```

## Faites-le

`code/main.py`Il met en œuvre le débat de la Sdlib:

- `Debater`classe (MLL écrit avec dérive d'opinion par débatteur).
- `FullMeshDebate`et `SparseDebate`Les coureurs.
- Trois questions: une factuelle, une fondée sur des règles, une raison.
- Mesures: réponse convergente, ronde à convergence, opération critique totale.

- Je vais le faire.

```
python3 code/main.py
npx tsx code/main.ts
```

Résultats: précision et coût par protocole; correspondances rares en pleine maillage sur 2/3 des questions à moindre coût.

## Utilisez-le

- **Anthropic orchestrator-workers**Pour les débats simples de deux ou trois travailleurs.
- **LangGraph**Il est important de prendre en compte les mesures prises pour que les États puissent se soumettre à un débat multilatéral avec un contrôle.
- **Custom**pour la recherche ou des garanties de précision spécialisées.

## La faire partir

`outputs/skill-debate.md`Les règles de convergence sont les mêmes que celles de la définition de la définition de la définition de la définition de la définition de la définition de la définition de la définition de la définition de la définition de la définition de la définition de la définition de la définition de la définition de la définition de la définition de la définition de la définition de la définition de la définition de la définition de la définition de la définition de la définition de la définition de la définition de la définition de la définition de la définition de la définition de la définition de la définition de la définition de la définition de la définition de la définition de la définition.

## Exercices

1. Mettre en œuvre une règle de " désaccord forcé ": au cours du premier cycle, chaque débatteur doit présenter une proposition distincte.
2. Ajouter une aggregation pondérée par confiance: les débatteurs retournent (réponse, confiance); l'agrégateur pondère par confiance.
3. Un "agent" est échangé contre un LLM avec des opinions différentes.
4. Mesurez le coût des jetons pour la masse totale contre la masse rare sur vos 3 questions.
5. Lisez le journal de la Société des esprits.

## Les termes clés

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| Debate | "Multi-agent critique" | N proposers, R rounds of cross-critique, converge |
| Full mesh | "Everyone reads everyone" | Every debater reads every peer each round |
| Sparse topology | "Limited peer view" | Debaters read only a subset of peers |
| Hub-and-spoke | "Star topology" | One central debater, N-1 spokes read only the hub |
| Convergence | "Agreement" | Debaters converge on a shared answer |
| Society of Minds | "Du et al. debate paper" | ICML 2024 multi-agent debate method |

## Pour en savoir plus

- [Du et al., Improving Factuality and Reasoning in Language Models through Multiagent Debate (arXiv:2305.14325)](https://arxiv.org/abs/2305.14325) débat canonique multi-agent
- [Sparse Communication Topology (arXiv:2406.11776)](https://arxiv.org/abs/2406.11776) résultats de topologie rares
- [Anthropic, Building Effective Agents](https://www.anthropic.com/research/building-effective-agents) les travailleurs-orchestre en tant que variante de débat
- [Madaan et al., Self-Refine (arXiv:2303.17651)](https://arxiv.org/abs/2303.17651) contrepartie autocritique de modèle unique
